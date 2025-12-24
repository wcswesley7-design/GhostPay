const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');

const { pool } = require('../db');
const { randomId } = require('../lib/ids');
const { parseAmountToCents } = require('../lib/money');
const { validateBody } = require('../middleware/validate');
const { recordTransaction } = require('../services/ledger');
const { emitWebhook } = require('../services/webhooks');

const router = express.Router();

const createKeySchema = z.object({
  type: z.enum(['cpf', 'phone', 'email', 'random']),
  value: z.string().optional()
});

const createChargeSchema = z.object({
  accountId: z.string().min(1),
  keyId: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  description: z.string().max(140).optional()
});

const createTransferSchema = z.object({
  accountId: z.string().min(1),
  keyType: z.enum(['cpf', 'phone', 'email', 'random']),
  keyValue: z.string().min(3),
  amount: z.union([z.string(), z.number()]),
  description: z.string().max(140).optional()
});

router.get('/keys', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, type, value, status, created_at FROM pix_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    const keys = result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      value: row.value,
      status: row.status,
      createdAt: row.created_at
    }));
    return res.json({ keys });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load Pix keys' });
  }
});

router.post('/keys', validateBody(createKeySchema), async (req, res) => {
  const keyType = req.body.type;
  let value = req.body.value ? req.body.value.trim() : null;

  if (keyType === 'random') {
    value = `gp-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  }

  if (!value) {
    return res.status(400).json({ error: 'Key value required' });
  }

  if (keyType === 'email') {
    value = value.toLowerCase();
  }

  if (keyType === 'cpf' || keyType === 'phone') {
    value = value.replace(/\D/g, '');
  }
  if ((keyType === 'cpf' || keyType === 'phone') && !value) {
    return res.status(400).json({ error: 'Key value required' });
  }

  const keyId = randomId('pix');
  const now = new Date().toISOString();

  try {
    await pool.query(
      'INSERT INTO pix_keys (id, user_id, type, value, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [keyId, req.user.id, keyType, value, 'active', now]
    );

    return res.status(201).json({
      key: {
        id: keyId,
        type: keyType,
        value,
        status: 'active',
        createdAt: now
      }
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Pix key already exists' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Unable to create Pix key' });
  }
});

router.get('/charges', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, account_id, key_id, amount_cents, description, status, txid, qr_payload, expires_at, created_at, paid_at FROM pix_charges WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    const charges = result.rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      keyId: row.key_id,
      amountCents: row.amount_cents,
      description: row.description,
      status: row.status,
      txid: row.txid,
      qrPayload: row.qr_payload,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      paidAt: row.paid_at
    }));
    return res.json({ charges });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load Pix charges' });
  }
});

router.post('/charges', validateBody(createChargeSchema), async (req, res) => {
  const amountCents = parseAmountToCents(req.body.amount);
  if (!amountCents || amountCents <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const accountResult = await pool.query(
      'SELECT id, currency FROM accounts WHERE id = $1 AND user_id = $2',
      [req.body.accountId, req.user.id]
    );
    const account = accountResult.rows[0];
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (account.currency !== 'BRL') {
      return res.status(400).json({ error: 'Pix only supports BRL accounts' });
    }

    const keyResult = await pool.query(
      "SELECT id, type, value FROM pix_keys WHERE id = $1 AND user_id = $2 AND status = 'active'",
      [req.body.keyId, req.user.id]
    );
    const key = keyResult.rows[0];
    if (!key) {
      return res.status(404).json({ error: 'Pix key not found' });
    }

    const chargeId = randomId('pixc');
    const txid = crypto.randomUUID().replace(/-/g, '').slice(0, 26);
    const qrPayload = `pix://ghostpay/${txid}?amount=${(amountCents / 100).toFixed(2)}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const description = req.body.description ? req.body.description.trim() : null;

    await pool.query(
      `INSERT INTO pix_charges (
        id, user_id, account_id, key_id, amount_cents, description, status, txid, qr_payload, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        chargeId,
        req.user.id,
        req.body.accountId,
        req.body.keyId,
        amountCents,
        description,
        'pending',
        txid,
        qrPayload,
        expiresAt,
        now
      ]
    );

    emitWebhook(req.user.id, 'pix.charge.created', {
      id: chargeId,
      amountCents,
      status: 'pending',
      txid,
      key: { id: key.id, type: key.type, value: key.value }
    });

    return res.status(201).json({
      charge: {
        id: chargeId,
        accountId: req.body.accountId,
        keyId: req.body.keyId,
        amountCents,
        description,
        status: 'pending',
        txid,
        qrPayload,
        expiresAt,
        createdAt: now
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to create Pix charge' });
  }
});

router.post('/charges/:id/simulate-pay', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT * FROM pix_charges WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [req.params.id, req.user.id]
    );
    const charge = result.rows[0];
    if (!charge) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Charge not found' });
    }
    if (charge.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Charge not pending' });
    }

    const paidAt = new Date().toISOString();
    await client.query(
      'UPDATE pix_charges SET status = $1, paid_at = $2 WHERE id = $3',
      ['paid', paidAt, charge.id]
    );

    const ledgerResult = await recordTransaction(client, {
      userId: req.user.id,
      type: 'deposit',
      amountCents: charge.amount_cents,
      toAccountId: charge.account_id,
      counterparty: 'Pix charge',
      note: charge.description || 'Pix charge',
      referenceType: 'pix_charge',
      referenceId: charge.id,
      metadata: { txid: charge.txid }
    });

    await client.query('COMMIT');

    emitWebhook(req.user.id, 'pix.charge.paid', {
      id: charge.id,
      amountCents: charge.amount_cents,
      txid: charge.txid,
      paidAt
    });

    return res.json({
      charge: {
        id: charge.id,
        status: 'paid',
        paidAt
      },
      transactionId: ledgerResult.id
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    const message = err.message;
    if (message === 'to_account_not_found') {
      return res.status(404).json({ error: 'Account not found' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Unable to simulate payment' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

router.get('/transfers', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, account_id, key_type, key_value, amount_cents, description, status, created_at, completed_at FROM pix_transfers WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    const transfers = result.rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      keyType: row.key_type,
      keyValue: row.key_value,
      amountCents: row.amount_cents,
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at
    }));
    return res.json({ transfers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load Pix transfers' });
  }
});

router.post('/transfers', validateBody(createTransferSchema), async (req, res) => {
  const amountCents = parseAmountToCents(req.body.amount);
  if (!amountCents || amountCents <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const transferId = randomId('pixt');
    const now = new Date().toISOString();
    let keyValue = req.body.keyValue.trim();
    if (req.body.keyType === 'email') {
      keyValue = keyValue.toLowerCase();
    }
    if (req.body.keyType === 'cpf' || req.body.keyType === 'phone') {
      keyValue = keyValue.replace(/\D/g, '');
    }
    if (!keyValue) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid Pix key' });
    }
    const description = req.body.description ? req.body.description.trim() : null;

    const accountResult = await client.query(
      'SELECT id, currency FROM accounts WHERE id = $1 AND user_id = $2',
      [req.body.accountId, req.user.id]
    );
    const account = accountResult.rows[0];
    if (!account) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Account not found' });
    }
    if (account.currency !== 'BRL') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Pix only supports BRL accounts' });
    }

    const ledgerResult = await recordTransaction(client, {
      userId: req.user.id,
      type: 'payment',
      amountCents,
      fromAccountId: req.body.accountId,
      counterparty: `Pix ${keyValue}`,
      note: description || 'Pix transfer',
      referenceType: 'pix_transfer',
      referenceId: transferId,
      metadata: { keyType: req.body.keyType }
    });

    await client.query(
      `INSERT INTO pix_transfers (
        id, user_id, account_id, key_type, key_value, amount_cents, description, status, created_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        transferId,
        req.user.id,
        req.body.accountId,
        req.body.keyType,
        keyValue,
        amountCents,
        description,
        'completed',
        now,
        now
      ]
    );

    await client.query('COMMIT');

    emitWebhook(req.user.id, 'pix.transfer.completed', {
      id: transferId,
      amountCents,
      keyType: req.body.keyType,
      keyValue
    });

    return res.status(201).json({
      transfer: {
        id: transferId,
        accountId: req.body.accountId,
        keyType: req.body.keyType,
        keyValue,
        amountCents,
        description,
        status: 'completed',
        createdAt: now,
        completedAt: now
      },
      transactionId: ledgerResult.id
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    const message = err.message;
    if (message === 'from_account_not_found') {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (message === 'insufficient_funds') {
      return res.status(400).json({ error: 'Insufficient funds' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Unable to create Pix transfer' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
