const { randomId } = require('../lib/ids');

async function getAccountForUpdate(client, accountId, userId) {
  const result = await client.query(
    'SELECT id, name, currency, balance_cents FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
    [accountId, userId]
  );
  return result.rows[0] || null;
}

async function insertLedgerEntry(client, entry) {
  await client.query(
    `INSERT INTO ledger_entries (
      id, user_id, account_id, transaction_id, direction, amount_cents, balance_after_cents, memo, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      entry.id,
      entry.userId,
      entry.accountId,
      entry.transactionId,
      entry.direction,
      entry.amountCents,
      entry.balanceAfterCents,
      entry.memo,
      entry.createdAt
    ]
  );
}

async function recordTransaction(client, payload) {
  const now = new Date().toISOString();
  const {
    userId,
    type,
    amountCents,
    fromAccountId,
    toAccountId,
    counterparty,
    note,
    referenceType,
    referenceId,
    metadata
  } = payload;

  let fromAccount = null;
  let toAccount = null;

  if (fromAccountId) {
    fromAccount = await getAccountForUpdate(client, fromAccountId, userId);
    if (!fromAccount) {
      throw new Error('from_account_not_found');
    }
  }

  if (toAccountId) {
    toAccount = await getAccountForUpdate(client, toAccountId, userId);
    if (!toAccount) {
      throw new Error('to_account_not_found');
    }
  }

  let updatedFrom = null;
  let updatedTo = null;

  if (type === 'deposit') {
    if (!toAccount) {
      throw new Error('to_account_required');
    }
    updatedTo = {
      ...toAccount,
      balance_cents: toAccount.balance_cents + amountCents
    };
    await client.query(
      'UPDATE accounts SET balance_cents = $1 WHERE id = $2 AND user_id = $3',
      [updatedTo.balance_cents, toAccount.id, userId]
    );
  }

  if (type === 'withdrawal' || type === 'payment') {
    if (!fromAccount) {
      throw new Error('from_account_required');
    }
    if (fromAccount.balance_cents < amountCents) {
      throw new Error('insufficient_funds');
    }
    updatedFrom = {
      ...fromAccount,
      balance_cents: fromAccount.balance_cents - amountCents
    };
    await client.query(
      'UPDATE accounts SET balance_cents = $1 WHERE id = $2 AND user_id = $3',
      [updatedFrom.balance_cents, fromAccount.id, userId]
    );
  }

  if (type === 'transfer') {
    if (!fromAccount || !toAccount) {
      throw new Error('transfer_accounts_required');
    }
    if (fromAccount.id === toAccount.id) {
      throw new Error('same_account');
    }
    if (fromAccount.currency !== toAccount.currency) {
      throw new Error('currency_mismatch');
    }
    if (fromAccount.balance_cents < amountCents) {
      throw new Error('insufficient_funds');
    }
    updatedFrom = {
      ...fromAccount,
      balance_cents: fromAccount.balance_cents - amountCents
    };
    updatedTo = {
      ...toAccount,
      balance_cents: toAccount.balance_cents + amountCents
    };
    await client.query(
      'UPDATE accounts SET balance_cents = $1 WHERE id = $2 AND user_id = $3',
      [updatedFrom.balance_cents, fromAccount.id, userId]
    );
    await client.query(
      'UPDATE accounts SET balance_cents = $1 WHERE id = $2 AND user_id = $3',
      [updatedTo.balance_cents, toAccount.id, userId]
    );
  }

  const transactionId = randomId('txn');
  const metadataPayload = metadata ? JSON.stringify(metadata) : null;

  await client.query(
    `INSERT INTO transactions (
      id,
      user_id,
      type,
      amount_cents,
      from_account_id,
      to_account_id,
      counterparty,
      note,
      reference_type,
      reference_id,
      metadata,
      status,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)`,
    [
      transactionId,
      userId,
      type,
      amountCents,
      fromAccount ? fromAccount.id : null,
      toAccount ? toAccount.id : null,
      counterparty || null,
      note || null,
      referenceType || null,
      referenceId || null,
      metadataPayload,
      'completed',
      now
    ]
  );

  if (updatedFrom) {
    await insertLedgerEntry(client, {
      id: randomId('led'),
      userId,
      accountId: updatedFrom.id,
      transactionId,
      direction: 'debit',
      amountCents,
      balanceAfterCents: updatedFrom.balance_cents,
      memo: note || null,
      createdAt: now
    });
  }

  if (updatedTo) {
    await insertLedgerEntry(client, {
      id: randomId('led'),
      userId,
      accountId: updatedTo.id,
      transactionId,
      direction: 'credit',
      amountCents,
      balanceAfterCents: updatedTo.balance_cents,
      memo: note || null,
      createdAt: now
    });
  }

  return {
    id: transactionId,
    createdAt: now,
    fromAccount: updatedFrom || fromAccount,
    toAccount: updatedTo || toAccount
  };
}

module.exports = {
  recordTransaction
};
