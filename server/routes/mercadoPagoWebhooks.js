const express = require('express');

const { pool } = require('../db');
const { getPreapproval } = require('../integrations/mercadoPago');

const router = express.Router();

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

function extractPreapprovalId(req) {
  return (
    req.body?.data?.id ||
    req.body?.id ||
    req.query['data.id'] ||
    req.query.id ||
    null
  );
}

router.post('/', async (req, res) => {
  const preapprovalId = extractPreapprovalId(req);
  if (!preapprovalId) {
    return res.json({ status: 'ignored' });
  }

  try {
    const preapproval = await getPreapproval(preapprovalId);
    const status = mapMpStatus(preapproval.status);
    const approvedAt = status === 'approved' ? new Date().toISOString() : null;
    const externalReference = preapproval.external_reference;

    const result = await pool.query(
      `UPDATE subscription_sessions
       SET status = $1, approved_at = COALESCE(approved_at, $2)
       WHERE mp_preapproval_id = $3
       RETURNING id`,
      [status, approvedAt, preapprovalId]
    );

    if (!result.rows[0] && externalReference) {
      await pool.query(
        `UPDATE subscription_sessions
         SET mp_preapproval_id = $1, status = $2, approved_at = COALESCE(approved_at, $3)
         WHERE id = $4`,
        [preapprovalId, status, approvedAt, externalReference]
      );
    }

    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('[ghostpay] Mercado Pago webhook error.', err.message || err);
    return res.status(500).json({ error: 'mercadopago_webhook_failed' });
  }
});

module.exports = router;
