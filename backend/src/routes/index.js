const express = require('express');
const router = express.Router();

const monitorRoutes = require('./monitorRoutes');
const alertRoutes = require('./alertRoutes');

// Health Check
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Mount modular subrouters
router.use('/', monitorRoutes);
router.use('/', alertRoutes);

module.exports = router;
