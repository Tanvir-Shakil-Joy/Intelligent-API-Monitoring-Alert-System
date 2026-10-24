const asyncHandler = require('../utils/asyncHandler');
const { processBatch } = require('../services/monitorService');

/**
 * POST /monitor
 * Ingests a batch of monitored API responses.
 */
const postMonitor = asyncHandler(async (req, res) => {
  const { validItems, invalidItems } = req;
  const requestId = req.id;

  const result = await processBatch({
    validItems,
    invalidItems,
    requestId
  });

  return res.status(200).json({
    success: true,
    summary: result.summary,
    alerts: result.alerts
  });
});

module.exports = { postMonitor };
