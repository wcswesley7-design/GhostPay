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
    const current = await pool.query(
      `SELECT name, phone, birth_date, mcc,
              address_cep, address_street, address_number, address_neighborhood,
              address_complement, address_city, address_state, profile_meta
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    const currentUser = current.rows[0];
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    const existingMeta = currentUser.profile_meta || {};
    const lockedFields = [];
    const currentBirth = currentUser.birth_date
      ? new Date(currentUser.birth_date).toISOString().slice(0, 10)
      : '';

    if (name && currentUser.name && name !== currentUser.name) {
      lockedFields.push('name');
    }
    if (phone && currentUser.phone && phone !== currentUser.phone) {
      lockedFields.push('phone');
    }
    if (birthDate && currentBirth && birthDate !== currentBirth) {
      lockedFields.push('birthDate');
    }
    if (mcc && currentUser.mcc && mcc !== currentUser.mcc) {
      lockedFields.push('mcc');
    }
    if (address.cep && currentUser.address_cep && address.cep !== currentUser.address_cep) {
      lockedFields.push('address.cep');
    }
    if (address.street && currentUser.address_street && address.street !== currentUser.address_street) {
      lockedFields.push('address.street');
    }
    if (address.number && currentUser.address_number && address.number !== currentUser.address_number) {
      lockedFields.push('address.number');
    }
    if (
      address.neighborhood &&
      currentUser.address_neighborhood &&
      address.neighborhood !== currentUser.address_neighborhood
    ) {
      lockedFields.push('address.neighborhood');
    }
    if (
      address.complement &&
      currentUser.address_complement &&
      address.complement !== currentUser.address_complement
    ) {
      lockedFields.push('address.complement');
    }
    if (address.city && currentUser.address_city && address.city !== currentUser.address_city) {
      lockedFields.push('address.city');
    }
    if (address.state && currentUser.address_state && address.state !== currentUser.address_state) {
      lockedFields.push('address.state');
    }

    const currentDoc = existingMeta?.documents?.number;
    const nextDoc = profileMetaUpdate?.documents?.number;
    if (nextDoc && currentDoc && nextDoc !== currentDoc) {
      lockedFields.push('documents');
    }

    if (lockedFields.length) {
      return res.status(403).json({ error: 'profile_locked' });
    }
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
