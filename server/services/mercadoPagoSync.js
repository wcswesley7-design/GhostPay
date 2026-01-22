const { pool } = require('../db');
const { getPayment } = require('../integrations/mercadoPago');
const { updateChargeFromPayment } = require('./mercadoPagoChargeProcessor');

let syncRunning = false;

async function syncPendingCharges() {
  if (syncRunning) {
    return;
  }
  syncRunning = true;

  try {
    const limit = Number(process.env.MP_SYNC_BATCH || 20);
    const rows = await pool.query(
      `SELECT id, provider_payment_id
       FROM pix_charges
       WHERE provider = 'mercadopago'
         AND status IN ('created', 'waiting_payment')
         AND provider_payment_id IS NOT NULL
         AND (provider_checked_at IS NULL OR provider_checked_at < (NOW() - INTERVAL '60 seconds'))
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );

    for (const charge of rows.rows) {
      try {
        const payment = await getPayment(charge.provider_payment_id);
        await updateChargeFromPayment(payment);
      } catch (err) {
        console.error('[ghostpay] MP sync failed', charge.id, err.message || err);
      }
    }
  } finally {
    syncRunning = false;
  }
}

function startMercadoPagoSync() {
  if (process.env.MP_SYNC_ENABLED === 'false') {
    return;
  }
  const interval = Number(process.env.MP_SYNC_INTERVAL_MS || 60000);
  setInterval(syncPendingCharges, interval).unref();
  setTimeout(() => {
    syncPendingCharges().catch((err) => {
      console.error('[ghostpay] MP sync startup failed', err.message || err);
    });
  }, 5000).unref();
}

module.exports = {
  startMercadoPagoSync
};
