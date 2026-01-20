# GhostPay

GhostPay is a minimalist fintech prototype with a secure API, ledger-backed accounts, and a refined clean-tech UI.

## Features
- JWT-authenticated sessions with bcrypt password hashing
- PostgreSQL ledger with accounts, balances, and transactions
- Secure Express API with rate limiting and helmet
- Responsive UI with a graphite/white/gold visual system
- Pix and card rails in sandbox mode (local simulation)
- Pix gateway (Modelo B) with Mercado Pago pay-in and internal ledger
- Manual withdrawal ops with hold and admin approval
- Webhooks with HMAC signatures for event delivery
- Demo user creation in non-production environments

## Stack
- Node.js + Express
- PostgreSQL
- Vanilla HTML/CSS/JS frontend

## Quick start
```bash
npm install
copy .env.example .env
# macOS/Linux: cp .env.example .env
psql -U postgres -c "CREATE DATABASE ghostpay;"
# Or create the database using pgAdmin if psql is not on PATH.
npm run seed
npm start
```

Open `http://localhost:3000`.

### Pages
- `/` (Home)
- `/platform`
- `/security`
- `/developers`
- `/pricing`
- `/support`
- `/console`

## Environment
Update `DATABASE_URL` in `.env` if your PostgreSQL user, password, or port differs.
Example: `postgres://postgres:postgres@localhost:5432/ghostpay`
Set `NODE_ENV=development` to keep demo and sandbox endpoints enabled.
Set `DOCK_MODE=local` to keep the local sandbox. When you receive Dock credentials, set `DOCK_MODE=dock`
and fill the `DOCK_*` variables in `.env`.
Set `APP_BASE_URL` to your public domain when running in production (used for Mercado Pago return URLs).
Set `MP_ACCESS_TOKEN` to enable Mercado Pago subscription checkout.
Set `MP_WEBHOOK_SECRET` to enable Mercado Pago webhook signature validation.
Set `ADMIN_API_KEY` to allow admin operations on manual withdrawals.

### API keys (merchant)
Generate an API key after login:
```
POST /api/keys
```
Send `X-Api-Key: <key>` when calling `/v1/*` endpoints.

## Demo access
- Email: `demo@ghostpay.local`
- Password: `ghostpay-demo`

You can also click **Load demo** on the landing screen. The demo endpoint is disabled in production.

## API endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/demo` (non-production)
- `GET /api/overview`
- `GET /api/accounts`
- `POST /api/accounts`
- `GET /api/transactions`
- `POST /api/transactions`
- `GET /api/pix/keys`
- `POST /api/pix/keys`
- `GET /api/pix/charges`
- `POST /api/pix/charges`
- `POST /api/pix/charges/:id/simulate-pay`
- `GET /api/pix/transfers`
- `POST /api/pix/transfers`
- `GET /api/cards`
- `POST /api/cards`
- `GET /api/cards/:id/transactions`
- `POST /api/cards/:id/transactions`
- `GET /api/webhooks`
- `POST /api/webhooks`
- `DELETE /api/webhooks/:id`
- `POST /api/webhooks/:id/test`
- `GET /api/webhooks/events`
- `POST /api/webhooks/dock` (public, for Dock callbacks)
- `POST /webhooks/mercadopago` (public, for Mercado Pago callbacks)
- `GET /api/integrations/dock`
- `POST /api/integrations/dock/test`

### Pix gateway (Modelo B)
Merchant (JWT or X-Api-Key):
- `POST /v1/charges`
- `GET /v1/charges/:id`
- `GET /v1/balance`
- `POST /v1/withdrawals`
- `GET /v1/withdrawals`

Public payer:
- `GET /pay/:charge_id`
- `GET /api/public/charges/:charge_id`
- `POST /api/public/charges/:charge_id/create_payment`

Admin ops:
- `GET /admin/withdrawals?status=requested`
- `POST /admin/withdrawals/:id/mark_paid`
- `POST /admin/withdrawals/:id/mark_failed`

### Gateway flow (summary)
1. Merchant creates a charge on `/v1/charges` and gets a `payUrl`.
2. Payer opens `/pay/:charge_id` and generates the Pix QR/BR Code.
3. Mercado Pago confirms the payment and the webhook credits the merchant balance.
4. Merchant requests a withdrawal; funds are held until admin marks the payout as paid.

### Example requests (gateway)
Create charge:
```
curl -X POST https://your-domain.com/v1/charges \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: gpk_your_key" \
  -d '{"amount":59.90,"description":"Invoice 123"}'
```

Create Pix payment (public page):
```
curl -X POST https://your-domain.com/api/public/charges/CHARGE_ID/create_payment \
  -H "Content-Type: application/json" \
  -d '{"name":"Cliente Teste","email":"cliente@email.com","cpf":"00000000000","phone":"11999999999"}'
```

Request withdrawal:
```
curl -X POST https://your-domain.com/v1/withdrawals \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: gpk_your_key" \
  -d '{"amount":10,"pix_key_type":"email","pix_key":"merchant@email.com"}'
```

## Notes
- All currency values are stored in cents to avoid floating point drift.
- Use `JWT_SECRET` in `.env` for production.
- Pix and card flows are simulated locally; to go live you must integrate a regulated BaaS/PSP provider and complete compliance.
- Webhooks are signed with `X-GhostPay-Signature: sha256=<hmac>` using the webhook secret.
- For write operations, you can send `Idempotency-Key` to avoid duplicate processing.

### Webhook events
- `pix.charge.created`
- `pix.charge.paid`
- `pix.transfer.completed`
- `card.created`
- `card.transaction.settled`
- `charge.paid`
- `webhook.test`

`charge.paid` payload:
```
{
  "charge_id": "...",
  "amount_cents": 5990,
  "paid_at": "2026-01-20T12:00:00.000Z",
  "provider_payment_id": "1234567890"
}
```

See `docs/PRODUCTION.md` for the production checklist and AWS baseline.
See `docs/DOCK_SETUP.md` for Dock sandbox setup details.
See `docs/GATEWAY_PLAN.md` for the gateway delivery checklist.
