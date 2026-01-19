const express = require('express');

const { pool } = require('../db');
const { getPayment } = require('../integrations/mercadoPago');

const router = express.Router();

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

function extractPaymentId(req) {
  return (
    req.body?.data?.id ||
    req.body?.id ||
    req.query['data.id'] ||
    req.query.id ||
    null
  );
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

router.post('/', async (req, res) => {
  const paymentId = extractPaymentId(req);
  if (!paymentId) {
    return res.json({ status: 'ignored' });
  }

  try {
    const payment = await getPayment(paymentId);
    const status = mapPaymentStatus(payment.status);
    const approvedAt = status === 'approved' ? new Date().toISOString() : null;
    const externalReference = payment.external_reference;
    const pixPayload = extractPixPayload(payment);

    const result = await pool.query(
      `UPDATE subscription_sessions
       SET status = $1,
           approved_at = COALESCE(approved_at, $2),
           pix_payload = COALESCE($3, pix_payload)
       WHERE mp_payment_id = $4
       RETURNING id`,
      [status, approvedAt, pixPayload, paymentId]
    );

    if (!result.rows[0] && externalReference) {
      await pool.query(
        `UPDATE subscription_sessions
         SET mp_payment_id = COALESCE(mp_payment_id, $1),
             status = $2,
             approved_at = COALESCE(approved_at, $3),
             pix_payload = COALESCE($4, pix_payload)
         WHERE id = $5`,
        [paymentId, status, approvedAt, pixPayload, externalReference]
      );
    }

    return res.json({ status: 'ok' });
  } catch (err) {
    console.error('[ghostpay] Mercado Pago webhook error.', err.message || err);
    return res.status(500).json({ error: 'mercadopago_webhook_failed' });
  }
});

module.exports = router;
