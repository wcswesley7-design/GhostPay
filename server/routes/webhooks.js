const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');

const { pool } = require('../db');
const { randomId } = require('../lib/ids');
const { idempotencyGuard } = require('../middleware/idempotency');
const { validateBody } = require('../middleware/validate');
const { emitWebhook } = require('../services/webhooks');

const router = express.Router();

const createWebhookSchema = z.object({
  url: z.string().url(),
  secret: z.string().min(8).max(120).optional()
});

function generateSecret() {
  return crypto.randomBytes(24).toString('hex');
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, url, status, created_at FROM webhooks WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    const webhooks = result.rows.map((row) => ({
      id: row.id,
      url: row.url,
      status: row.status,
      createdAt: row.created_at
    }));
    return res.json({ webhooks });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load webhooks' });
  }
});

router.post('/', idempotencyGuard('webhooks.create'), validateBody(createWebhookSchema), async (req, res) => {
  const webhookId = randomId('wh');
  const now = new Date().toISOString();
  const secret = req.body.secret || generateSecret();

  try {
    await pool.query(
      'INSERT INTO webhooks (id, user_id, url, secret, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [webhookId, req.user.id, req.body.url, secret, 'active', now]
    );

    return res.status(201).json({
      webhook: {
        id: webhookId,
        url: req.body.url,
        status: 'active',
        secret,
        createdAt: now
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to create webhook' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE webhooks SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING id',
      ['disabled', req.params.id, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    return res.json({ status: 'disabled' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to disable webhook' });
  }
});

router.post('/:id/test', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id FROM webhooks WHERE id = $1 AND user_id = $2 AND status = 'active'",
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    emitWebhook(req.user.id, 'webhook.test', {
      message: 'GhostPay webhook test',
      webhookId: req.params.id
    });
    return res.json({ status: 'queued' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to send test webhook' });
  }
});

router.get('/events', async (req, res) => {
  try {
    const eventsResult = await pool.query(
      'SELECT id, type, payload, created_at FROM webhook_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    const deliveriesResult = await pool.query(
      `SELECT d.id, d.webhook_id, d.event_id, d.status, d.attempts, d.last_error, d.last_response_code, d.created_at, d.delivered_at
       FROM webhook_deliveries d
       JOIN webhooks w ON w.id = d.webhook_id
       WHERE w.user_id = $1
       ORDER BY d.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    return res.json({
      events: eventsResult.rows.map((row) => ({
        id: row.id,
        type: row.type,
        payload: row.payload,
        createdAt: row.created_at
      })),
      deliveries: deliveriesResult.rows.map((row) => ({
        id: row.id,
        webhookId: row.webhook_id,
        eventId: row.event_id,
        status: row.status,
        attempts: row.attempts,
        lastError: row.last_error,
        lastResponseCode: row.last_response_code,
        createdAt: row.created_at,
        deliveredAt: row.delivered_at
      }))
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load webhook events' });
  }
});

module.exports = router;
