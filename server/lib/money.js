function parseAmountToCents(input) {
  if (input === null || input === undefined) {
    return null;
  }

  const raw = typeof input === 'number' ? input.toString() : String(input).trim();
  if (!raw) {
    return null;
  }

  const normalized = raw.replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 100);
}

function formatCents(cents) {
  if (!Number.isFinite(cents)) {
    return '0.00';
  }
  return (cents / 100).toFixed(2);
}

module.exports = {
  parseAmountToCents,
  formatCents
};
