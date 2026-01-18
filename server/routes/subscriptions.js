const express = require('express');
const { z } = require('zod');

const { pool } = require('../db');
const { randomId } = require('../lib/ids');
const { config } = require('../config');
const { validateBody, validateQuery } = require('../middleware/validate');
const { createPreapproval, getPreapproval } = require('../integrations/mercadoPago');

const router = express.Router();

const PLAN_CONFIG = {
  infinity: {
    label: 'Infinity',
    amount: 59.9,
    reason: 'GhostPay Infinity'
  }
};

const checkoutSchema = z.object({
  plan: z.literal('infinity'),
  name: z.string().min(2).max(120),
  email: z.string().email().max(120),
  phone: z.string().min(8).max(20)
});

const statusSchema = z.object({
  session: z.string().min(1)
});

function normalizePhone(value) {
  return value.replace(/\D/g, '');
}

function mapMpStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (['authorized', 'active'].includes(normalized)) {
    return 'approved';
  }
  if (['cancelled', 'canceled'].includes(normalized)) {
    return 'cancelled';
  }
  if (normalized === 'paused') {
    return 'paused';
  }
  return 'pending';
}

async function refreshSessionStatus(session) {
  if (!session.mp_preapproval_id) {
    return session;
  }
  try {
    const preapproval = await getPreapproval(session.mp_preapproval_id);
    const mapped = mapMpStatus(preapproval.status);
    if (mapped !== session.status) {
      await pool.query(
        `UPDATE subscription_sessions
         SET status = $1, approved_at = COALESCE(approved_at, $2)
         WHERE id = $3`,
        [mapped, mapped === 'approved' ? new Date().toISOString() : null, session.id]
      );
      return { ...session, status: mapped };
    }
  } catch (err) {
    console.error('[ghostpay] Mercado Pago status refresh failed.', err.message || err);
  }
  return session;
}

router.post('/checkout', validateBody(checkoutSchema), async (req, res) => {
  const { plan, name, email, phone } = req.body;
  const planConfig = PLAN_CONFIG[plan];
  if (!planConfig) {
    return res.status(400).json({ error: 'Plano inválido' });
  }

  const sessionId = randomId('sub');
  const now = new Date().toISOString();
  const normalizedPhone = normalizePhone(phone);

  try {
    await pool.query(
      `INSERT INTO subscription_sessions
       (id, plan, status, payer_name, payer_email, payer_phone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [sessionId, plan, 'pending', name.trim(), email.trim().toLowerCase(), normalizedPhone, now]
    );

    const backUrl = `${config.appBaseUrl}/console?tab=register&plan=${plan}&session=${sessionId}`;
    const preapproval = await createPreapproval({
      reason: planConfig.reason,
      payerEmail: email.trim().toLowerCase(),
      amount: planConfig.amount,
      backUrl,
      externalReference: sessionId
    });

    const status = mapMpStatus(preapproval.status);
    await pool.query(
      `UPDATE subscription_sessions
       SET mp_preapproval_id = $1, status = $2, approved_at = COALESCE(approved_at, $3)
       WHERE id = $4`,
      [preapproval.id, status, status === 'approved' ? new Date().toISOString() : null, sessionId]
    );

    return res.json({
      sessionId,
      initPoint: preapproval.init_point || preapproval.sandbox_init_point
    });
  } catch (err) {
    console.error('[ghostpay] Subscription checkout failed.', err.details || err);
    return res.status(err.status || 500).json({ error: 'Não foi possível iniciar a assinatura' });
  }
});

router.get('/status', validateQuery(statusSchema), async (req, res) => {
  const sessionId = req.query.session;
  try {
    const result = await pool.query(
      `SELECT id, plan, status, payer_email, mp_preapproval_id
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
      approved: updated.status === 'approved'
    });
  } catch (err) {
    console.error('[ghostpay] Subscription status failed.', err);
    return res.status(500).json({ error: 'Não foi possível consultar a assinatura' });
  }
});

module.exports = router;
