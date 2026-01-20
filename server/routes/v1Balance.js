const express = require('express');

const { pool } = require('../db');
const { merchantAuth } = require('../middleware/merchantAuth');
const { ensureMerchantAccount } = require('../services/merchantAccounts');

const router = express.Router();

router.use(merchantAuth);

router.get('/balance', async (req, res) => {
  try {
    const account = await ensureMerchantAccount(req.user.id);
    const balanceCents = Number(account.balance_cents || 0);
    const holdCents = Number(account.hold_cents || 0);
    const availableCents = balanceCents - holdCents;

    const pendingResult = await pool.query(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total
       FROM pix_charges
       WHERE user_id = $1 AND status IN ('created', 'waiting_payment')`,
      [req.user.id]
    );
    const pendingInCents = Number(pendingResult.rows[0].total || 0);

    return res.json({
      balance: {
        total_cents: balanceCents,
        available_cents: availableCents,
        hold_cents: holdCents,
        pending_in_cents: pendingInCents
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load balance' });
  }
});

module.exports = router;
