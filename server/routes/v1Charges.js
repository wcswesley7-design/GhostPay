const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');

const { pool } = require('../db');
const { randomId } = require('../lib/ids');
const { parseAmountToCents } = require('../lib/money');
const { config } = require('../config');
const { validateBody } = require('../middleware/validate');
const { idempotencyGuard } = require('../middleware/idempotency');
const { merchantAuth } = require('../middleware/merchantAuth');
const { ensureMerchantAccount } = require('../services/merchantAccounts');

const router = express.Router();

const createChargeSchema = z.object({
  amount: z.union([z.string(), z.number()]),
  description: z.string().max(140).optional()
});

function buildPayUrl(chargeId) {
  const baseUrl = config.appBaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/pay/${chargeId}`;
}

router.use(merchantAuth);

router.post('/charges', idempotencyGuard('gateway.charges.create'), validateBody(createChargeSchema), async (req, res) => {
  const amountCents = parseAmountToCents(req.body.amount);
  if (!amountCents || amountCents <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const account = await ensureMerchantAccount(req.user.id);
    if (account.currency !== 'BRL') {
      return res.status(400).json({ error: 'Pix only supports BRL accounts' });
    }
    const chargeId = randomId('pixc');
    const txid = crypto.randomUUID().replace(/-/g, '').slice(0, 26);
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const description = req.body.description ? req.body.description.trim() : null;

    await pool.query(
      `INSERT INTO pix_charges (
        id, user_id, account_id, key_id, amount_cents, description, status, txid,
        qr_payload, provider, external_reference, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        chargeId,
        req.user.id,
        account.id,
        null,
        amountCents,
        description,
        'created',
        txid,
        '',
        'mercadopago',
        chargeId,
        expiresAt,
        now
      ]
    );

    return res.status(201).json({
      charge_id: chargeId,
      status: 'created',
      amount_cents: amountCents,
      description,
      pay_url: buildPayUrl(chargeId),
      expires_at: expiresAt,
      created_at: now
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to create charge' });
  }
});

router.get('/charges/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, amount_cents, description, status, provider_payment_id, provider_status,
              qr_payload, qr_code_base64, ticket_url, paid_at, expires_at, created_at
       FROM pix_charges
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    const charge = result.rows[0];
    if (!charge) {
      return res.status(404).json({ error: 'Charge not found' });
    }
    return res.json({
      charge: {
        charge_id: charge.id,
        amount_cents: charge.amount_cents,
        description: charge.description,
        status: charge.status,
        provider_payment_id: charge.provider_payment_id,
        provider_status: charge.provider_status,
        br_code: charge.qr_payload || null,
        qr_code_base64: charge.qr_code_base64 || null,
        ticket_url: charge.ticket_url || null,
        paid_at: charge.paid_at,
        expires_at: charge.expires_at,
        created_at: charge.created_at,
        pay_url: buildPayUrl(charge.id)
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load charge' });
  }
});

module.exports = router;
