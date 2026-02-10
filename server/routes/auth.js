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
  cpf: z.string().min(11).max(20),
  password: z.string().min(8).max(128),
  phone: z.string().min(6).max(30),
  birthDate: z.string().min(4).max(20),
  mcc: z.string().min(2).max(10),
  plan: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : value),
    z.enum(['free']).default('free')
  ),
  address: z.object({
    cep: z.string().min(5).max(12),
    street: z.string().min(2).max(120),
    number: z.string().min(1).max(20),
    neighborhood: z.string().min(2).max(80),
    complement: z.string().min(0).max(80).optional().or(z.literal('')),
    city: z.string().min(2).max(80),
    state: z.string().min(2).max(2)
  })
});

const loginSchema = z.object({
  email: z.string().email().max(120),
  password: z.string().min(1).max(128)
});

function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      cpf: user.cpf
    },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}

async function findUserByEmail(email) {
  const result = await pool.query(
    'SELECT id, name, email, cpf, password_hash, plan FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
}

async function findUserByCpf(cpf) {
  const result = await pool.query('SELECT id FROM users WHERE cpf = $1', [cpf]);
  return result.rows[0];
}

router.post('/register', validateBody(registerSchema), async (req, res) => {
  const name = req.body.name.trim();
  const email = req.body.email.trim().toLowerCase();
  const cpf = String(req.body.cpf || '').replace(/\D/g, '');
  const password = req.body.password;
  const plan = req.body.plan || 'free';
  const phone = req.body.phone ? req.body.phone.trim() : '';
  const birthDate = req.body.birthDate ? req.body.birthDate.trim() : '';
  const mcc = req.body.mcc ? req.body.mcc.trim() : '';
  const address = req.body.address || {};

  try {
    if (cpf.length !== 11) {
      return res.status(400).json({ error: 'invalid_cpf' });
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    const existingCpf = await findUserByCpf(cpf);
    if (existingCpf) {
      return res.status(409).json({ error: 'cpf_in_use' });
    }

    const userId = randomId('usr');
    const accountId = randomId('acc');
    const accountNum = accountNumber();
    const now = new Date().toISOString();
    const passwordHash = bcrypt.hashSync(password, 12);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const profileMeta = {
        documents: {
          type: 'cpf',
          number: cpf
        }
      };
      await client.query(
        `INSERT INTO users (
          id, name, email, cpf, password_hash, plan, created_at,
          phone, birth_date, mcc,
          address_cep, address_street, address_number, address_neighborhood,
          address_complement, address_city, address_state,
          profile_meta
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17,
          $18
        )`,
        [
          userId,
          name,
          email,
          cpf,
          passwordHash,
          plan,
          now,
          phone || null,
          birthDate || null,
          mcc || null,
          address.cep || null,
          address.street || null,
          address.number || null,
          address.neighborhood || null,
          address.complement || null,
          address.city || null,
          address.state || null,
          profileMeta
        ]
      );
      await client.query(
        'INSERT INTO accounts (id, user_id, name, currency, balance_cents, account_number, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [accountId, userId, 'Primary Wallet', 'BRL', 0, accountNum, now]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const token = issueToken({ id: userId, email, name, cpf });

    return res.status(201).json({
      token,
      user: { id: userId, name, email, cpf, plan },
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
      if (err.constraint === 'idx_users_cpf') {
        return res.status(409).json({ error: 'cpf_in_use' });
      }
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
        cpf: user.cpf,
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
  const demoPlan = 'free';
  const demoCpf = '11122233344';

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
          'INSERT INTO users (id, name, email, cpf, password_hash, plan, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [userId, demoName, demoEmail, demoCpf, passwordHash, demoPlan, now]
        );
        await client.query(
          'INSERT INTO accounts (id, user_id, name, currency, balance_cents, account_number, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [primaryId, userId, 'Primary Wallet', 'BRL', 155000, primaryNum, now]
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
        cpf: user.cpf,
        plan: user.plan || demoPlan
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to create demo user' });
  }
});

module.exports = router;
