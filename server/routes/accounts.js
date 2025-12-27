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

router.delete('/:id', async (req, res) => {
  const accountId = req.params.id;

  try {
    const accountResult = await pool.query(
      'SELECT id, balance_cents FROM accounts WHERE id = $1 AND user_id = $2',
      [accountId, req.user.id]
    );
    const account = accountResult.rows[0];
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (Number(account.balance_cents) !== 0) {
      return res.status(400).json({ error: 'Account balance must be zero to remove' });
    }

    const refsResult = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM transactions WHERE user_id = $1 AND (from_account_id = $2 OR to_account_id = $2)) AS transaction_count,
        (SELECT COUNT(*) FROM ledger_entries WHERE account_id = $2) AS ledger_count,
        (SELECT COUNT(*) FROM pix_keys WHERE account_id = $2) AS pix_key_count,
        (SELECT COUNT(*) FROM pix_charges WHERE account_id = $2) AS pix_charge_count,
        (SELECT COUNT(*) FROM pix_transfers WHERE account_id = $2) AS pix_transfer_count,
        (SELECT COUNT(*) FROM cards WHERE billing_account_id = $2) AS card_count,
        (SELECT COUNT(*) FROM card_transactions WHERE account_id = $2) AS card_txn_count`,
      [req.user.id, accountId]
    );

    const counts = refsResult.rows[0];
    const hasLinks = Object.values(counts).some((value) => Number(value) > 0);
    if (hasLinks) {
      return res.status(400).json({
        error: 'Account has linked activity. Clear Pix keys, cards, or transactions before removing.'
      });
    }

    await pool.query('DELETE FROM accounts WHERE id = $1 AND user_id = $2', [
      accountId,
      req.user.id
    ]);

    return res.status(204).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to remove account' });
  }
});

module.exports = router;
