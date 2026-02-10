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
        cpf TEXT,
        password_hash TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'free',
        created_at TIMESTAMPTZ NOT NULL
      );
    `);

    await client.query(
      'ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf TEXT;'
    );
    await client.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';"
    );
    await client.query("ALTER TABLE users ALTER COLUMN plan SET DEFAULT 'free';");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS mcc TEXT;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address_cep TEXT;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address_street TEXT;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address_number TEXT;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address_neighborhood TEXT;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address_complement TEXT;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address_city TEXT;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS address_state TEXT;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_meta JSONB DEFAULT '{}'::jsonb;");

    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        currency TEXT NOT NULL,
        balance_cents INTEGER NOT NULL DEFAULT 0,
        hold_cents INTEGER NOT NULL DEFAULT 0,
        account_number TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);
    await client.query(
      'ALTER TABLE accounts ADD COLUMN IF NOT EXISTS hold_cents INTEGER NOT NULL DEFAULT 0;'
    );

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
        account_id TEXT REFERENCES accounts(id),
        type TEXT NOT NULL,
        value TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );
    `);
    await client.query('ALTER TABLE pix_keys ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES accounts(id);');

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
        qr_code_base64 TEXT,
        ticket_url TEXT,
        provider TEXT NOT NULL DEFAULT 'local',
        provider_payment_id TEXT,
        provider_status TEXT,
        payer_name TEXT,
        payer_email TEXT,
        payer_document TEXT,
        payer_phone TEXT,
        external_reference TEXT,
        archived_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        paid_at TIMESTAMPTZ
      );
    `);
    await client.query('ALTER TABLE pix_charges ADD COLUMN IF NOT EXISTS qr_code_base64 TEXT;');
    await client.query('ALTER TABLE pix_charges ADD COLUMN IF NOT EXISTS ticket_url TEXT;');
    await client.query(
      "ALTER TABLE pix_charges ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'local';"
    );
    await client.query(
      'ALTER TABLE pix_charges ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;'
    );
    await client.query(
      'ALTER TABLE pix_charges ADD COLUMN IF NOT EXISTS provider_status TEXT;'
    );
    await client.query(
      'ALTER TABLE pix_charges ADD COLUMN IF NOT EXISTS provider_checked_at TIMESTAMPTZ;'
    );
    await client.query('ALTER TABLE pix_charges ADD COLUMN IF NOT EXISTS payer_name TEXT;');
    await client.query('ALTER TABLE pix_charges ADD COLUMN IF NOT EXISTS payer_email TEXT;');
    await client.query(
      'ALTER TABLE pix_charges ADD COLUMN IF NOT EXISTS payer_document TEXT;'
    );
    await client.query('ALTER TABLE pix_charges ADD COLUMN IF NOT EXISTS payer_phone TEXT;');
    await client.query(
      'ALTER TABLE pix_charges ADD COLUMN IF NOT EXISTS external_reference TEXT;'
    );
    await client.query('ALTER TABLE pix_charges ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;');
    await client.query('ALTER TABLE pix_charges ALTER COLUMN qr_payload DROP NOT NULL;');

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

    await client.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS cancel_requested_at TIMESTAMPTZ;');
    await client.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;');
    await client.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS canceled_by TEXT;');
    await client.query('ALTER TABLE cards ADD COLUMN IF NOT EXISTS cancel_note TEXT;');

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
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key_hash TEXT NOT NULL UNIQUE,
        label TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        last_used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_sessions (
        id TEXT PRIMARY KEY,
        mp_preapproval_id TEXT UNIQUE,
        mp_payment_id TEXT UNIQUE,
        plan TEXT NOT NULL,
        status TEXT NOT NULL,
        payer_name TEXT NOT NULL,
        payer_email TEXT NOT NULL,
        payer_phone TEXT,
        payer_document TEXT,
        pix_payload JSONB,
        user_id TEXT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL,
        approved_at TIMESTAMPTZ
      );
    `);

    await client.query(
      'ALTER TABLE subscription_sessions ADD COLUMN IF NOT EXISTS mp_payment_id TEXT UNIQUE;'
    );
    await client.query(
      'ALTER TABLE subscription_sessions ADD COLUMN IF NOT EXISTS payer_document TEXT;'
    );
    await client.query(
      'ALTER TABLE subscription_sessions ADD COLUMN IF NOT EXISTS pix_payload JSONB;'
    );

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
      CREATE TABLE IF NOT EXISTS withdrawal_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        amount_cents INTEGER NOT NULL,
        pix_key_type TEXT NOT NULL,
        pix_key TEXT NOT NULL,
        status TEXT NOT NULL,
        admin_note TEXT,
        proof_url TEXT,
        requested_at TIMESTAMPTZ NOT NULL,
        processed_at TIMESTAMPTZ,
        paid_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS mercadopago_webhook_events (
        id TEXT PRIMARY KEY,
        event_id TEXT,
        payment_id TEXT,
        payload JSONB NOT NULL,
        payload_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        received_at TIMESTAMPTZ NOT NULL,
        processed_at TIMESTAMPTZ,
        error TEXT
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        idem_key TEXT NOT NULL,
        operation TEXT NOT NULL,
        method TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        response_status INTEGER,
        response_body JSONB,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        UNIQUE (user_id, idem_key, operation, method)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS dock_webhook_events (
        id TEXT PRIMARY KEY,
        event_id TEXT,
        event_type TEXT,
        payload JSONB NOT NULL,
        payload_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        received_at TIMESTAMPTZ NOT NULL,
        processed_at TIMESTAMPTZ,
        error TEXT
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
      'CREATE INDEX IF NOT EXISTS idx_pix_keys_account ON pix_keys(account_id);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_pix_charges_user ON pix_charges(user_id);'
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_pix_charges_status ON pix_charges(user_id, status);"
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_pix_charges_active ON pix_charges(user_id, created_at DESC) WHERE archived_at IS NULL;'
    );
    await client.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_pix_charges_provider_payment ON pix_charges(provider_payment_id) WHERE provider_payment_id IS NOT NULL;'
    );
    await client.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_type, reference_id) WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;'
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
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_idempotency_user ON idempotency_keys(user_id);'
    );
    await client.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_dock_webhook_hash ON dock_webhook_events(payload_hash);'
    );
    await client.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_dock_webhook_event ON dock_webhook_events(event_id) WHERE event_id IS NOT NULL;"
    );
    await client.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_webhook_hash ON mercadopago_webhook_events(payload_hash);'
    );
    await client.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_webhook_event ON mercadopago_webhook_events(event_id) WHERE event_id IS NOT NULL;"
    );
    await client.query(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_mp_webhook_payment ON mercadopago_webhook_events(payment_id) WHERE payment_id IS NOT NULL;"
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawal_requests(user_id);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawal_requests(status);'
    );
    await client.query(
      'CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);'
    );
    await client.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cpf ON users(cpf) WHERE cpf IS NOT NULL;'
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
