const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ghostpay';

if (!process.env.DATABASE_URL) {
  console.warn('[ghostpay] DATABASE_URL not set. Using local default.');
}

const pool = new Pool({ connectionString });

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        currency TEXT NOT NULL,
        balance_cents INTEGER NOT NULL DEFAULT 0,
        account_number TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        from_account_id TEXT REFERENCES accounts(id),
        to_account_id TEXT REFERENCES accounts(id),
        counterparty TEXT,
        note TEXT,
        reference_type TEXT,
        reference_id TEXT,
        metadata JSONB,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_type TEXT;');
    await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference_id TEXT;');
    await client.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS metadata JSONB;');

    await client.query(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
        direction TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        balance_after_cents INTEGER NOT NULL,
        memo TEXT,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pix_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        value TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pix_charges (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        key_id TEXT REFERENCES pix_keys(id),
        amount_cents INTEGER NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        txid TEXT NOT NULL,
        qr_payload TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        paid_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pix_transfers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        key_type TEXT NOT NULL,
        key_value TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        description TEXT,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        billing_account_id TEXT NOT NULL REFERENCES accounts(id),
        type TEXT NOT NULL,
        brand TEXT NOT NULL,
        last4 TEXT NOT NULL,
        status TEXT NOT NULL,
        limit_cents INTEGER NOT NULL,
        available_cents INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS card_transactions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        amount_cents INTEGER NOT NULL,
        merchant TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        secret TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY,
        webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        last_response_code INTEGER,
        created_at TIMESTAMPTZ NOT NULL,
        delivered_at TIMESTAMPTZ
      );
    `);

    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_transactions_from ON transactions(from_account_id);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_transactions_to ON transactions(to_account_id);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_id);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_ledger_transaction ON ledger_entries(transaction_id);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_pix_keys_user ON pix_keys(user_id);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_pix_charges_user ON pix_charges(user_id);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_pix_transfers_user ON pix_transfers(user_id);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_cards_user ON cards(user_id);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_card_transactions_user ON card_transactions(user_id);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhooks(user_id);'
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDb
};
