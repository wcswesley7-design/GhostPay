const express = require('express');
const { z } = require('zod');

const { validateBody } = require('../middleware/validate');
const { createApiKey, listApiKeys, revokeApiKey } = require('../services/apiKeys');

const router = express.Router();

const createSchema = z.object({
  label: z.string().max(80).optional()
});

router.get('/', async (req, res) => {
  try {
    const keys = await listApiKeys(req.user.id);
    return res.json({ keys });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load API keys' });
  }
});

router.post('/', validateBody(createSchema), async (req, res) => {
  try {
    const key = await createApiKey(req.user.id, req.body.label);
    return res.status(201).json({ key });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to create API key' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const revoked = await revokeApiKey(req.user.id, req.params.id);
    if (!revoked) {
      return res.status(404).json({ error: 'API key not found' });
    }
    return res.json({ status: 'revoked' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to revoke API key' });
  }
});

module.exports = router;
