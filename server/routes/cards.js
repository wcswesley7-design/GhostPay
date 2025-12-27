const express = require('express');
const { z } = require('zod');

const { idempotencyGuard } = require('../middleware/idempotency');
const { validateBody } = require('../middleware/validate');
const { getProvider } = require('../integrations/provider');

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

function cardProvider() {
  return getProvider().cards;
}

function handleProviderError(res, err, fallback) {
  const status = err.status || 500;
  const message = err.status ? err.message : fallback;
  if (!err.status) {
    console.error(err);
  }
  return res.status(status).json({ error: message });
}

router.get('/', async (req, res) => {
  try {
    const cards = await cardProvider().listCards(req.user.id);
    return res.json({ cards });
  } catch (err) {
    return handleProviderError(res, err, 'Unable to load cards');
  }
});

router.post('/', idempotencyGuard('cards.create'), validateBody(createCardSchema), async (req, res) => {
  try {
    const card = await cardProvider().createCard(req.user.id, req.body);
    return res.status(201).json({ card });
  } catch (err) {
    return handleProviderError(res, err, 'Unable to create card');
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await cardProvider().deleteCard(req.user.id, req.params.id);
    return res.status(204).end();
  } catch (err) {
    return handleProviderError(res, err, 'Unable to remove card');
  }
});

router.get('/:id/transactions', async (req, res) => {
  try {
    const transactions = await cardProvider().listCardTransactions(req.user.id, req.params.id);
    return res.json({ transactions });
  } catch (err) {
    return handleProviderError(res, err, 'Unable to load card transactions');
  }
});

router.post('/:id/transactions', idempotencyGuard('cards.transactions.create'), validateBody(cardTransactionSchema), async (req, res) => {
  try {
    const result = await cardProvider().createCardTransaction(req.user.id, req.params.id, req.body);
    return res.status(201).json(result);
  } catch (err) {
    return handleProviderError(res, err, 'Unable to create card transaction');
  }
});

module.exports = router;
