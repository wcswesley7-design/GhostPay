function mapChargeStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') {
    return 'paid';
  }
  if (normalized === 'expired') {
    return 'expired';
  }
  if (
    ['rejected', 'cancelled', 'canceled', 'refunded', 'charged_back'].includes(
      normalized
    )
  ) {
    return 'canceled';
  }
  return 'waiting_payment';
}

function extractPixPayload(payment) {
  const data = payment?.point_of_interaction?.transaction_data;
  if (!data) {
    return {
      brCode: null,
      qrCodeBase64: null,
      ticketUrl: null,
      expiresAt: payment?.date_of_expiration || null
    };
  }
  return {
    brCode: data.qr_code || null,
    qrCodeBase64: data.qr_code_base64 || null,
    ticketUrl: data.ticket_url || null,
    expiresAt: payment?.date_of_expiration || null
  };
}

module.exports = {
  mapChargeStatus,
  extractPixPayload
};
