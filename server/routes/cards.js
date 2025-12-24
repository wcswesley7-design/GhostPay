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

const createCardSchema = z.object({
  accountId: z.string().min(1),
  type: z.enum(['virtual', 'physical']).default('virtual'),
  limit: z.union([z.string(), z.number()]).optional()
});

const cardTransactionSchema = z.object({
  amount: z.union([z.string(), z.number()]),
  merchant: z.string().min(2).max(80)
});

function generateLast4() {
  return crypto.randomInt(1000, 9999).toString();
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, billing_account_id, type, brand, last4, status, limit_cents, available_cents, created_at FROM cards WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    const cards = result.rows.map((row) => ({
      id: row.id,
      billingAccountId: row.billing_account_id,
      type: row.type,
      brand: row.brand,
      last4: row.last4,
      status: row.status,
      limitCents: row.limit_cents,
      availableCents: row.available_cents,
      createdAt: row.created_at
    }));
    return res.json({ cards });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load cards' });
  }
});

router.post('/', validateBody(createCardSchema), async (req, res) => {
  const limitCents = req.body.limit ? parseAmountToCents(req.body.limit) : 500000;
  if (!limitCents || limitCents <= 0) {
    return res.status(400).json({ error: 'Invalid limit' });
  }

  try {
    const accountResult = await pool.query(
      'SELECT id FROM accounts WHERE id = $1 AND user_id = $2',
      [req.body.accountId, req.user.id]
    );
    if (!accountResult.rows[0]) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const cardId = randomId('card');
    const now = new Date().toISOString();
    const last4 = generateLast4();

    await pool.query(
      `INSERT INTO cards (
        id, user_id, billing_account_id, type, brand, last4, status, limit_cents, available_cents, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        cardId,
        req.user.id,
        req.body.accountId,
        req.body.type,
        'VISA',
        last4,
        'active',
        limitCents,
        limitCents,
        now
      ]
    );

    emitWebhook(req.user.id, 'card.created', {
      id: cardId,
      last4,
      type: req.body.type
    });

    return res.status(201).json({
      card: {
        id: cardId,
        billingAccountId: req.body.accountId,
        type: req.body.type,
        brand: 'VISA',
        last4,
        status: 'active',
        limitCents,
        availableCents: limitCents,
        createdAt: now
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to create card' });
  }
});

router.get('/:id/transactions', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, card_id, account_id, amount_cents, merchant, status, created_at
       FROM card_transactions
       WHERE user_id = $1 AND card_id = $2
       ORDER BY created_at DESC`,
      [req.user.id, req.params.id]
    );
    const transactions = result.rows.map((row) => ({
      id: row.id,
      cardId: row.card_id,
      accountId: row.account_id,
      amountCents: row.amount_cents,
      merchant: row.merchant,
      status: row.status,
      createdAt: row.created_at
    }));
    return res.json({ transactions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load card transactions' });
  }
});

router.post('/:id/transactions', validateBody(cardTransactionSchema), async (req, res) => {
  const amountCents = parseAmountToCents(req.body.amount);
  if (!amountCents || amountCents <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const cardResult = await client.query(
      'SELECT * FROM cards WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [req.params.id, req.user.id]
    );
    const card = cardResult.rows[0];
    if (!card) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Card not found' });
    }
    if (card.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Card not active' });
    }
    if (card.available_cents < amountCents) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Card limit exceeded' });
    }

    const updatedAvailable = card.available_cents - amountCents;
    await client.query(
      'UPDATE cards SET available_cents = $1 WHERE id = $2',
      [updatedAvailable, card.id]
    );

    const cardTxnId = randomId('ctx');
    const now = new Date().toISOString();

    await client.query(
      `INSERT INTO card_transactions (
        id, user_id, card_id, account_id, amount_cents, merchant, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        cardTxnId,
        req.user.id,
        card.id,
        card.billing_account_id,
        amountCents,
        req.body.merchant.trim(),
        'settled',
        now
      ]
    );

    const ledgerResult = await recordTransaction(client, {
      userId: req.user.id,
      type: 'payment',
      amountCents,
      fromAccountId: card.billing_account_id,
      counterparty: req.body.merchant.trim(),
      note: `Card ${card.last4}`,
      referenceType: 'card_transaction',
      referenceId: cardTxnId,
      metadata: { cardId: card.id }
    });

    await client.query('COMMIT');

    emitWebhook(req.user.id, 'card.transaction.settled', {
      id: cardTxnId,
      cardId: card.id,
      amountCents,
      merchant: req.body.merchant
    });

    return res.status(201).json({
      transaction: {
        id: cardTxnId,
        cardId: card.id,
        accountId: card.billing_account_id,
        amountCents,
        merchant: req.body.merchant.trim(),
        status: 'settled',
        createdAt: now
      },
      card: {
        id: card.id,
        availableCents: updatedAvailable
      },
      transactionId: ledgerResult.id
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
    }
    const message = err.message;
    if (message === 'insufficient_funds') {
      return res.status(400).json({ error: 'Insufficient funds' });
    }
    if (message === 'from_account_not_found') {
      return res.status(404).json({ error: 'Billing account not found' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Unable to create card transaction' });
  } finally {
    if (client) {
      client.release();
    }
  }
});

module.exports = router;
