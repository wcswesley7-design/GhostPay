# GhostPay

GhostPay is a minimalist fintech prototype with a secure API, ledger-backed accounts, and a premium clean-tech UI.

## Features
- JWT-authenticated sessions with bcrypt password hashing
- PostgreSQL ledger with accounts, balances, and transactions
- Secure Express API with rate limiting and helmet
- Responsive UI with a graphite/white/gold visual system
- Pix and card rails in sandbox mode (local simulation)
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
- `GET /api/integrations/dock`
- `POST /api/integrations/dock/test`

## Notes
- All currency values are stored in cents to avoid floating point drift.
- Use `JWT_SECRET` in `.env` for production.
- Pix and card flows are simulated locally; to go live you must integrate a regulated BaaS/PSP provider and complete compliance.
- Webhooks are signed with `X-GhostPay-Signature: sha256=<hmac>` using the webhook secret.

### Webhook events
- `pix.charge.created`
- `pix.charge.paid`
- `pix.transfer.completed`
- `card.created`
- `card.transaction.settled`
- `webhook.test`

See `docs/PRODUCTION.md` for the production checklist and AWS baseline.
See `docs/DOCK_SETUP.md` for Dock sandbox setup details.
