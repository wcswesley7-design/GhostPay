const { pool } = require('../db');
const { randomId, accountNumber } = require('../lib/ids');

async function ensureMerchantAccount(userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT id, name, currency, balance_cents, hold_cents, account_number, created_at FROM accounts WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1 FOR UPDATE',
      [userId]
    );
    if (existing.rows[0]) {
      await client.query('COMMIT');
      return existing.rows[0];
    }

    const accountId = randomId('acc');
    const now = new Date().toISOString();
    const accountNum = accountNumber();
    await client.query(
      'INSERT INTO accounts (id, user_id, name, currency, balance_cents, hold_cents, account_number, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [accountId, userId, 'Merchant Wallet', 'BRL', 0, 0, accountNum, now]
    );
    await client.query('COMMIT');
    return {
      id: accountId,
      name: 'Merchant Wallet',
      currency: 'BRL',
      balance_cents: 0,
      hold_cents: 0,
      account_number: accountNum,
      created_at: now
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  ensureMerchantAccount
};
