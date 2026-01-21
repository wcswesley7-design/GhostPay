const express = require('express');
const { z } = require('zod');

const { pool } = require('../db');
const { adminAuth } = require('../middleware/adminAuth');
const { validateBody, validateQuery } = require('../middleware/validate');

const router = express.Router();

const querySchema = z.object({
  status: z.string().optional()
});

const confirmSchema = z.object({
  note: z.string().max(500).optional(),
  actor: z.string().max(120).optional()
});

router.use(adminAuth);

router.get('/cards/cancellations', validateQuery(querySchema), async (req, res) => {
  const status = req.query.status && req.query.status !== 'all' ? req.query.status : null;

  try {
    const result = status
      ? await pool.query(
          `SELECT c.*, u.name, u.email
           FROM cards c
           JOIN users u ON u.id = c.user_id
           WHERE c.status = $1
           ORDER BY c.cancel_requested_at DESC NULLS LAST, c.created_at DESC`,
          [status]
        )
      : await pool.query(
          `SELECT c.*, u.name, u.email
           FROM cards c
           JOIN users u ON u.id = c.user_id
           ORDER BY c.cancel_requested_at DESC NULLS LAST, c.created_at DESC`
        );

    const cancellations = result.rows.map((row) => ({
      id: row.id,
      merchantId: row.user_id,
      merchantName: row.name,
      merchantEmail: row.email,
      billingAccountId: row.billing_account_id,
      type: row.type,
      brand: row.brand,
      last4: row.last4,
      status: row.status,
      cancelRequestedAt: row.cancel_requested_at,
      canceledAt: row.canceled_at,
      canceledBy: row.canceled_by,
      cancelNote: row.cancel_note,
      createdAt: row.created_at
    }));

    return res.json({ cancellations });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load card cancellations' });
  }
});

router.post('/cards/:id/confirm_cancel', validateBody(confirmSchema), async (req, res) => {
  const cardId = req.params.id;
  const note = req.body.note ? req.body.note.trim() : null;
  const actor = req.body.actor ? req.body.actor.trim() : 'admin';
  const now = new Date().toISOString();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT * FROM cards WHERE id = $1 FOR UPDATE',
      [cardId]
    );
    const card = result.rows[0];
    if (!card) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Card not found' });
    }
    if (card.status !== 'cancel_pending') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Card not pending cancellation' });
    }

    await client.query(
      `UPDATE cards
       SET status = $1,
           canceled_at = $2,
           canceled_by = $3,
           cancel_note = $4
       WHERE id = $5`,
      ['canceled', now, actor, note, cardId]
    );

    await client.query('COMMIT');
    return res.json({ status: 'canceled' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Unable to confirm cancellation' });
  } finally {
    client.release();
  }
});

module.exports = router;
