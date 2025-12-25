const crypto = require('crypto');

const { pool } = require('../db');
const { randomId } = require('../lib/ids');

const DEFAULT_MAX_ATTEMPTS = 4;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_INTERVAL_MS = 30000;

let scheduled = false;
let workerInterval = null;

function signPayload(secret, payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function buildEventBody(event) {
  return JSON.stringify({
    id: event.id,
    type: event.type,
    createdAt: event.createdAt,
    data: event.payload
  });
}

async function deliverWebhook(delivery) {
  const body = buildEventBody({
    id: delivery.eventId,
    type: delivery.type,
    createdAt: delivery.createdAt,
    payload: delivery.payload
  });

  try {
    const signature = signPayload(delivery.secret, body);
    const response = await fetch(delivery.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-GhostPay-Signature': `sha256=${signature}`,
        'X-GhostPay-Event': delivery.type
      },
      body
    });

    await pool.query(
      `UPDATE webhook_deliveries
       SET status = $1, attempts = attempts + 1, last_response_code = $2, delivered_at = $3
       WHERE id = $4`,
      [response.ok ? 'delivered' : 'failed', response.status, new Date().toISOString(), delivery.id]
    );
  } catch (err) {
    await pool.query(
      `UPDATE webhook_deliveries
       SET status = 'failed', attempts = attempts + 1, last_error = $1
       WHERE id = $2`,
      [err.message, delivery.id]
    );
  }
}

async function processPendingDeliveries(options = {}) {
  const maxAttempts = options.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const limit = options.limit || DEFAULT_BATCH_SIZE;
  const result = await pool.query(
    `SELECT d.id, d.attempts, w.url, w.secret, e.id AS event_id, e.type, e.payload, e.created_at
     FROM webhook_deliveries d
     JOIN webhooks w ON w.id = d.webhook_id
     JOIN webhook_events e ON e.id = d.event_id
     WHERE d.status IN ('pending', 'failed') AND d.attempts < $1
     ORDER BY d.created_at ASC
     LIMIT $2`,
    [maxAttempts, limit]
  );

  for (const row of result.rows) {
    const claim = await pool.query(
      `UPDATE webhook_deliveries
       SET status = 'processing'
       WHERE id = $1 AND status IN ('pending', 'failed')
       RETURNING id`,
      [row.id]
    );
    if (!claim.rows[0]) {
      continue;
    }
    await deliverWebhook({
      id: row.id,
      url: row.url,
      secret: row.secret,
      eventId: row.event_id,
      type: row.type,
      payload: row.payload,
      createdAt: row.created_at
    });
  }
}

function scheduleDeliveryProcessing() {
  if (scheduled) {
    return;
  }
  scheduled = true;
  setTimeout(async () => {
    scheduled = false;
    try {
      await processPendingDeliveries();
    } catch (err) {
      console.error('[ghostpay] Webhook processing failed.', err);
    }
  }, 0);
}

function startWebhookWorker(options = {}) {
  if (workerInterval) {
    return workerInterval;
  }
  const intervalMs = options.intervalMs || DEFAULT_INTERVAL_MS;
  workerInterval = setInterval(() => {
    processPendingDeliveries(options).catch((err) => {
      console.error('[ghostpay] Webhook worker failed.', err);
    });
  }, intervalMs);
  return workerInterval;
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

  if (webhooks.length) {
    scheduleDeliveryProcessing();
  }
}

module.exports = {
  emitWebhook,
  processPendingDeliveries,
  startWebhookWorker
};
