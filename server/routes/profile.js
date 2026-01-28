const express = require('express');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const { pool } = require('../db');
const { validateBody } = require('../middleware/validate');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  phone: z.string().min(6).max(30).optional(),
  birthDate: z.string().min(4).max(20).optional(),
  mcc: z.string().min(2).max(10).optional(),
  address: z
    .object({
      cep: z.string().min(5).max(12).optional(),
      street: z.string().min(2).max(120).optional(),
      number: z.string().min(1).max(20).optional(),
      neighborhood: z.string().min(2).max(80).optional(),
      complement: z.string().min(0).max(80).optional(),
      city: z.string().min(2).max(80).optional(),
      state: z.string().min(2).max(2).optional()
    })
    .optional(),
  profileMeta: z.record(z.any()).optional()
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, cpf, plan, phone, birth_date, mcc,
              address_cep, address_street, address_number, address_neighborhood,
              address_complement, address_city, address_state, profile_meta
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        plan: user.plan,
        phone: user.phone,
        birthDate: user.birth_date,
        mcc: user.mcc,
        address: {
          cep: user.address_cep,
          street: user.address_street,
          number: user.address_number,
          neighborhood: user.address_neighborhood,
          complement: user.address_complement,
          city: user.address_city,
          state: user.address_state
        },
        profileMeta: user.profile_meta || {}
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load profile' });
  }
});

router.patch('/', validateBody(updateSchema), async (req, res) => {
  const name = req.body.name ? req.body.name.trim() : undefined;
  const phone = req.body.phone ? req.body.phone.trim() : undefined;
  const birthDate = req.body.birthDate ? req.body.birthDate.trim() : undefined;
  const mcc = req.body.mcc ? req.body.mcc.trim() : undefined;
  const address = req.body.address || {};
  const profileMetaUpdate = req.body.profileMeta || null;

  try {
    const current = await pool.query('SELECT profile_meta FROM users WHERE id = $1', [req.user.id]);
    const existingMeta = current.rows[0]?.profile_meta || {};
    const mergedMeta = profileMetaUpdate ? { ...existingMeta, ...profileMetaUpdate } : existingMeta;

    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           birth_date = COALESCE($3, birth_date),
           mcc = COALESCE($4, mcc),
           address_cep = COALESCE($5, address_cep),
           address_street = COALESCE($6, address_street),
           address_number = COALESCE($7, address_number),
           address_neighborhood = COALESCE($8, address_neighborhood),
           address_complement = COALESCE($9, address_complement),
           address_city = COALESCE($10, address_city),
           address_state = COALESCE($11, address_state),
           profile_meta = $12
       WHERE id = $13
       RETURNING id, name, email, cpf, plan, phone, birth_date, mcc,
                 address_cep, address_street, address_number, address_neighborhood,
                 address_complement, address_city, address_state, profile_meta`,
      [
        name || null,
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
        mergedMeta,
        req.user.id
      ]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        cpf: user.cpf
      },
      JWT_SECRET,
      { expiresIn: '12h' }
    );
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        plan: user.plan,
        phone: user.phone,
        birthDate: user.birth_date,
        mcc: user.mcc,
        address: {
          cep: user.address_cep,
          street: user.address_street,
          number: user.address_number,
          neighborhood: user.address_neighborhood,
          complement: user.address_complement,
          city: user.address_city,
          state: user.address_state
        },
        profileMeta: user.profile_meta || {}
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to update profile' });
  }
});

module.exports = router;
