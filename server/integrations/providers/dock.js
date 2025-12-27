const { dockConfigured } = require('../../config');

function makeError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function ensureDockReady() {
  if (!dockConfigured()) {
    throw makeError(503, 'dock_not_configured');
  }
}

function notImplemented() {
  throw makeError(501, 'dock_not_implemented');
}

const pix = {
  async listKeys() {
    ensureDockReady();
    return notImplemented();
  },
  async createKey() {
    ensureDockReady();
    return notImplemented();
  },
  async listCharges() {
    ensureDockReady();
    return notImplemented();
  },
  async createCharge() {
    ensureDockReady();
    return notImplemented();
  },
  async simulateChargePayment() {
    ensureDockReady();
    return notImplemented();
  },
  async listTransfers() {
    ensureDockReady();
    return notImplemented();
  },
  async createTransfer() {
    ensureDockReady();
    return notImplemented();
  }
};

const cards = {
  async listCards() {
    ensureDockReady();
    return notImplemented();
  },
  async createCard() {
    ensureDockReady();
    return notImplemented();
  },
  async listCardTransactions() {
    ensureDockReady();
    return notImplemented();
  },
  async createCardTransaction() {
    ensureDockReady();
    return notImplemented();
  }
};

pix.deleteKey = async () => {
  ensureDockReady();
  return notImplemented();
};

module.exports = {
  pix,
  cards
};
