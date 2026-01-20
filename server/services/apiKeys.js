const crypto = require('crypto');

const { pool } = require('../db');
const { randomId } = require('../lib/ids');

function generateApiKey() {
  return `gpk_${crypto.randomBytes(24).toString('hex')}`;
}

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function createApiKey(userId, label) {
  const apiKey = generateApiKey();
  const keyHash = hashApiKey(apiKey);
  const now = new Date().toISOString();
  const id = randomId('key');

  await pool.query(
    'INSERT INTO api_keys (id, user_id, key_hash, label, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, userId, keyHash, label || null, 'active', now]
  );

  return {
    id,
    key: apiKey,
    label: label || null,
    status: 'active',
    createdAt: now
  };
}

async function listApiKeys(userId) {
  const result = await pool.query(
    'SELECT id, label, status, created_at, last_used_at, revoked_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    label: row.label,
    status: row.status,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at
  }));
}

async function revokeApiKey(userId, keyId) {
  const now = new Date().toISOString();
  const result = await pool.query(
    'UPDATE api_keys SET status = $1, revoked_at = $2 WHERE id = $3 AND user_id = $4 AND status = $5 RETURNING id',
    ['revoked', now, keyId, userId, 'active']
  );
  return result.rows[0] || null;
}

async function findApiKey(key) {
  const keyHash = hashApiKey(key);
  const result = await pool.query(
    `SELECT k.id, k.user_id, k.status, k.revoked_at, u.email, u.name
     FROM api_keys k
     JOIN users u ON u.id = k.user_id
     WHERE k.key_hash = $1
     LIMIT 1`,
    [keyHash]
  );
  const row = result.rows[0];
  if (!row || row.status !== 'active' || row.revoked_at) {
    return null;
  }
  await pool.query('UPDATE api_keys SET last_used_at = $1 WHERE id = $2', [
    new Date().toISOString(),
    row.id
  ]);
  return {
    id: row.id,
    user: {
      id: row.user_id,
      email: row.email,
      name: row.name
    }
  };
}

module.exports = {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  findApiKey
};
