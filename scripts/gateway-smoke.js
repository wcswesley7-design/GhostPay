const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const apiKey = process.env.GATEWAY_API_KEY;
const adminKey = process.env.ADMIN_API_KEY;

const payer = {
  name: process.env.PAYER_NAME || 'Gateway Tester',
  email: process.env.PAYER_EMAIL || 'tester@example.com',
  cpf: process.env.PAYER_CPF || '00000000000',
  phone: process.env.PAYER_PHONE || '11999999999'
};

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `${response.status}`);
  }
  return data;
}

async function run() {
  if (!apiKey) {
    console.error('Set GATEWAY_API_KEY to run this script.');
    process.exit(1);
  }
  if (!adminKey) {
    console.error('Set ADMIN_API_KEY to run admin steps.');
    process.exit(1);
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Api-Key': apiKey
  };

  const charge = await request('/v1/charges', {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount: 59.9, description: 'Gateway test' })
  });
  console.log('Charge created:', charge.charge_id, charge.pay_url);

  const payment = await request(`/api/public/charges/${charge.charge_id}/create_payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payer)
  });
  console.log('Payment created:', payment.providerPaymentId);

  await request('/webhooks/mercadopago', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { id: payment.providerPaymentId } })
  });
  console.log('Webhook simulated');

  let status = 'waiting_payment';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const statusResult = await request(`/api/public/charges/${charge.charge_id}`);
    status = statusResult.charge.status;
    console.log('Charge status:', status);
    if (status === 'paid') {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  if (status !== 'paid') {
    console.log('Charge not paid yet, stop here.');
    return;
  }

  const withdrawal = await request('/v1/withdrawals', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      amount: 10,
      pix_key_type: 'email',
      pix_key: 'merchant@example.com'
    })
  });
  console.log('Withdrawal requested:', withdrawal.withdrawal.id);

  await request(`/admin/withdrawals/${withdrawal.withdrawal.id}/mark_paid`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': adminKey
    },
    body: JSON.stringify({ note: 'Manual payout test' })
  });
  console.log('Withdrawal marked as paid');
}

run().catch((err) => {
  console.error('Gateway smoke failed:', err.message);
  process.exit(1);
});
