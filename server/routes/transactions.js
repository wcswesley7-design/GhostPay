const express = require('express');
const { z } = require('zod');

const { pool } = require('../db');
const { parseAmountToCents } = require('../lib/money');
const { recordTransaction } = require('../services/ledger');
const { idempotencyGuard } = require('../middleware/idempotency');
const { validateBody, validateQuery } = require('../middleware/validate');

const router = express.Router();

const transactionSchema = z.object({
  type: z.enum(['deposit', 'withdrawal', 'transfer', 'payment']),
  amount: z.union([z.string(), z.number()]),
  fromAccountId: z.string().min(1).optional(),
  toAccountId: z.string().min(1).optional(),
  counterparty: z.string().max(80).optional(),
  note: z.string().max(160).optional()
});

const querySchema = z.object({
  accountId: z.string().min(1).optional(),
  limit: z.string().optional()
});

function buildAccountResponse(account, balanceCents) {
  if (!account) {
    return null;
  }

  return {
    id: account.id,
    name: account.name,
    currency: account.currency,
    balanceCents
  };
}

router.get('/', validateQuery(querySchema), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const accountId = req.query.accountId;

  try {
    const result = accountId
      ? await pool.query(
          `SELECT id, type, amount_cents, from_account_id, to_account_id, counterparty, note, status, created_at
           FROM transactions
           WHERE user_id = $1 AND (from_account_id = $2 OR to_account_id = $2)
           ORDER BY created_at DESC
           LIMIT $3`,
          [req.user.id, accountId, limit]
        )
      : await pool.query(
          `SELECT id, type, amount_cents, from_account_id, to_account_id, counterparty, note, status, created_at
           FROM transactions
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2`,
          [req.user.id, limit]
        );

    const transactions = result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      amountCents: row.amount_cents,
      fromAccountId: row.from_account_id,
      toAccountId: row.to_account_id,
      counterparty: row.counterparty,
      note: row.note,
      status: row.status,
      createdAt: row.created_at
    }));

    return res.json({ transactions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load transactions' });
  }
});

router.post('/', idempotencyGuard('transactions.create'), validateBody(transactionSchema), async (req, res) => {
  const amountCents = parseAmountToCents(req.body.amount);
  if (!amountCents || amountCents <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const { type, fromAccountId, toAccountId, counterparty, note } = req.body;

  if (type === 'payment' && (!counterparty || !counterparty.trim())) {
    return res.status(400).json({ error: 'Counterparty required for payments' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const result = await recordTransaction(client, {
      userId: req.user.id,
      type,
      amountCents,
      fromAccountId,
      toAccountId,
      counterparty: counterparty ? counterparty.trim() : null,
      note: note ? note.trim() : null
    });

    await client.query('COMMIT');

    return res.status(201).json({
      transaction: {
        id: result.id,
        type,
        amountCents,
        fromAccountId: result.fromAccount ? result.fromAccount.id : null,
        toAccountId: result.toAccount ? result.toAccount.id : null,
        counterparty: counterparty ? counterparty.trim() : null,
        note: note ? note.trim() : null,
        status: 'completed',
        createdAt: result.createdAt
      },
      accounts: [
        buildAccountResponse(result.fromAccount, result.fromAccount ? result.fromAccount.balance_cents : null),
        buildAccountResponse(result.toAccount, result.toAccount ? result.toAccount.balance_cents : null)
      ].filter(Boolean)
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    const message = err.message;
    if (message === 'from_account_not_found' || message === 'to_account_not_found') {
      return res.status(404).json({ error: 'Account not found' });
    }
    if (message === 'to_account_required' || message === 'from_account_required') {
      return res.status(400).json({ error: 'Missing account reference' });
    }
    if (message === 'transfer_accounts_required') {
      return res.status(400).json({ error: 'Transfer needs both accounts' });
    }
    if (message === 'same_account') {
      return res.status(400).json({ error: 'Transfer requires two different accounts' });
    }
    if (message === 'currency_mismatch') {
      return res.status(400).json({ error: 'Accounts must share the same currency' });
    }
    if (message === 'insufficient_funds') {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    console.error(err);
    return res.status(500).json({ error: 'Unable to create transaction' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
