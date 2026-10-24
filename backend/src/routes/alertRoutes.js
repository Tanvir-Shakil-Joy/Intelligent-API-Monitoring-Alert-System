const express = require('express');
const router = express.Router();
const { getAlerts } = require('../controllers/alertController');

router.get('/alerts', getAlerts);
// Also support root mount GET /
router.get('/', getAlerts);

module.exports = router;
