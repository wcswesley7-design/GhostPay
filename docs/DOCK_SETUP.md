# Dock Sandbox Setup

This guide prepares GhostPay to connect to Dock sandbox once you receive credentials.

## Steps
1) Request Dock sandbox access.
2) Create an application and enable Pix + Cards.
3) Collect the credentials and ids:
   - DOCK_BASE_URL
   - DOCK_TOKEN_URL
   - DOCK_CLIENT_ID
   - DOCK_CLIENT_SECRET
   - Any product or account ids required by Dock for Pix and Cards
4) Set the values in `.env` and switch to Dock mode:
   - DOCK_MODE=dock

## Validate
After setting env vars, run the app and call:
`POST /api/integrations/dock/test`

If it returns `{ "ok": true }`, token fetch is working.

