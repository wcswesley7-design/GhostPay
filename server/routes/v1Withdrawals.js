const express = require('express');
const { z } = require('zod');

const { pool } = require('../db');
const { randomId } = require('../lib/ids');
const { parseAmountToCents } = require('../lib/money');
const { merchantAuth } = require('../middleware/merchantAuth');
const { idempotencyGuard } = require('../middleware/idempotency');
const { validateBody } = require('../middleware/validate');
const { ensureMerchantAccount } = require('../services/merchantAccounts');
const { reserveHold } = require('../services/ledger');

const router = express.Router();

const createWithdrawalSchema = z.object({
  amount: z.union([z.string(), z.number()]),
  pix_key_type: z.enum(['cpf', 'phone', 'email', 'random']),
  pix_key: z.string().min(3).max(140)
});

router.use(merchantAuth);

router.post('/withdrawals', idempotencyGuard('gateway.withdrawals.create'), validateBody(createWithdrawalSchema), async (req, res) => {
  const amountCents = parseAmountToCents(req.body.amount);
  if (!amountCents || amountCents <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  try {
    const account = await ensureMerchantAccount(req.user.id);
    if (account.currency !== 'BRL') {
      return res.status(400).json({ error: 'Pix only supports BRL accounts' });
    }
    let pixKey = req.body.pix_key.trim();
    if (['cpf', 'phone'].includes(req.body.pix_key_type)) {
      pixKey = pixKey.replace(/\D/g, '');
    }
    if (!pixKey) {
      return res.status(400).json({ error: 'Invalid Pix key' });
    }
    const client = await pool.connect();
    const withdrawalId = randomId('wd');
    const now = new Date().toISOString();
    try {
      await client.query('BEGIN');
      await reserveHold(client, {
        userId: req.user.id,
        accountId: account.id,
        amountCents,
        referenceType: 'withdrawal_hold',
        referenceId: withdrawalId,
        note: 'Withdrawal hold'
      });

      await client.query(
        `INSERT INTO withdrawal_requests (
          id, user_id, account_id, amount_cents, pix_key_type, pix_key, status, requested_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          withdrawalId,
          req.user.id,
          account.id,
          amountCents,
          req.body.pix_key_type,
          pixKey,
          'requested',
          now
        ]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    return res.status(201).json({
      withdrawal: {
        id: withdrawalId,
        amount_cents: amountCents,
        pix_key_type: req.body.pix_key_type,
        pix_key: pixKey,
        status: 'requested',
        requested_at: now
      }
    });
  } catch (err) {
    if (err.message === 'insufficient_funds') {
      return res.status(400).json({ error: 'Insufficient funds' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Unable to create withdrawal' });
  }
});

router.get('/withdrawals', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, amount_cents, pix_key_type, pix_key, status, admin_note, proof_url, requested_at, processed_at, paid_at
       FROM withdrawal_requests
       WHERE user_id = $1
       ORDER BY requested_at DESC`,
      [req.user.id]
    );
    const withdrawals = result.rows.map((row) => ({
      id: row.id,
      amount_cents: row.amount_cents,
      pix_key_type: row.pix_key_type,
      pix_key: row.pix_key,
      status: row.status,
      admin_note: row.admin_note,
      proof_url: row.proof_url,
      requested_at: row.requested_at,
      processed_at: row.processed_at,
      paid_at: row.paid_at
    }));
    return res.json({ withdrawals });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load withdrawals' });
  }
});

module.exports = router;
