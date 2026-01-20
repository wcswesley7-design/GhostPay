const jwt = require('jsonwebtoken');

const { JWT_SECRET } = require('./auth');
const { findApiKey } = require('../services/apiKeys');

function parseBearer(header) {
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }
  return token;
}

async function merchantAuth(req, res, next) {
  const apiKey = req.get('X-Api-Key');
  if (apiKey) {
    try {
      const record = await findApiKey(apiKey.trim());
      if (!record) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      req.user = record.user;
      req.authType = 'api_key';
      return next();
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Auth failed' });
    }
  }

  const token = parseBearer(req.headers.authorization || '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub,
      email: payload.email,
      name: payload.name
    };
    req.authType = 'jwt';
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = {
  merchantAuth
};
