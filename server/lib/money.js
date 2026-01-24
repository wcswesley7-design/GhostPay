function parseAmountToCents(input) {
  if (input === null || input === undefined) {
    return null;
  }

  const raw = typeof input === 'number' ? input.toString() : String(input).trim();
  if (!raw) {
    return null;
  }

  const dotCount = (raw.match(/\./g) || []).length;
  const commaCount = (raw.match(/,/g) || []).length;
  let normalized = raw;

  if (dotCount > 0 || commaCount > 0) {
    if (dotCount > 0 && commaCount > 0) {
      const lastDot = raw.lastIndexOf('.');
      const lastComma = raw.lastIndexOf(',');
      if (lastComma > lastDot) {
        normalized = raw.replace(/\./g, '').replace(',', '.');
      } else {
        normalized = raw.replace(/,/g, '');
      }
    } else if (commaCount > 1) {
      normalized = raw.replace(/,/g, '');
    } else if (dotCount > 1) {
      normalized = raw.replace(/\./g, '');
    } else if (commaCount === 1) {
      normalized = raw.replace(',', '.');
    }
  }

  normalized = normalized.replace(/[^\d.-]/g, '');
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
