const { config } = require('../config');
const localProvider = require('./providers/local');
const dockProvider = require('./providers/dock');

function getProvider() {
  if (config.dock.mode === 'dock') {
    return dockProvider;
  }
  return localProvider;
}

module.exports = {
  getProvider
};
