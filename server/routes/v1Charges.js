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

const updateChargeSchema = z
  .object({
    amount: z.union([z.string(), z.number()]).optional(),
    description: z.string().max(140).optional()
  })
  .refine((data) => data.amount != null || data.description != null, {
    message: 'Nothing to update'
  });

function buildPayUrl(chargeId) {
  const baseUrl = config.appBaseUrl.replace(/\/+$/, '');
  return `${baseUrl}/pay/${chargeId}`;
}

router.use(merchantAuth);

router.get('/charges', async (req, res) => {
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 10, 50);
  try {
    const result = await pool.query(
      `SELECT id, amount_cents, description, status, provider_payment_id, provider_status,
              qr_payload, qr_code_base64, ticket_url, paid_at, expires_at, created_at
       FROM pix_charges
       WHERE user_id = $1 AND provider = 'mercadopago' AND archived_at IS NULL
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );
    const charges = result.rows.map((charge) => ({
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
    }));
    return res.json({ charges });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load charges' });
  }
});

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
       WHERE id = $1 AND user_id = $2 AND archived_at IS NULL`,
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

router.patch('/charges/:id', validateBody(updateChargeSchema), async (req, res) => {
  const chargeId = req.params.id;
  const updates = {};

  if (req.body.amount != null) {
    const amountCents = parseAmountToCents(req.body.amount);
    if (!amountCents || amountCents <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    updates.amount_cents = amountCents;
  }

  if (req.body.description != null) {
    const trimmed = String(req.body.description).trim();
    updates.description = trimmed ? trimmed : null;
  }

  try {
    const chargeResult = await pool.query(
      `SELECT id, status, provider_payment_id, amount_cents, description
       FROM pix_charges
       WHERE id = $1 AND user_id = $2 AND archived_at IS NULL`,
      [chargeId, req.user.id]
    );
    const charge = chargeResult.rows[0];
    if (!charge) {
      return res.status(404).json({ error: 'Charge not found' });
    }
    if (charge.status === 'paid' || charge.provider_payment_id) {
      return res.status(409).json({ error: 'Charge cannot be edited' });
    }

    const nextAmount = updates.amount_cents != null ? updates.amount_cents : charge.amount_cents;
    const nextDescription = Object.prototype.hasOwnProperty.call(updates, 'description')
      ? updates.description
      : charge.description;

    const updateResult = await pool.query(
      `UPDATE pix_charges
       SET amount_cents = $1,
           description = $2
       WHERE id = $3 AND user_id = $4 AND archived_at IS NULL
       RETURNING id, amount_cents, description, status, created_at`,
      [nextAmount, nextDescription, chargeId, req.user.id]
    );

    const updated = updateResult.rows[0];
    return res.json({
      charge: {
        charge_id: updated.id,
        amount_cents: updated.amount_cents,
        description: updated.description,
        status: updated.status,
        created_at: updated.created_at,
        pay_url: buildPayUrl(updated.id)
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to update charge' });
  }
});

router.post('/charges/:id/inactivate', async (req, res) => {
  const chargeId = req.params.id;
  try {
    const chargeResult = await pool.query(
      `SELECT id, status
       FROM pix_charges
       WHERE id = $1 AND user_id = $2 AND archived_at IS NULL`,
      [chargeId, req.user.id]
    );
    const charge = chargeResult.rows[0];
    if (!charge) {
      return res.status(404).json({ error: 'Charge not found' });
    }
    if (charge.status === 'paid') {
      return res.status(409).json({ error: 'Charge cannot be inactivated' });
    }

    const result = await pool.query(
      `UPDATE pix_charges
       SET status = 'canceled'
       WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
       RETURNING id, status`,
      [chargeId, req.user.id]
    );
    return res.json({ charge: { charge_id: result.rows[0].id, status: result.rows[0].status } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to inactivate charge' });
  }
});

router.delete('/charges/:id', async (req, res) => {
  const chargeId = req.params.id;
  try {
    const result = await pool.query(
      `UPDATE pix_charges
       SET archived_at = NOW()
       WHERE id = $1 AND user_id = $2 AND archived_at IS NULL
       RETURNING id`,
      [chargeId, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Charge not found' });
    }
    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to delete charge' });
  }
});

module.exports = router;
