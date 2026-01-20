const express = require('express');
const { z } = require('zod');

const { pool } = require('../db');
const { validateBody } = require('../middleware/validate');
const { config } = require('../config');
const { createPixPayment, getPayment } = require('../integrations/mercadoPago');
const { mapChargeStatus, extractPixPayload } = require('../services/mercadoPagoGateway');

const router = express.Router();

const createPaymentSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(120),
  cpf: z.string().min(11).max(14),
  phone: z.string().min(8).max(20).optional()
});

router.get('/charges/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, amount_cents, description, status, qr_payload, qr_code_base64, ticket_url, provider_payment_id, provider_status, provider,
              expires_at, created_at, paid_at
       FROM pix_charges
       WHERE id = $1`,
      [req.params.id]
    );
    const charge = result.rows[0];
    if (!charge || charge.provider !== 'mercadopago') {
      return res.status(404).json({ error: 'Charge not found' });
    }
    return res.json({
      charge: {
        id: charge.id,
        amountCents: charge.amount_cents,
        description: charge.description,
        status: charge.status,
        providerPaymentId: charge.provider_payment_id,
        providerStatus: charge.provider_status,
        brCode: charge.qr_payload || null,
        qrCodeBase64: charge.qr_code_base64 || null,
        ticketUrl: charge.ticket_url || null,
        expiresAt: charge.expires_at,
        createdAt: charge.created_at,
        paidAt: charge.paid_at
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load charge' });
  }
});

router.post('/charges/:id/create_payment', validateBody(createPaymentSchema), async (req, res) => {
  const chargeId = req.params.id;

  try {
    const chargeResult = await pool.query(
      `SELECT id, user_id, account_id, amount_cents, description, status, provider_payment_id, qr_payload, qr_code_base64, ticket_url, provider
       FROM pix_charges
       WHERE id = $1`,
      [chargeId]
    );
    const charge = chargeResult.rows[0];
    if (!charge || charge.provider !== 'mercadopago') {
      return res.status(404).json({ error: 'Charge not found' });
    }
    if (charge.status === 'paid') {
      return res.json({
        chargeId,
        status: 'paid',
        providerPaymentId: charge.provider_payment_id,
        qrCode: charge.qr_payload || null,
        qrCodeBase64: charge.qr_code_base64 || null,
        ticketUrl: charge.ticket_url || null,
        expiresAt: null
      });
    }
    if (['canceled', 'expired'].includes(charge.status)) {
      return res.status(409).json({ error: 'charge_unavailable' });
    }

    if (charge.provider_payment_id) {
      const payment = await getPayment(charge.provider_payment_id);
      const pixPayload = extractPixPayload(payment);
      const mappedStatus = mapChargeStatus(payment.status);
      const nextStatus = mappedStatus === 'paid' ? 'waiting_payment' : mappedStatus;

      await pool.query(
        `UPDATE pix_charges
         SET status = $1,
             provider_status = $2,
             qr_payload = COALESCE($3, qr_payload),
             qr_code_base64 = COALESCE($4, qr_code_base64),
             ticket_url = COALESCE($5, ticket_url),
             expires_at = COALESCE($6, expires_at)
         WHERE id = $7`,
        [
          nextStatus,
          payment.status,
          pixPayload.brCode,
          pixPayload.qrCodeBase64,
          pixPayload.ticketUrl,
          pixPayload.expiresAt,
          chargeId
        ]
      );

      return res.json({
        chargeId,
        status: nextStatus,
        providerPaymentId: charge.provider_payment_id,
        qrCode: pixPayload.brCode || charge.qr_payload || null,
        qrCodeBase64: pixPayload.qrCodeBase64 || charge.qr_code_base64 || null,
        ticketUrl: pixPayload.ticketUrl || charge.ticket_url || null,
        expiresAt: pixPayload.expiresAt || null
      });
    }

    const normalizedPhone = req.body.phone ? req.body.phone.replace(/\D/g, '') : null;
    const payload = await createPixPayment({
      amount: Number(charge.amount_cents) / 100,
      description: charge.description || 'Pix payment',
      payerEmail: req.body.email.trim().toLowerCase(),
      payerName: req.body.name.trim(),
      payerCpf: req.body.cpf.replace(/\D/g, ''),
      payerPhone: normalizedPhone,
      externalReference: chargeId,
      notificationUrl: `${config.appBaseUrl.replace(/\/+$/, '')}/webhooks/mercadopago`,
      idempotencyKey: `charge_${chargeId}`
    });

    const pixPayload = extractPixPayload(payload);
    const mappedStatus = mapChargeStatus(payload.status);
    const nextStatus = mappedStatus === 'paid' ? 'waiting_payment' : mappedStatus;

    await pool.query(
      `UPDATE pix_charges
       SET status = $1,
           provider_payment_id = $2,
           provider_status = $3,
           payer_name = $4,
           payer_email = $5,
           payer_document = $6,
           payer_phone = $7,
           qr_payload = $8,
           qr_code_base64 = $9,
           ticket_url = $10,
           expires_at = COALESCE($11, expires_at)
       WHERE id = $12`,
      [
        nextStatus,
        payload.id,
        payload.status,
        req.body.name.trim(),
        req.body.email.trim().toLowerCase(),
        req.body.cpf.replace(/\D/g, ''),
        normalizedPhone,
        pixPayload.brCode || '',
        pixPayload.qrCodeBase64,
        pixPayload.ticketUrl,
        pixPayload.expiresAt,
        chargeId
      ]
    );

    return res.json({
      chargeId,
      status: nextStatus,
      providerPaymentId: payload.id,
      qrCode: pixPayload.brCode || null,
      qrCodeBase64: pixPayload.qrCodeBase64 || null,
      ticketUrl: pixPayload.ticketUrl || null,
      expiresAt: pixPayload.expiresAt || null
    });
  } catch (err) {
    console.error(err);
    const isConfigError = err.message === 'mp_not_configured';
    const message = isConfigError ? 'mp_not_configured' : 'charge_payment_failed';
    return res.status(isConfigError ? 503 : 500).json({ error: message });
  }
});

module.exports = router;
