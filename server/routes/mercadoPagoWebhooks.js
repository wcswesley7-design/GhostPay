const crypto = require('crypto');
const express = require('express');

const { pool } = require('../db');
const { randomId } = require('../lib/ids');
const { getPayment } = require('../integrations/mercadoPago');
const { mapChargeStatus, extractPixPayload } = require('../services/mercadoPagoGateway');
const { recordTransaction } = require('../services/ledger');
const { emitWebhook } = require('../services/webhooks');

const router = express.Router();

function extractPaymentId(req) {
  return (
    req.body?.data?.id ||
    req.body?.id ||
    req.query['data.id'] ||
    req.query.id ||
    null
  );
}

function extractEventId(payload) {
  return payload?.id || payload?.event_id || payload?.eventId || null;
}

function getRawBody(req) {
  if (req.rawBody) {
    return req.rawBody.toString('utf8');
  }
  if (req.body && Object.keys(req.body).length > 0) {
    return JSON.stringify(req.body);
  }
  return '';
}

function parseSignature(header) {
  if (!header) {
    return null;
  }
  const parts = header.split(',');
  const parsed = {};
  parts.forEach((part) => {
    const [key, value] = part.split('=').map((item) => item.trim());
    if (key && value) {
      parsed[key] = value;
    }
  });
  return parsed;
}

function verifySignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    return true;
  }
  const signatureHeader = req.get('x-signature');
  const requestId = req.get('x-request-id');
  const parsed = parseSignature(signatureHeader);
  if (!parsed || !parsed.ts || !parsed.v1 || !requestId) {
    return false;
  }

  const rawBody = getRawBody(req);
  const manifest = `${parsed.ts}.${requestId}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const left = Buffer.from(parsed.v1, 'utf8');
  const right = Buffer.from(expected, 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  // TODO: Confirm Mercado Pago signature format against official docs.
  return crypto.timingSafeEqual(left, right);
}

async function updateSubscriptionFromPayment(payment) {
  const status = mapSubscriptionStatus(payment.status);
  const approvedAt = status === 'approved' ? new Date().toISOString() : null;
  const externalReference = payment.external_reference;
  const pixPayload = extractPixPayload(payment);
  const subscriptionPayload = pixPayload
    ? {
        qr_code: pixPayload.brCode,
        qr_code_base64: pixPayload.qrCodeBase64,
        ticket_url: pixPayload.ticketUrl,
        expires_at: pixPayload.expiresAt
      }
    : null;

  const result = await pool.query(
    `UPDATE subscription_sessions
     SET status = $1,
         approved_at = COALESCE(approved_at, $2),
         pix_payload = COALESCE($3, pix_payload)
     WHERE mp_payment_id = $4
     RETURNING id`,
    [status, approvedAt, subscriptionPayload, payment.id]
  );

  if (!result.rows[0] && externalReference) {
    const secondary = await pool.query(
      `UPDATE subscription_sessions
       SET mp_payment_id = COALESCE(mp_payment_id, $1),
           status = $2,
           approved_at = COALESCE(approved_at, $3),
           pix_payload = COALESCE($4, pix_payload)
       WHERE id = $5
       RETURNING id`,
      [payment.id, status, approvedAt, subscriptionPayload, externalReference]
    );
    return Boolean(secondary.rows[0]);
  }
  return Boolean(result.rows[0]);
}

function mapSubscriptionStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') {
    return 'approved';
  }
  if (
    ['rejected', 'cancelled', 'canceled', 'refunded', 'charged_back'].includes(normalized)
  ) {
    return 'cancelled';
  }
  return 'pending';
}

function resolveChargeStatus(currentStatus, incomingStatus) {
  const current = String(currentStatus || '').toLowerCase();
  const incoming = String(incomingStatus || '').toLowerCase();

  if (current === 'paid' && incoming !== 'paid') {
    return 'paid';
  }
  if ((current === 'canceled' || current === 'expired') && incoming === 'waiting_payment') {
    return current;
  }
  return incoming || current || 'waiting_payment';
}

async function updateChargeFromPayment(payment) {
  const externalReference = payment.external_reference || null;
  const paymentId = String(payment.id);

  const client = await pool.connect();
  let credited = false;
  let webhookPayload = null;
  let webhookUserId = null;
  try {
    await client.query('BEGIN');
    const chargeResult = await client.query(
      `SELECT *
       FROM pix_charges
       WHERE provider = 'mercadopago'
         AND (id = $1 OR external_reference = $1 OR provider_payment_id = $2)
       FOR UPDATE`,
      [externalReference, paymentId]
    );
    const charge = chargeResult.rows[0];
    if (!charge) {
      await client.query('ROLLBACK');
      return null;
    }
    webhookUserId = charge.user_id;

    const mappedStatus = mapChargeStatus(payment.status);
    const nextStatus = resolveChargeStatus(charge.status, mappedStatus);
    const pixPayload = extractPixPayload(payment);
    const paidAt = nextStatus === 'paid' ? new Date().toISOString() : null;

    await client.query(
      `UPDATE pix_charges
       SET status = $1,
           provider_payment_id = COALESCE(provider_payment_id, $2),
           provider_status = $3,
           qr_payload = COALESCE($4, qr_payload),
           qr_code_base64 = COALESCE($5, qr_code_base64),
           ticket_url = COALESCE($6, ticket_url),
           expires_at = COALESCE($7, expires_at),
           paid_at = COALESCE(paid_at, $8)
       WHERE id = $9`,
      [
        nextStatus,
        paymentId,
        payment.status,
        pixPayload.brCode,
        pixPayload.qrCodeBase64,
        pixPayload.ticketUrl,
        pixPayload.expiresAt,
        paidAt,
        charge.id
      ]
    );

    if (nextStatus === 'paid') {
      const existing = await client.query(
        `SELECT id FROM transactions
         WHERE reference_type = $1 AND reference_id = $2
         LIMIT 1`,
        ['pix_charge', charge.id]
      );
      if (!existing.rows[0]) {
        await recordTransaction(client, {
          userId: charge.user_id,
          type: 'deposit',
          amountCents: charge.amount_cents,
          toAccountId: charge.account_id,
          counterparty: 'Pix payment',
          note: charge.description || 'Pix payment',
          referenceType: 'pix_charge',
          referenceId: charge.id,
          metadata: { provider: 'mercadopago', paymentId }
        });
        credited = true;
        webhookPayload = {
          charge_id: charge.id,
          amount_cents: charge.amount_cents,
          paid_at: paidAt || new Date().toISOString(),
          provider_payment_id: paymentId
        };
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (credited && webhookPayload && webhookUserId) {
    emitWebhook(webhookUserId, 'charge.paid', webhookPayload);
  }

  return {
    credited
  };
}

router.post('/', async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ error: 'signature_mismatch' });
  }

  const paymentId = extractPaymentId(req);
  if (!paymentId) {
    return res.json({ status: 'ignored' });
  }

  const rawBody = getRawBody(req);
  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const eventId = extractEventId(req.body || {});
  const receivedAt = new Date().toISOString();
  const webhookId = randomId('mpw');

  try {
    const insert = await pool.query(
      `INSERT INTO mercadopago_webhook_events (
        id, event_id, payment_id, payload, payload_hash, status, received_at
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
      ON CONFLICT DO NOTHING
      RETURNING id`,
      [webhookId, eventId, String(paymentId), JSON.stringify(req.body || {}), payloadHash, 'received', receivedAt]
    );

    if (!insert.rows[0]) {
      return res.json({ status: 'duplicate' });
    }

    const payment = await getPayment(paymentId);

    const handledSubscription = await updateSubscriptionFromPayment(payment);
    const handledCharge = await updateChargeFromPayment(payment);

    await pool.query(
      'UPDATE mercadopago_webhook_events SET status = $1, processed_at = $2 WHERE id = $3',
      ['processed', new Date().toISOString(), webhookId]
    );

    return res.json({
      status: 'ok',
      subscription: Boolean(handledSubscription),
      charge: Boolean(handledCharge)
    });
  } catch (err) {
    console.error('[ghostpay] Mercado Pago webhook error.', err.message || err);
    await pool.query(
      'UPDATE mercadopago_webhook_events SET status = $1, error = $2 WHERE id = $3',
      ['failed', err.message || 'webhook_failed', webhookId]
    );
    return res.status(500).json({ error: 'mercadopago_webhook_failed' });
  }
});

module.exports = router;
