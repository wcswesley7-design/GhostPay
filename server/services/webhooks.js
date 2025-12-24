const crypto = require('crypto');

const { pool } = require('../db');
const { randomId } = require('../lib/ids');

function signPayload(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

async function emitWebhook(userId, type, payload) {
  const client = await pool.connect();
  const createdAt = new Date().toISOString();
  const eventId = randomId('evt');
  let webhooks = [];

  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO webhook_events (id, user_id, type, payload, created_at) VALUES ($1, $2, $3, $4::jsonb, $5)',
      [eventId, userId, type, JSON.stringify(payload), createdAt]
    );
    const result = await client.query(
      "SELECT id, url, secret FROM webhooks WHERE user_id = $1 AND status = 'active'",
      [userId]
    );
    webhooks = result.rows;

    for (const webhook of webhooks) {
      await client.query(
        'INSERT INTO webhook_deliveries (id, webhook_id, event_id, status, attempts, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [randomId('whd'), webhook.id, eventId, 'pending', 0, createdAt]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ghostpay] Webhook event failed.', err);
    return;
  } finally {
    client.release();
  }

  if (!webhooks.length) {
    return;
  }

  const body = JSON.stringify({
    id: eventId,
    type,
    createdAt,
    data: payload
  });

  for (const webhook of webhooks) {
    try {
      const signature = signPayload(webhook.secret, body);
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GhostPay-Signature': `sha256=${signature}`,
          'X-GhostPay-Event': type
        },
        body
      });

      await pool.query(
        `UPDATE webhook_deliveries
         SET status = $1, attempts = attempts + 1, last_response_code = $2, delivered_at = $3
         WHERE webhook_id = $4 AND event_id = $5`,
        [
          response.ok ? 'delivered' : 'failed',
          response.status,
          new Date().toISOString(),
          webhook.id,
          eventId
        ]
      );
    } catch (err) {
      await pool.query(
        `UPDATE webhook_deliveries
         SET status = 'failed', attempts = attempts + 1, last_error = $1
         WHERE webhook_id = $2 AND event_id = $3`,
        [err.message, webhook.id, eventId]
      );
    }
  }
}

module.exports = {
  emitWebhook
};
