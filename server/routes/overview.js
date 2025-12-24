const express = require('express');

const { pool } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [accountsResult, transactionsResult, totalResult] = await Promise.all([
      pool.query(
        'SELECT id, name, currency, balance_cents, account_number, created_at FROM accounts WHERE user_id = $1 ORDER BY created_at DESC',
        [req.user.id]
      ),
      pool.query(
        'SELECT id, type, amount_cents, from_account_id, to_account_id, counterparty, note, status, created_at FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 8',
        [req.user.id]
      ),
      pool.query(
        'SELECT COALESCE(SUM(balance_cents), 0) AS total FROM accounts WHERE user_id = $1',
        [req.user.id]
      )
    ]);

    const accounts = accountsResult.rows.map((account) => ({
      id: account.id,
      name: account.name,
      currency: account.currency,
      balanceCents: account.balance_cents,
      accountNumber: account.account_number,
      createdAt: account.created_at
    }));

    const recentTransactions = transactionsResult.rows.map((row) => ({
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

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [incomeResult, spendResult, countResult] = await Promise.all([
      pool.query(
        "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM transactions WHERE user_id = $1 AND type = 'deposit' AND created_at >= $2",
        [req.user.id, since]
      ),
      pool.query(
        "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM transactions WHERE user_id = $1 AND type IN ('withdrawal', 'payment') AND created_at >= $2",
        [req.user.id, since]
      ),
      pool.query('SELECT COUNT(*) AS total FROM transactions WHERE user_id = $1', [
        req.user.id
      ])
    ]);

    const totalBalanceCents = Number(totalResult.rows[0].total || 0);
    const incomeCents = Number(incomeResult.rows[0].total || 0);
    const spendCents = Number(spendResult.rows[0].total || 0);
    const transactionCount = Number(countResult.rows[0].total || 0);

    return res.json({
      accounts,
      recentTransactions,
      metrics: {
        totalBalanceCents,
        incomeCents,
        spendCents,
        netCents: incomeCents - spendCents,
        transactionCount,
        periodDays: 30
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load overview' });
  }
});

module.exports = router;
