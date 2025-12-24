const crypto = require('crypto');

function randomId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function accountNumber() {
  return `GP-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

module.exports = {
  randomId,
  accountNumber
};
