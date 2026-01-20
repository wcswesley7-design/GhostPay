const express = require('express');
const { z } = require('zod');

const { pool } = require('../db');
const { adminAuth } = require('../middleware/adminAuth');
const { validateBody, validateQuery } = require('../middleware/validate');
const { finalizeHold, releaseHold } = require('../services/ledger');

const router = express.Router();

const querySchema = z.object({
  status: z.string().optional()
});

const markSchema = z.object({
  note: z.string().max(500).optional(),
  proof_url: z.string().url().optional()
});

router.use(adminAuth);

router.get('/withdrawals', validateQuery(querySchema), async (req, res) => {
  const status = req.query.status;
  try {
    const result = status
      ? await pool.query(
          `SELECT w.*, u.name, u.email
           FROM withdrawal_requests w
           JOIN users u ON u.id = w.user_id
           WHERE w.status = $1
           ORDER BY w.requested_at ASC`,
          [status]
        )
      : await pool.query(
          `SELECT w.*, u.name, u.email
           FROM withdrawal_requests w
           JOIN users u ON u.id = w.user_id
           ORDER BY w.requested_at ASC`
        );

    const withdrawals = result.rows.map((row) => ({
      id: row.id,
      merchantId: row.user_id,
      merchantName: row.name,
      merchantEmail: row.email,
      accountId: row.account_id,
      amountCents: row.amount_cents,
      pixKeyType: row.pix_key_type,
      pixKey: row.pix_key,
      status: row.status,
      adminNote: row.admin_note,
      proofUrl: row.proof_url,
      requestedAt: row.requested_at,
      processedAt: row.processed_at,
      paidAt: row.paid_at
    }));

    return res.json({ withdrawals });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Unable to load withdrawals' });
  }
});

router.post('/withdrawals/:id/mark_paid', validateBody(markSchema), async (req, res) => {
  const withdrawalId = req.params.id;
  const now = new Date().toISOString();
  const note = req.body.note ? req.body.note.trim() : null;
  const proofUrl = req.body.proof_url || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE',
      [withdrawalId]
    );
    const withdrawal = result.rows[0];
    if (!withdrawal) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Withdrawal not found' });
    }
    if (!['requested', 'processing'].includes(withdrawal.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Withdrawal not pending' });
    }

    await finalizeHold(client, {
      userId: withdrawal.user_id,
      accountId: withdrawal.account_id,
      amountCents: withdrawal.amount_cents,
      referenceType: 'withdrawal_request',
      referenceId: withdrawal.id,
      note: 'Withdrawal paid'
    });

    await client.query(
      `UPDATE withdrawal_requests
       SET status = $1,
           admin_note = $2,
           proof_url = $3,
           processed_at = $4,
           paid_at = $5
       WHERE id = $6`,
      ['paid', note, proofUrl, now, now, withdrawal.id]
    );

    await client.query('COMMIT');
    return res.json({ status: 'paid' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Unable to mark paid' });
  } finally {
    client.release();
  }
});

router.post('/withdrawals/:id/mark_failed', validateBody(markSchema), async (req, res) => {
  const withdrawalId = req.params.id;
  const now = new Date().toISOString();
  const note = req.body.note ? req.body.note.trim() : null;
  const proofUrl = req.body.proof_url || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT * FROM withdrawal_requests WHERE id = $1 FOR UPDATE',
      [withdrawalId]
    );
    const withdrawal = result.rows[0];
    if (!withdrawal) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Withdrawal not found' });
    }
    if (!['requested', 'processing'].includes(withdrawal.status)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Withdrawal not pending' });
    }

    await releaseHold(client, {
      userId: withdrawal.user_id,
      accountId: withdrawal.account_id,
      amountCents: withdrawal.amount_cents,
      referenceType: 'withdrawal_release',
      referenceId: withdrawal.id,
      note: 'Withdrawal failed'
    });

    await client.query(
      `UPDATE withdrawal_requests
       SET status = $1,
           admin_note = $2,
           proof_url = $3,
           processed_at = $4
       WHERE id = $5`,
      ['failed', note, proofUrl, now, withdrawal.id]
    );

    await client.query('COMMIT');
    return res.json({ status: 'failed' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    return res.status(500).json({ error: 'Unable to mark failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
