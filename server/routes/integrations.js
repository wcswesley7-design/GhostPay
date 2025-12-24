const express = require('express');

const { config, dockConfigured } = require('../config');
const { fetchAccessToken } = require('../integrations/dockClient');

const router = express.Router();

router.get('/dock', (req, res) => {
  return res.json({
    mode: config.dock.mode,
    ready: dockConfigured(),
    baseUrl: Boolean(config.dock.baseUrl),
    tokenUrl: Boolean(config.dock.tokenUrl),
    clientId: Boolean(config.dock.clientId),
    clientSecret: Boolean(config.dock.clientSecret),
    webhookSecret: Boolean(config.dock.webhookSecret)
  });
});

router.post('/dock/test', async (req, res) => {
  try {
    await fetchAccessToken();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'dock_test_failed' });
  }
});

module.exports = router;
