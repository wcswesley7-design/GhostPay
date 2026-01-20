# Gateway Pix (Modelo B) - Plan Checklist

- Review current schema, ledger, webhook, and auth layers for reuse.
- Extend database for merchants-as-users, charges, withdrawals, holds, API keys, and MP event idempotency.
- Implement merchant auth (JWT or API key) and admin ops auth.
- Add gateway endpoints (/v1/charges, /v1/balance, /v1/withdrawals) plus public pay page and status API.
- Implement Mercado Pago Pix pay-in creation, webhook processing, and ledger crediting with idempotency.
- Add manual withdrawal flow with hold, mark_paid/mark_failed, and proof/notes.
- Update README with env vars, endpoints, and example flows.
- Add minimal test script for the full flow.
