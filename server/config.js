function normalizeMode(value, fallback) {
  if (!value) {
    return fallback;
  }
  return value.toLowerCase();
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  dock: {
    mode: normalizeMode(process.env.DOCK_MODE, 'local'),
    baseUrl: process.env.DOCK_BASE_URL || '',
    tokenUrl: process.env.DOCK_TOKEN_URL || '',
    clientId: process.env.DOCK_CLIENT_ID || '',
    clientSecret: process.env.DOCK_CLIENT_SECRET || '',
    webhookSecret: process.env.DOCK_WEBHOOK_SECRET || '',
    webhookSignatureHeader:
      process.env.DOCK_WEBHOOK_SIGNATURE_HEADER || 'x-dock-signature',
    webhookSignatureFormat: normalizeMode(
      process.env.DOCK_WEBHOOK_SIGNATURE_FORMAT,
      'hex'
    )
  }
};

function dockConfigured() {
  return (
    config.dock.mode === 'dock' &&
    config.dock.baseUrl &&
    config.dock.tokenUrl &&
    config.dock.clientId &&
    config.dock.clientSecret
  );
}

module.exports = {
  config,
  dockConfigured
};
