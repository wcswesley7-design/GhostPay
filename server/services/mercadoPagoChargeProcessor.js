const { pool } = require('../db');
const { mapChargeStatus, extractPixPayload } = require('./mercadoPagoGateway');
const { recordTransaction } = require('./ledger');
const { emitWebhook } = require('./webhooks');

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
  const checkedAt = new Date().toISOString();

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
           paid_at = COALESCE(paid_at, $8),
           provider_checked_at = $9
       WHERE id = $10`,
      [
        nextStatus,
        paymentId,
        payment.status,
        pixPayload.brCode,
        pixPayload.qrCodeBase64,
        pixPayload.ticketUrl,
        pixPayload.expiresAt,
        paidAt,
        checkedAt,
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

module.exports = {
  updateChargeFromPayment
};
