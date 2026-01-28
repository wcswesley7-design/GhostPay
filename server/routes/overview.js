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

router.get('/financial', async (req, res) => {
  try {
    const results = await pool.query(
      `
      WITH months AS (
        SELECT generate_series(
          date_trunc('month', now()) - interval '11 months',
          date_trunc('month', now()),
          interval '1 month'
        ) AS month
      ),
      pix AS (
        SELECT date_trunc('month', created_at) AS month,
               SUM(CASE WHEN status = 'paid' THEN amount_cents ELSE 0 END) AS revenue_cents,
               SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paid_count,
               SUM(CASE WHEN status IN ('created', 'waiting_payment') THEN 1 ELSE 0 END) AS pending_count
        FROM pix_charges
        WHERE user_id = $1
          AND created_at >= date_trunc('month', now()) - interval '11 months'
        GROUP BY 1
      ),
      outflow AS (
        SELECT date_trunc('month', created_at) AS month,
               SUM(CASE WHEN type IN ('withdrawal', 'payment') THEN amount_cents ELSE 0 END) AS outflow_cents
        FROM transactions
        WHERE user_id = $1
          AND created_at >= date_trunc('month', now()) - interval '11 months'
        GROUP BY 1
      )
      SELECT months.month,
             COALESCE(pix.revenue_cents, 0) AS revenue_cents,
             COALESCE(pix.paid_count, 0) AS paid_count,
             COALESCE(pix.pending_count, 0) AS pending_count,
             COALESCE(outflow.outflow_cents, 0) AS outflow_cents
      FROM months
      LEFT JOIN pix ON months.month = pix.month
      LEFT JOIN outflow ON months.month = outflow.month
      ORDER BY months.month;
      `,
      [req.user.id]
    );

    const series = results.rows.map((row) => ({
      month: row.month,
      revenueCents: Number(row.revenue_cents || 0),
      paidCount: Number(row.paid_count || 0),
      pendingCount: Number(row.pending_count || 0),
      outflowCents: Number(row.outflow_cents || 0)
    }));

    const totals = series.reduce(
      (acc, item) => {
        acc.revenueCents += item.revenueCents;
        acc.outflowCents += item.outflowCents;
        acc.paidCount += item.paidCount;
        acc.pendingCount += item.pendingCount;
        return acc;
      },
      { revenueCents: 0, outflowCents: 0, paidCount: 0, pendingCount: 0 }
    );

    return res.json({ series, totals });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load financial overview' });
  }
});

module.exports = router;
