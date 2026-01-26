const MP_BASE_URL = process.env.MP_BASE_URL || 'https://api.mercadopago.com';

function getAccessToken() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    const error = new Error('mp_not_configured');
    error.status = 503;
    throw error;
  }
  return token;
}

async function mpRequest(path, options = {}) {
  const token = getAccessToken();
  const response = await fetch(`${MP_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || 'mercadopago_request_failed');
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return { firstName: 'Cliente', lastName: 'Fluxo' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function buildPhone(value) {
  const digits = normalizePhone(value);
  if (digits.length < 10) {
    return null;
  }
  const areaCode = digits.slice(0, 2);
  const number = digits.slice(2);
  return { area_code: areaCode, number };
}

async function createPreapproval({ reason, payerEmail, amount, backUrl, externalReference }) {
  return mpRequest('/preapproval', {
    method: 'POST',
    body: JSON.stringify({
      reason,
      payer_email: payerEmail,
      back_url: backUrl,
      external_reference: externalReference,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: amount,
        currency_id: 'BRL'
      },
      status: 'pending'
    })
  });
}

async function getPreapproval(preapprovalId) {
  return mpRequest(`/preapproval/${preapprovalId}`, {
    method: 'GET'
  });
}

async function createPixPayment({
  amount,
  description,
  payerEmail,
  payerName,
  payerCpf,
  payerPhone,
  externalReference,
  notificationUrl,
  idempotencyKey
}) {
  const { firstName, lastName } = splitName(payerName);
  const phone = buildPhone(payerPhone);

  return mpRequest('/v1/payments', {
    method: 'POST',
    headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
    body: JSON.stringify({
      transaction_amount: amount,
      description,
      payment_method_id: 'pix',
      payer: {
        email: payerEmail,
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: 'CPF',
          number: payerCpf
        },
        ...(phone ? { phone } : {})
      },
      notification_url: notificationUrl || undefined,
      external_reference: externalReference
    })
  });
}

async function getPayment(paymentId) {
  return mpRequest(`/v1/payments/${paymentId}`, {
    method: 'GET'
  });
}

module.exports = {
  createPreapproval,
  getPreapproval,
  createPixPayment,
  getPayment
};
