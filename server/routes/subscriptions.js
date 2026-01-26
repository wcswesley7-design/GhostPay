const express = require('express');
const { z } = require('zod');

const { pool } = require('../db');
const { randomId } = require('../lib/ids');
const { config } = require('../config');
const { validateBody, validateQuery } = require('../middleware/validate');
const { createPixPayment, getPayment } = require('../integrations/mercadoPago');

const router = express.Router();

const PLAN_CONFIG = {
  infinity: {
    label: 'Infinity',
    amount: 59.9,
    description: 'Fluxo Infinity (Pix)'
  }
};

const checkoutSchema = z.object({
  plan: z.literal('infinity'),
  name: z.string().min(2).max(120),
  email: z.string().email().max(120),
  phone: z.string().min(8).max(20),
  cpf: z.string().min(11).max(20)
});

const statusSchema = z.object({
  session: z.string().min(1)
});

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizePhone(value) {
  return normalizeDigits(value);
}

function normalizeCpf(value) {
  return normalizeDigits(value);
}

function mapPaymentStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') {
    return 'approved';
  }
  if (['rejected', 'cancelled', 'canceled', 'refunded', 'charged_back'].includes(normalized)) {
    return 'cancelled';
  }
  return 'pending';
}

function extractPixPayload(payment) {
  const data = payment?.point_of_interaction?.transaction_data;
  if (!data) {
    return null;
  }
  return {
    qr_code: data.qr_code || null,
    qr_code_base64: data.qr_code_base64 || null,
    ticket_url: data.ticket_url || null,
    expires_at: payment?.date_of_expiration || null
  };
}

async function refreshSessionStatus(session) {
  if (!session.mp_payment_id) {
    return session;
  }
  try {
    const payment = await getPayment(session.mp_payment_id);
    const mapped = mapPaymentStatus(payment.status);
    const pixPayload = extractPixPayload(payment);
    if (mapped !== session.status || (pixPayload && !session.pix_payload)) {
      await pool.query(
        `UPDATE subscription_sessions
         SET status = $1,
             approved_at = COALESCE(approved_at, $2),
             pix_payload = COALESCE($3, pix_payload)
         WHERE id = $4`,
        [
          mapped,
          mapped === 'approved' ? new Date().toISOString() : null,
          pixPayload,
          session.id
        ]
      );
      return { ...session, status: mapped, pix_payload: pixPayload || session.pix_payload };
    }
  } catch (err) {
    console.error('[ghostpay] Mercado Pago status refresh failed.', err.message || err);
  }
  return session;
}

router.post('/checkout', validateBody(checkoutSchema), async (req, res) => {
  const { plan, name, email, phone, cpf } = req.body;
  const planConfig = PLAN_CONFIG[plan];
  if (!planConfig) {
    return res.status(400).json({ error: 'Plano inválido' });
  }

  const sessionId = randomId('sub');
  const now = new Date().toISOString();
  const normalizedPhone = normalizePhone(phone);
  const normalizedCpf = normalizeCpf(cpf);

  if (normalizedCpf.length !== 11) {
    return res.status(400).json({ error: 'CPF inválido' });
  }

  try {
    await pool.query(
      `INSERT INTO subscription_sessions
       (id, plan, status, payer_name, payer_email, payer_phone, payer_document, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        sessionId,
        plan,
        'pending',
        name.trim(),
        email.trim().toLowerCase(),
        normalizedPhone,
        normalizedCpf,
        now
      ]
    );

    const payment = await createPixPayment({
      amount: planConfig.amount,
      description: planConfig.description,
      payerEmail: email.trim().toLowerCase(),
      payerName: name.trim(),
      payerCpf: normalizedCpf,
      payerPhone: normalizedPhone,
      externalReference: sessionId,
      notificationUrl: `${config.appBaseUrl}/api/webhooks/mercadopago`,
      idempotencyKey: randomId('mp')
    });

    const status = mapPaymentStatus(payment.status);
    const pixPayload = extractPixPayload(payment);
    await pool.query(
      `UPDATE subscription_sessions
       SET mp_payment_id = $1,
           status = $2,
           approved_at = COALESCE(approved_at, $3),
           pix_payload = $4
       WHERE id = $5`,
      [
        payment.id,
        status,
        status === 'approved' ? new Date().toISOString() : null,
        pixPayload,
        sessionId
      ]
    );

    return res.json({
      sessionId,
      approved: status === 'approved',
      status,
      qrCode: pixPayload?.qr_code || null,
      qrCodeBase64: pixPayload?.qr_code_base64 || null,
      ticketUrl: pixPayload?.ticket_url || null,
      expiresAt: pixPayload?.expires_at || null
    });
  } catch (err) {
    console.error('[ghostpay] Subscription checkout failed.', err.details || err);
    return res
      .status(err.status || 500)
      .json({ error: 'Não foi possível iniciar a assinatura' });
  }
});

router.get('/status', validateQuery(statusSchema), async (req, res) => {
  const sessionId = req.query.session;
  try {
    const result = await pool.query(
      `SELECT id, plan, status, payer_email, mp_payment_id, pix_payload
       FROM subscription_sessions
       WHERE id = $1`,
      [sessionId]
    );
    const session = result.rows[0];
    if (!session) {
      return res.status(404).json({ error: 'Assinatura não encontrada' });
    }

    const updated = await refreshSessionStatus(session);

    return res.json({
      id: updated.id,
      plan: updated.plan,
      status: updated.status,
      approved: updated.status === 'approved',
      pix: updated.pix_payload || null
    });
  } catch (err) {
    console.error('[ghostpay] Subscription status failed.', err);
    return res.status(500).json({ error: 'Não foi possível consultar a assinatura' });
  }
});

module.exports = router;
