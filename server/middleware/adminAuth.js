const crypto = require('crypto');

function safeEqual(left, right) {
  if (!left || !right) {
    return false;
  }
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function adminAuth(req, res, next) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return res.status(503).json({ error: 'admin_not_configured' });
  }

  const header =
    req.get('X-Admin-Token') ||
    req.get('X-Admin-Key') ||
    '';
  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const token = header || bearer;

  if (!safeEqual(token, expected)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

module.exports = {
  adminAuth
};
