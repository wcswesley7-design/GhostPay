const crypto = require('crypto');

const { pool } = require('../db');
const { randomId } = require('../lib/ids');

function getIdempotencyKey(req) {
  return req.get('Idempotency-Key') || req.get('X-Idempotency-Key');
}

function hashRequestBody(body) {
  if (!body || Object.keys(body).length === 0) {
    return 'empty';
  }
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex');
}

function normalizeResponseBody(body) {
  if (Buffer.isBuffer(body)) {
    return body.toString('utf8');
  }
  if (body === undefined) {
    return null;
  }
  return body;
}

function idempotencyGuard(operation) {
  return async (req, res, next) => {
    const key = getIdempotencyKey(req);
    if (!key) {
      return next();
    }
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requestHash = hashRequestBody(req.body);
    const now = new Date().toISOString();
    const method = req.method.toUpperCase();

    try {
      const insert = await pool.query(
        `INSERT INTO idempotency_keys (
          id, user_id, idem_key, operation, method, request_hash, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, idem_key, operation, method) DO NOTHING
        RETURNING id`,
        [randomId('idem'), req.user.id, key, operation, method, requestHash, now, now]
      );

      if (!insert.rows[0]) {
        const existing = await pool.query(
          `SELECT request_hash, response_status, response_body
           FROM idempotency_keys
           WHERE user_id = $1 AND idem_key = $2 AND operation = $3 AND method = $4`,
          [req.user.id, key, operation, method]
        );
        const record = existing.rows[0];
        if (!record) {
          return next();
        }
        if (record.request_hash !== requestHash) {
          return res.status(409).json({ error: 'idempotency_key_conflict' });
        }
        if (record.response_status) {
          return res.status(record.response_status).json(record.response_body || {});
        }
        return res.status(409).json({ error: 'idempotency_in_progress' });
      }
    } catch (err) {
      return next(err);
    }

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let responseBody;

    res.json = (body) => {
      responseBody = normalizeResponseBody(body);
      return originalJson(body);
    };

    res.send = (body) => {
      responseBody = normalizeResponseBody(body);
      return originalSend(body);
    };

    res.on('finish', async () => {
      if (res.statusCode >= 500) {
        return;
      }
      try {
        await pool.query(
          `UPDATE idempotency_keys
           SET response_status = $1, response_body = $2::jsonb, updated_at = $3
           WHERE user_id = $4 AND idem_key = $5 AND operation = $6 AND method = $7`,
          [
            res.statusCode,
            JSON.stringify(responseBody),
            new Date().toISOString(),
            req.user.id,
            key,
            operation,
            method
          ]
        );
      } catch (err) {
        console.error('[ghostpay] idempotency update failed', err);
      }
    });

    return next();
  };
}

module.exports = {
  idempotencyGuard
};
