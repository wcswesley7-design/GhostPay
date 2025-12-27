const crypto = require('crypto');

const { pool } = require('../../db');
const { randomId } = require('../../lib/ids');
const { parseAmountToCents } = require('../../lib/money');
const { recordTransaction } = require('../../services/ledger');
const { emitWebhook } = require('../../services/webhooks');

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function updateCardStatus(userId, cardId, nextStatus, allowedStatuses) {
  const result = await pool.query(
    'SELECT id, status FROM cards WHERE id = $1 AND user_id = $2',
    [cardId, userId]
  );
  const card = result.rows[0];
  if (!card) {
    throw makeError(404, 'Card not found');
  }
  if (!allowedStatuses.includes(card.status)) {
    throw makeError(400, 'Card status does not allow this action');
  }

  await pool.query('UPDATE cards SET status = $1 WHERE id = $2 AND user_id = $3', [
    nextStatus,
    cardId,
    userId
  ]);

  return { id: cardId, status: nextStatus };
}

const pix = {
  async listKeys(userId) {
    const result = await pool.query(
      "SELECT id, account_id, type, value, status, created_at FROM pix_keys WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC",
      [userId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      type: row.type,
      value: row.value,
      status: row.status,
      createdAt: row.created_at
    }));
  },

  async createKey(userId, payload) {
    const keyType = payload.type;
    const accountId = payload.accountId;
    let value = payload.value ? payload.value.trim() : null;

    if (!accountId) {
      throw makeError(400, 'Account required');
    }

    const accountResult = await pool.query(
      'SELECT id, currency FROM accounts WHERE id = $1 AND user_id = $2',
      [accountId, userId]
    );
    const account = accountResult.rows[0];
    if (!account) {
      throw makeError(404, 'Account not found');
    }
    if (account.currency !== 'BRL') {
      throw makeError(400, 'Pix only supports BRL accounts');
    }

    if (keyType === 'random') {
      value = `gp-${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
    }

    if (!value) {
      throw makeError(400, 'Key value required');
    }

    if (keyType === 'email') {
      value = value.toLowerCase();
    }

    if (keyType === 'cpf' || keyType === 'phone') {
      value = value.replace(/\D/g, '');
    }
    if ((keyType === 'cpf' || keyType === 'phone') && !value) {
      throw makeError(400, 'Key value required');
    }

    const keyId = randomId('pix');
    const now = new Date().toISOString();

    try {
      await pool.query(
        'INSERT INTO pix_keys (id, user_id, account_id, type, value, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [keyId, userId, accountId, keyType, value, 'active', now]
      );
    } catch (err) {
      if (err.code === '23505') {
        throw makeError(409, 'Pix key already exists');
      }
      throw err;
    }

    return {
      id: keyId,
      accountId,
      type: keyType,
      value,
      status: 'active',
      createdAt: now
    };
  },

  async deleteKey(userId, keyId) {
    const result = await pool.query(
      "UPDATE pix_keys SET status = 'disabled' WHERE id = $1 AND user_id = $2 AND status = 'active' RETURNING id",
      [keyId, userId]
    );
    if (!result.rows[0]) {
      throw makeError(404, 'Pix key not found');
    }
    return { id: keyId, status: 'disabled' };
  },

  async listCharges(userId) {
    const result = await pool.query(
      'SELECT id, account_id, key_id, amount_cents, description, status, txid, qr_payload, expires_at, created_at, paid_at FROM pix_charges WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      keyId: row.key_id,
      amountCents: row.amount_cents,
      description: row.description,
      status: row.status,
      txid: row.txid,
      qrPayload: row.qr_payload,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      paidAt: row.paid_at
    }));
  },

  async createCharge(userId, payload) {
    const amountCents = parseAmountToCents(payload.amount);
    if (!amountCents || amountCents <= 0) {
      throw makeError(400, 'Invalid amount');
    }

    const accountResult = await pool.query(
      'SELECT id, currency FROM accounts WHERE id = $1 AND user_id = $2',
      [payload.accountId, userId]
    );
    const account = accountResult.rows[0];
    if (!account) {
      throw makeError(404, 'Account not found');
    }
    if (account.currency !== 'BRL') {
      throw makeError(400, 'Pix only supports BRL accounts');
    }

    const keyResult = await pool.query(
      "SELECT id, type, value, account_id FROM pix_keys WHERE id = $1 AND user_id = $2 AND status = 'active'",
      [payload.keyId, userId]
    );
    const key = keyResult.rows[0];
    if (!key) {
      throw makeError(404, 'Pix key not found');
    }
    if (key.account_id && key.account_id !== payload.accountId) {
      throw makeError(400, 'Pix key belongs to another account');
    }

    const chargeId = randomId('pixc');
    const txid = crypto.randomUUID().replace(/-/g, '').slice(0, 26);
    const qrPayload = `pix://ghostpay/${txid}?amount=${(amountCents / 100).toFixed(2)}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const description = payload.description ? payload.description.trim() : null;

    await pool.query(
      `INSERT INTO pix_charges (
        id, user_id, account_id, key_id, amount_cents, description, status, txid, qr_payload, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        chargeId,
        userId,
        payload.accountId,
        payload.keyId,
        amountCents,
        description,
        'pending',
        txid,
        qrPayload,
        expiresAt,
        now
      ]
    );

    emitWebhook(userId, 'pix.charge.created', {
      id: chargeId,
      amountCents,
      status: 'pending',
      txid,
      key: { id: key.id, type: key.type, value: key.value }
    });

    return {
      id: chargeId,
      accountId: payload.accountId,
      keyId: payload.keyId,
      amountCents,
      description,
      status: 'pending',
      txid,
      qrPayload,
      expiresAt,
      createdAt: now
    };
  },

  async simulateChargePayment(userId, chargeId) {
    if (process.env.NODE_ENV === 'production') {
      throw makeError(404, 'Not found');
    }
    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const result = await client.query(
        'SELECT * FROM pix_charges WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [chargeId, userId]
      );
      const charge = result.rows[0];
      if (!charge) {
        throw makeError(404, 'Charge not found');
      }
      if (charge.status !== 'pending') {
        throw makeError(400, 'Charge not pending');
      }

      const paidAt = new Date().toISOString();
      await client.query(
        'UPDATE pix_charges SET status = $1, paid_at = $2 WHERE id = $3',
        ['paid', paidAt, charge.id]
      );

      const ledgerResult = await recordTransaction(client, {
        userId,
        type: 'deposit',
        amountCents: charge.amount_cents,
        toAccountId: charge.account_id,
        counterparty: 'Pix charge',
        note: charge.description || 'Pix charge',
        referenceType: 'pix_charge',
        referenceId: charge.id,
        metadata: { txid: charge.txid }
      });

      await client.query('COMMIT');

      emitWebhook(userId, 'pix.charge.paid', {
        id: charge.id,
        amountCents: charge.amount_cents,
        txid: charge.txid,
        paidAt
      });

      return {
        charge: {
          id: charge.id,
          status: 'paid',
          paidAt
        },
        transactionId: ledgerResult.id
      };
    } catch (err) {
      if (client) {
        await client.query('ROLLBACK');
      }
      if (err.status) {
        throw err;
      }
      if (err.message === 'to_account_not_found') {
        throw makeError(404, 'Account not found');
      }
      throw err;
    } finally {
      if (client) {
        client.release();
      }
    }
  },

  async listTransfers(userId) {
    const result = await pool.query(
      'SELECT id, account_id, key_type, key_value, amount_cents, description, status, created_at, completed_at FROM pix_transfers WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      accountId: row.account_id,
      keyType: row.key_type,
      keyValue: row.key_value,
      amountCents: row.amount_cents,
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      completedAt: row.completed_at
    }));
  },

  async createTransfer(userId, payload) {
    const amountCents = parseAmountToCents(payload.amount);
    if (!amountCents || amountCents <= 0) {
      throw makeError(400, 'Invalid amount');
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');
      const transferId = randomId('pixt');
      const now = new Date().toISOString();
      let keyValue = payload.keyValue.trim();
      if (payload.keyType === 'email') {
        keyValue = keyValue.toLowerCase();
      }
      if (payload.keyType === 'cpf' || payload.keyType === 'phone') {
        keyValue = keyValue.replace(/\D/g, '');
      }
      if (!keyValue) {
        throw makeError(400, 'Invalid Pix key');
      }
      const description = payload.description ? payload.description.trim() : null;

      const accountResult = await client.query(
        'SELECT id, currency FROM accounts WHERE id = $1 AND user_id = $2',
        [payload.accountId, userId]
      );
      const account = accountResult.rows[0];
      if (!account) {
        throw makeError(404, 'Account not found');
      }
      if (account.currency !== 'BRL') {
        throw makeError(400, 'Pix only supports BRL accounts');
      }

      const ledgerResult = await recordTransaction(client, {
        userId,
        type: 'payment',
        amountCents,
        fromAccountId: payload.accountId,
        counterparty: `Pix ${keyValue}`,
        note: description || 'Pix transfer',
        referenceType: 'pix_transfer',
        referenceId: transferId,
        metadata: { keyType: payload.keyType }
      });

      await client.query(
        `INSERT INTO pix_transfers (
          id, user_id, account_id, key_type, key_value, amount_cents, description, status, created_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          transferId,
          userId,
          payload.accountId,
          payload.keyType,
          keyValue,
          amountCents,
          description,
          'completed',
          now,
          now
        ]
      );

      await client.query('COMMIT');

      emitWebhook(userId, 'pix.transfer.completed', {
        id: transferId,
        amountCents,
        keyType: payload.keyType,
        keyValue
      });

      return {
        transfer: {
          id: transferId,
          accountId: payload.accountId,
          keyType: payload.keyType,
          keyValue,
          amountCents,
          description,
          status: 'completed',
          createdAt: now,
          completedAt: now
        },
        transactionId: ledgerResult.id
      };
    } catch (err) {
      if (client) {
        await client.query('ROLLBACK');
      }
      if (err.status) {
        throw err;
      }
      if (err.message === 'from_account_not_found') {
        throw makeError(404, 'Account not found');
      }
      if (err.message === 'insufficient_funds') {
        throw makeError(400, 'Insufficient funds');
      }
      throw err;
    } finally {
      if (client) {
        client.release();
      }
    }
  }
};

const cards = {
  async listCards(userId) {
    const result = await pool.query(
      'SELECT id, billing_account_id, type, brand, last4, status, limit_cents, available_cents, created_at FROM cards WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      billingAccountId: row.billing_account_id,
      type: row.type,
      brand: row.brand,
      last4: row.last4,
      status: row.status,
      limitCents: row.limit_cents,
      availableCents: row.available_cents,
      createdAt: row.created_at
    }));
  },

  async createCard(userId, payload) {
    const limitCents = payload.limit ? parseAmountToCents(payload.limit) : 500000;
    if (!limitCents || limitCents <= 0) {
      throw makeError(400, 'Invalid limit');
    }

    const accountResult = await pool.query(
      'SELECT id FROM accounts WHERE id = $1 AND user_id = $2',
      [payload.accountId, userId]
    );
    if (!accountResult.rows[0]) {
      throw makeError(404, 'Account not found');
    }

    const cardId = randomId('card');
    const now = new Date().toISOString();
    const last4 = crypto.randomInt(1000, 9999).toString();

    await pool.query(
      `INSERT INTO cards (
        id, user_id, billing_account_id, type, brand, last4, status, limit_cents, available_cents, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        cardId,
        userId,
        payload.accountId,
        payload.type || 'virtual',
        'VISA',
        last4,
        'active',
        limitCents,
        limitCents,
        now
      ]
    );

    emitWebhook(userId, 'card.created', {
      id: cardId,
      last4,
      type: payload.type || 'virtual'
    });

    return {
      id: cardId,
      billingAccountId: payload.accountId,
      type: payload.type || 'virtual',
      brand: 'VISA',
      last4,
      status: 'active',
      limitCents,
      availableCents: limitCents,
      createdAt: now
    };
  },

  async blockCard(userId, cardId) {
    return updateCardStatus(userId, cardId, 'blocked', ['active']);
  },

  async unblockCard(userId, cardId) {
    return updateCardStatus(userId, cardId, 'active', ['blocked']);
  },

  async requestCancelCard(userId, cardId) {
    return updateCardStatus(userId, cardId, 'cancel_pending', ['active', 'blocked']);
  },

  async listCardTransactions(userId, cardId) {
    const result = await pool.query(
      `SELECT id, card_id, account_id, amount_cents, merchant, status, created_at
       FROM card_transactions
       WHERE user_id = $1 AND card_id = $2
       ORDER BY created_at DESC`,
      [userId, cardId]
    );
    return result.rows.map((row) => ({
      id: row.id,
      cardId: row.card_id,
      accountId: row.account_id,
      amountCents: row.amount_cents,
      merchant: row.merchant,
      status: row.status,
      createdAt: row.created_at
    }));
  },

  async createCardTransaction(userId, cardId, payload) {
    const amountCents = parseAmountToCents(payload.amount);
    if (!amountCents || amountCents <= 0) {
      throw makeError(400, 'Invalid amount');
    }

    let client;
    try {
      client = await pool.connect();
      await client.query('BEGIN');

      const cardResult = await client.query(
        'SELECT * FROM cards WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [cardId, userId]
      );
      const card = cardResult.rows[0];
      if (!card) {
        throw makeError(404, 'Card not found');
      }
      if (card.status !== 'active') {
        throw makeError(400, 'Card not active');
      }
      if (card.available_cents < amountCents) {
        throw makeError(400, 'Card limit exceeded');
      }

      const updatedAvailable = card.available_cents - amountCents;
      await client.query(
        'UPDATE cards SET available_cents = $1 WHERE id = $2',
        [updatedAvailable, card.id]
      );

      const cardTxnId = randomId('ctx');
      const now = new Date().toISOString();

      await client.query(
        `INSERT INTO card_transactions (
          id, user_id, card_id, account_id, amount_cents, merchant, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          cardTxnId,
          userId,
          card.id,
          card.billing_account_id,
          amountCents,
          payload.merchant.trim(),
          'settled',
          now
        ]
      );

      const ledgerResult = await recordTransaction(client, {
        userId,
        type: 'payment',
        amountCents,
        fromAccountId: card.billing_account_id,
        counterparty: payload.merchant.trim(),
        note: `Card ${card.last4}`,
        referenceType: 'card_transaction',
        referenceId: cardTxnId,
        metadata: { cardId: card.id }
      });

      await client.query('COMMIT');

      emitWebhook(userId, 'card.transaction.settled', {
        id: cardTxnId,
        cardId: card.id,
        amountCents,
        merchant: payload.merchant
      });

      return {
        transaction: {
          id: cardTxnId,
          cardId: card.id,
          accountId: card.billing_account_id,
          amountCents,
          merchant: payload.merchant.trim(),
          status: 'settled',
          createdAt: now
        },
        card: {
          id: card.id,
          availableCents: updatedAvailable
        },
        transactionId: ledgerResult.id
      };
    } catch (err) {
      if (client) {
        await client.query('ROLLBACK');
      }
      if (err.status) {
        throw err;
      }
      if (err.message === 'insufficient_funds') {
        throw makeError(400, 'Insufficient funds');
      }
      if (err.message === 'from_account_not_found') {
        throw makeError(404, 'Billing account not found');
      }
      throw err;
    } finally {
      if (client) {
        client.release();
      }
    }
  }
};

module.exports = {
  pix,
  cards
};
