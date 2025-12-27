require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const accountsRoutes = require('./routes/accounts');
const transactionsRoutes = require('./routes/transactions');
const overviewRoutes = require('./routes/overview');
const pixRoutes = require('./routes/pix');
const cardsRoutes = require('./routes/cards');
const webhooksRoutes = require('./routes/webhooks');
const dockWebhooksRoutes = require('./routes/dockWebhooks');
const integrationsRoutes = require('./routes/integrations');
const { authRequired } = require('./middleware/auth');
const { initDb } = require('./db');
const { startWebhookWorker } = require('./services/webhooks');

const app = express();
const publicDir = path.join(__dirname, '..', 'public');
const port = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.warn('[ghostpay] JWT_SECRET not set. Using development default.');
}

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.static(publicDir));

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/accounts', authRequired, accountsRoutes);
app.use('/api/transactions', authRequired, transactionsRoutes);
app.use('/api/overview', authRequired, overviewRoutes);
app.use('/api/pix', authRequired, pixRoutes);
app.use('/api/cards', authRequired, cardsRoutes);
app.use('/api/webhooks/dock', dockWebhooksRoutes);
app.use('/api/webhooks', authRequired, webhooksRoutes);
app.use('/api/integrations', authRequired, integrationsRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const pageRoutes = {
  '/': 'index.html',
  '/platform': 'platform.html',
  '/security': 'security.html',
  '/empresa': 'empresa.html',
  '/developers': 'empresa.html',
  '/pricing': 'pricing.html',
  '/support': 'support.html',
  '/console': 'console.html',
  '/console/overview': 'console.html',
  '/console/contas': 'console-accounts.html',
  '/console/movimentacoes': 'console-movements.html',
  '/console/pix': 'console-pix.html',
  '/console/cartoes': 'console-cards.html'
};

Object.entries(pageRoutes).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(publicDir, file));
  });
});

app.get('/console/cartoes/:id', (req, res) => {
  res.sendFile(path.join(publicDir, 'console-card.html'));
});

app.get('*', (req, res) => {
  res.status(404).sendFile(path.join(publicDir, '404.html'));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected error' });
});

async function start() {
  try {
    await initDb();
    app.listen(port, () => {
      console.log(`GhostPay running on http://localhost:${port}`);
    });
    startWebhookWorker();
  } catch (err) {
    console.error('[ghostpay] Failed to initialize database.', err);
    process.exit(1);
  }
}

start();
