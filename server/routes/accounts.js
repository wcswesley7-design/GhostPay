const express = require('express');
const { z } = require('zod');

const { pool } = require('../db');
const { randomId, accountNumber } = require('../lib/ids');
const { idempotencyGuard } = require('../middleware/idempotency');
const { validateBody } = require('../middleware/validate');

const router = express.Router();

const createAccountSchema = z.object({
  name: z.string().min(2).max(60),
  currency: z.string().length(3).optional().default('BRL')
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, currency, balance_cents, account_number, created_at FROM accounts WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    const accounts = result.rows.map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      balanceCents: account.balance_cents,
      accountNumber: account.account_number,
      createdAt: account.created_at
    }));

    return res.json({ accounts });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load accounts' });
  }
});

router.post('/', idempotencyGuard('accounts.create'), validateBody(createAccountSchema), async (req, res) => {
  const name = req.body.name.trim();
  const currency = req.body.currency.trim().toUpperCase();
  const accountId = randomId('acc');
  const now = new Date().toISOString();
  const accountNum = accountNumber();

  try {
    await pool.query(
      'INSERT INTO accounts (id, user_id, name, currency, balance_cents, account_number, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [accountId, req.user.id, name, currency, 0, accountNum, now]
    );

    return res.status(201).json({
      account: {
        id: accountId,
        name,
        currency,
        balanceCents: 0,
        accountNumber: accountNum,
        createdAt: now
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to create account' });
  }
});

module.exports = router;
