const express = require('express');
const { z } = require('zod');

const { idempotencyGuard } = require('../middleware/idempotency');
const { validateBody } = require('../middleware/validate');
const { getProvider } = require('../integrations/provider');

const router = express.Router();

const createKeySchema = z.object({
  accountId: z.string().min(1),
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

function pixProvider() {
  return getProvider().pix;
}

function handleProviderError(res, err, fallback) {
  const status = err.status || 500;
  const message = err.status ? err.message : fallback;
  if (!err.status) {
    console.error(err);
  }
  return res.status(status).json({ error: message });
}

router.get('/keys', async (req, res) => {
  try {
    const keys = await pixProvider().listKeys(req.user.id);
    return res.json({ keys });
  } catch (err) {
    return handleProviderError(res, err, 'Unable to load Pix keys');
  }
});

router.post('/keys', idempotencyGuard('pix.keys.create'), validateBody(createKeySchema), async (req, res) => {
  try {
    const key = await pixProvider().createKey(req.user.id, req.body);
    return res.status(201).json({ key });
  } catch (err) {
    return handleProviderError(res, err, 'Unable to create Pix key');
  }
});

router.get('/charges', async (req, res) => {
  try {
    const charges = await pixProvider().listCharges(req.user.id);
    return res.json({ charges });
  } catch (err) {
    return handleProviderError(res, err, 'Unable to load Pix charges');
  }
});

router.post('/charges', idempotencyGuard('pix.charges.create'), validateBody(createChargeSchema), async (req, res) => {
  try {
    const charge = await pixProvider().createCharge(req.user.id, req.body);
    return res.status(201).json({ charge });
  } catch (err) {
    return handleProviderError(res, err, 'Unable to create Pix charge');
  }
});

router.post('/charges/:id/simulate-pay', async (req, res) => {
  try {
    const result = await pixProvider().simulateChargePayment(req.user.id, req.params.id);
    return res.json(result);
  } catch (err) {
    return handleProviderError(res, err, 'Unable to simulate payment');
  }
});

router.get('/transfers', async (req, res) => {
  try {
    const transfers = await pixProvider().listTransfers(req.user.id);
    return res.json({ transfers });
  } catch (err) {
    return handleProviderError(res, err, 'Unable to load Pix transfers');
  }
});

router.post('/transfers', idempotencyGuard('pix.transfers.create'), validateBody(createTransferSchema), async (req, res) => {
  try {
    const result = await pixProvider().createTransfer(req.user.id, req.body);
    return res.status(201).json(result);
  } catch (err) {
    return handleProviderError(res, err, 'Unable to create Pix transfer');
  }
});

module.exports = router;
