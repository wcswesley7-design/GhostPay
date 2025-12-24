require('dotenv').config();

const bcrypt = require('bcryptjs');

const { pool, initDb } = require('./db');
const { randomId, accountNumber } = require('./lib/ids');

async function seed() {
  await initDb();

  const email = 'demo@ghostpay.local';
  const password = 'ghostpay-demo';
  const now = new Date().toISOString();

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows[0]) {
    console.log('Demo user already exists.');
    return;
  }

  const userId = randomId('usr');
  const primaryId = randomId('acc');
  const vaultId = randomId('acc');

const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO users (id, name, email, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)',
      [userId, 'Demo User', email, bcrypt.hashSync(password, 12), now]
    );
    await client.query(
      'INSERT INTO accounts (id, user_id, name, currency, balance_cents, account_number, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [primaryId, userId, 'Primary Wallet', 'BRL', 125000, accountNumber(), now]
    );
    await client.query(
      'INSERT INTO accounts (id, user_id, name, currency, balance_cents, account_number, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [vaultId, userId, 'Vault', 'BRL', 30000, accountNumber(), now]
    );

    const pixKeyId = randomId('pix');
    await client.query(
      'INSERT INTO pix_keys (id, user_id, type, value, status, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [pixKeyId, userId, 'random', `gp-demo-${randomId('key').slice(0, 8)}`, 'active', now]
    );

    const cardId = randomId('card');
    await client.query(
      'INSERT INTO cards (id, user_id, billing_account_id, type, brand, last4, status, limit_cents, available_cents, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [cardId, userId, primaryId, 'virtual', 'VISA', '4201', 'active', 500000, 500000, now]
    );

    const chargeId = randomId('pixc');
    const txid = randomId('txid').replace('txid_', '').slice(0, 26);
    const chargeExpires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await client.query(
      'INSERT INTO pix_charges (id, user_id, account_id, key_id, amount_cents, description, status, txid, qr_payload, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [
        chargeId,
        userId,
        primaryId,
        pixKeyId,
        8500,
        'Demo Pix charge',
        'pending',
        txid,
        `pix://ghostpay/${txid}?amount=85.00`,
        chargeExpires,
        now
      ]
    );

    await client.query(
      'INSERT INTO transactions (id, user_id, type, amount_cents, from_account_id, to_account_id, counterparty, note, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        randomId('txn'),
        userId,
        'deposit',
        200000,
        null,
        primaryId,
        'Acme Corp',
        'Monthly payout',
        'completed',
        now
      ]
    );

    await client.query(
      'INSERT INTO transactions (id, user_id, type, amount_cents, from_account_id, to_account_id, counterparty, note, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        randomId('txn'),
        userId,
        'payment',
        45000,
        primaryId,
        null,
        'Ghost Telecom',
        'Cloud services',
        'completed',
        now
      ]
    );

    await client.query(
      'INSERT INTO transactions (id, user_id, type, amount_cents, from_account_id, to_account_id, counterparty, note, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        randomId('txn'),
        userId,
        'transfer',
        30000,
        primaryId,
        vaultId,
        null,
        'Vault transfer',
        'completed',
        now
      ]
    );

    await client.query('COMMIT');
    console.log('Demo user created.');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed.', err);
    process.exitCode = 1;
  } finally {
    client.release();
  }
}

seed()
  .catch((err) => {
    console.error('Seed failed.', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
