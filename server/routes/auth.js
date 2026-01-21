const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const { pool } = require('../db');
const { randomId, accountNumber } = require('../lib/ids');
const { validateBody } = require('../middleware/validate');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  password: z.string().min(8).max(128),
  plan: z.enum(['infinity']),
  subscriptionSession: z.string().min(1)
});

const loginSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(8).max(128)
});

function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

async function findUserByEmail(email) {
  const result = await pool.query(
    'SELECT id, name, email, password_hash, plan FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
}

router.post('/register', validateBody(registerSchema), async (req, res) => {
  const name = req.body.name.trim();
  const email = req.body.email.trim().toLowerCase();
  const password = req.body.password;
  const plan = req.body.plan;
  const subscriptionSession = req.body.subscriptionSession;

  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const userId = randomId('usr');
    const accountId = randomId('acc');
    const accountNum = accountNumber();
    const now = new Date().toISOString();
    const passwordHash = bcrypt.hashSync(password, 12);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const sessionResult = await client.query(
        'SELECT id, plan, status, user_id FROM subscription_sessions WHERE id = $1 FOR UPDATE',
        [subscriptionSession]
      );
      const session = sessionResult.rows[0];
      if (!session) {
        await client.query('ROLLBACK');
        return res.status(402).json({ error: 'subscription_required' });
      }
      if (session.plan !== plan) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'subscription_plan_mismatch' });
      }
      if (session.status !== 'approved') {
        await client.query('ROLLBACK');
        return res.status(402).json({ error: 'subscription_not_approved' });
      }
      if (session.user_id) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'subscription_already_used' });
      }

      await client.query(
        'INSERT INTO users (id, name, email, password_hash, plan, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
        [userId, name, email, passwordHash, plan, now]
      );
      await client.query(
        'INSERT INTO accounts (id, user_id, name, currency, balance_cents, account_number, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [accountId, userId, 'Primary Wallet', 'BRL', 0, accountNum, now]
      );
      await client.query(
        'UPDATE subscription_sessions SET user_id = $1 WHERE id = $2',
        [userId, subscriptionSession]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const token = issueToken({ id: userId, email, name });

    return res.status(201).json({
      token,
      user: { id: userId, name, email, plan },
      accounts: [
        {
          id: accountId,
          name: 'Primary Wallet',
          currency: 'BRL',
          balanceCents: 0,
          accountNumber: accountNum
        }
      ]
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Unable to create account' });
  }
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  const email = req.body.email.trim().toLowerCase();
  const password = req.body.password;

  try {
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = bcrypt.compareSync(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = issueToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to authenticate' });
  }
});

router.post('/demo', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  const demoEmail = 'demo@ghostpay.local';
  const demoName = 'Demo User';
  const demoPassword = 'ghostpay-demo';
  const demoPlan = 'infinity';

  try {
    let user = await findUserByEmail(demoEmail);

    if (!user) {
      const userId = randomId('usr');
      const primaryId = randomId('acc');
      const now = new Date().toISOString();
      const passwordHash = bcrypt.hashSync(demoPassword, 12);
      const primaryNum = accountNumber();

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'INSERT INTO users (id, name, email, password_hash, plan, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
          [userId, demoName, demoEmail, passwordHash, demoPlan, now]
        );
        await client.query(
          'INSERT INTO accounts (id, user_id, name, currency, balance_cents, account_number, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [primaryId, userId, 'Primary Wallet', 'BRL', 125000, primaryNum, now]
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
        // Single account demo: no internal transfers.
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      user = await findUserByEmail(demoEmail);
    }

    const token = issueToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan || demoPlan
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to create demo user' });
  }
});

module.exports = router;
