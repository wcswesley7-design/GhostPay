const crypto = require('crypto');
const express = require('express');

const { config } = require('../config');
const { pool } = require('../db');
const { randomId } = require('../lib/ids');

const router = express.Router();

function getSignatureHeader(req) {
  const header = config.dock.webhookSignatureHeader || 'x-dock-signature';
  return req.get(header);
}

function parseSignature(value) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const parts = trimmed.split('=');
  if (parts.length === 2 && parts[0].toLowerCase().includes('sha')) {
    return parts[1];
  }
  return trimmed;
}

function computeSignature(secret, payload) {
  const format = (config.dock.webhookSignatureFormat || 'hex').toLowerCase();
  const encoding = format === 'base64' ? 'base64' : 'hex';
  const digest = crypto.createHmac('sha256', secret).update(payload).digest(encoding);
  return digest;
}

function safeEqual(left, right) {
  if (!left || !right) {
    return false;
  }
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getRawBody(req) {
  if (req.rawBody) {
    return req.rawBody.toString('utf8');
  }
  if (req.body && Object.keys(req.body).length > 0) {
    return JSON.stringify(req.body);
  }
  return '';
}

function extractEventId(payload) {
  return (
    payload.id ||
    payload.eventId ||
    payload.event_id ||
    payload.webhookId ||
    null
  );
}

function extractEventType(payload) {
  return payload.type || payload.eventType || payload.event_type || null;
}

router.post('/', async (req, res) => {
  if (!config.dock.webhookSecret) {
    return res.status(503).json({ error: 'dock_webhook_not_configured' });
  }

  const signatureHeader = getSignatureHeader(req);
  const signature = parseSignature(signatureHeader);
  const rawBody = getRawBody(req);
  if (!signature || !rawBody) {
    return res.status(400).json({ error: 'invalid_signature' });
  }

  const expected = computeSignature(config.dock.webhookSecret, rawBody);
  if (!safeEqual(signature, expected)) {
    return res.status(401).json({ error: 'signature_mismatch' });
  }

  const payload = req.body || {};
  const eventId = extractEventId(payload);
  const eventType = extractEventType(payload);
  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const receivedAt = new Date().toISOString();

  try {
    const result = await pool.query(
      `INSERT INTO dock_webhook_events (
        id, event_id, event_type, payload, payload_hash, status, received_at
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
      ON CONFLICT DO NOTHING
      RETURNING id`,
      [
        randomId('dwe'),
        eventId,
        eventType,
        JSON.stringify(payload),
        payloadHash,
        'received',
        receivedAt
      ]
    );

    if (!result.rows[0]) {
      return res.json({ status: 'duplicate' });
    }

    return res.json({ status: 'received' });
  } catch (err) {
    console.error('[ghostpay] Dock webhook insert failed.', err);
    return res.status(500).json({ error: 'dock_webhook_failed' });
  }
});

module.exports = router;
