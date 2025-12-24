const { config, dockConfigured } = require('../config');

let cachedToken = null;
let tokenExpiresAt = 0;

function isTokenValid() {
  return cachedToken && Date.now() < tokenExpiresAt - 60000;
}

async function fetchAccessToken() {
  if (!dockConfigured()) {
    throw new Error('dock_not_configured');
  }

  if (isTokenValid()) {
    return cachedToken;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.dock.clientId,
    client_secret: config.dock.clientSecret
  });

  const response = await fetch(config.dock.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error_description || payload.error || 'dock_token_failed';
    throw new Error(message);
  }

  if (!payload.access_token) {
    throw new Error('dock_token_missing');
  }

  const expiresIn = Number(payload.expires_in || 3600);
  cachedToken = payload.access_token;
  tokenExpiresAt = Date.now() + expiresIn * 1000;
  return cachedToken;
}

async function dockRequest(path, options = {}) {
  if (!dockConfigured()) {
    throw new Error('dock_not_configured');
  }

  const token = await fetchAccessToken();
  const url = new URL(path, config.dock.baseUrl).toString();
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };

  return fetch(url, {
    ...options,
    headers
  });
}

module.exports = {
  fetchAccessToken,
  dockRequest
};
