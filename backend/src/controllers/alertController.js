const asyncHandler = require('../utils/asyncHandler');
const { getActiveAlerts } = require('../services/alertService');

/**
 * GET /alerts
 * Fetches all active anomalies (status: 'active') sorted by createdAt DESC.
 * Supports query filters: ?severity= ?apiName= ?limit=
 */
const getAlerts = asyncHandler(async (req, res) => {
  const { severity, apiName, limit } = req.query;

  const data = await getActiveAlerts({ severity, apiName, limit });

  return res.status(200).json({
    success: true,
    count: data.length,
    data
  });
});

module.exports = { getAlerts };
