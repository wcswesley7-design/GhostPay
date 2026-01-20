const express = require('express');

const { getProvider } = require('../integrations/provider');

const router = express.Router();

function pixProvider() {
  return getProvider().pix;
}

router.get('/charges/:id', async (req, res) => {
  try {
    const charge = await pixProvider().getChargePublic(req.params.id);
    return res.json({ charge });
  } catch (err) {
    const status = err.status || 500;
    const message = err.status ? err.message : 'Unable to load Pix charge';
    if (!err.status) {
      console.error(err);
    }
    return res.status(status).json({ error: message });
  }
});

module.exports = router;
