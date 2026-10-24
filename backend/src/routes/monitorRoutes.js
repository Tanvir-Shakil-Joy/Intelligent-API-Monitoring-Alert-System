const express = require('express');
const router = express.Router();
const { postMonitor } = require('../controllers/monitorController');
const { validateMonitorBatch } = require('../middleware/validateInput');

router.post('/monitor', validateMonitorBatch, postMonitor);
// Also support root mount POST /
router.post('/', validateMonitorBatch, postMonitor);

module.exports = router;
