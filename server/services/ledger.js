const { randomId } = require('../lib/ids');

async function getAccountForUpdate(client, accountId, userId) {
  const result = await client.query(
    'SELECT id, name, currency, balance_cents, hold_cents FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
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
    const available = fromAccount.balance_cents - (fromAccount.hold_cents || 0);
    if (available < amountCents) {
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
    const available = fromAccount.balance_cents - (fromAccount.hold_cents || 0);
    if (available < amountCents) {
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

async function reserveHold(client, payload) {
  const now = new Date().toISOString();
  const { userId, accountId, amountCents, referenceType, referenceId, note, counterparty, metadata } = payload;

  const account = await getAccountForUpdate(client, accountId, userId);
  if (!account) {
    throw new Error('from_account_not_found');
  }

  const currentHold = account.hold_cents || 0;
  const available = account.balance_cents - currentHold;
  if (available < amountCents) {
    throw new Error('insufficient_funds');
  }

  const nextHold = currentHold + amountCents;
  await client.query(
    'UPDATE accounts SET hold_cents = $1 WHERE id = $2 AND user_id = $3',
    [nextHold, account.id, userId]
  );

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
      'withdrawal_hold',
      amountCents,
      account.id,
      null,
      counterparty || null,
      note || null,
      referenceType || null,
      referenceId || null,
      metadataPayload,
      'held',
      now
    ]
  );

  await insertLedgerEntry(client, {
    id: randomId('led'),
    userId,
    accountId: account.id,
    transactionId,
    direction: 'debit',
    amountCents,
    balanceAfterCents: account.balance_cents - nextHold,
    memo: note || null,
    createdAt: now
  });

  return {
    id: transactionId,
    createdAt: now,
    holdCents: nextHold
  };
}

async function releaseHold(client, payload) {
  const now = new Date().toISOString();
  const { userId, accountId, amountCents, referenceType, referenceId, note, metadata } = payload;

  const account = await getAccountForUpdate(client, accountId, userId);
  if (!account) {
    throw new Error('from_account_not_found');
  }

  const currentHold = account.hold_cents || 0;
  if (currentHold < amountCents) {
    throw new Error('hold_not_found');
  }

  const nextHold = currentHold - amountCents;
  await client.query(
    'UPDATE accounts SET hold_cents = $1 WHERE id = $2 AND user_id = $3',
    [nextHold, account.id, userId]
  );

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
      'withdrawal_release',
      amountCents,
      null,
      account.id,
      null,
      note || null,
      referenceType || null,
      referenceId || null,
      metadataPayload,
      'reversed',
      now
    ]
  );

  await insertLedgerEntry(client, {
    id: randomId('led'),
    userId,
    accountId: account.id,
    transactionId,
    direction: 'credit',
    amountCents,
    balanceAfterCents: account.balance_cents - nextHold,
    memo: note || null,
    createdAt: now
  });

  return {
    id: transactionId,
    createdAt: now,
    holdCents: nextHold
  };
}

async function finalizeHold(client, payload) {
  const now = new Date().toISOString();
  const { userId, accountId, amountCents, referenceType, referenceId, note, counterparty, metadata } = payload;

  const account = await getAccountForUpdate(client, accountId, userId);
  if (!account) {
    throw new Error('from_account_not_found');
  }

  const currentHold = account.hold_cents || 0;
  if (currentHold < amountCents) {
    throw new Error('hold_not_found');
  }

  const nextHold = currentHold - amountCents;
  const nextBalance = account.balance_cents - amountCents;
  if (nextBalance < 0) {
    throw new Error('insufficient_funds');
  }

  await client.query(
    'UPDATE accounts SET balance_cents = $1, hold_cents = $2 WHERE id = $3 AND user_id = $4',
    [nextBalance, nextHold, account.id, userId]
  );

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
      'withdrawal',
      amountCents,
      account.id,
      null,
      counterparty || null,
      note || null,
      referenceType || null,
      referenceId || null,
      metadataPayload,
      'completed',
      now
    ]
  );

  await insertLedgerEntry(client, {
    id: randomId('led'),
    userId,
    accountId: account.id,
    transactionId,
    direction: 'debit',
    amountCents,
    balanceAfterCents: nextBalance - nextHold,
    memo: note || null,
    createdAt: now
  });

  return {
    id: transactionId,
    createdAt: now,
    balanceCents: nextBalance,
    holdCents: nextHold
  };
}

module.exports = {
  recordTransaction,
  reserveHold,
  releaseHold,
  finalizeHold
};
