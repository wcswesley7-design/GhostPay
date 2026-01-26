const express = require('express');
const jwt = require('jsonwebtoken');
const { z } = require('zod');

const { pool } = require('../db');
const { validateBody } = require('../middleware/validate');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const updateSchema = z.object({
  name: z.string().min(2).max(80)
});

router.patch('/', validateBody(updateSchema), async (req, res) => {
  const name = req.body.name.trim();
  try {
    const result = await pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, cpf, plan',
      [name, req.user.id]
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
      user
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to update profile' });
  }
});

module.exports = router;
