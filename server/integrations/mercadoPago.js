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

module.exports = {
  createPreapproval,
  getPreapproval
};
