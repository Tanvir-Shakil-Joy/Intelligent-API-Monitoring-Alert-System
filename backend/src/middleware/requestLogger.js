const logger = require('../utils/logger');

/**
 * Express middleware for structured HTTP access logging.
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const logData = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent')
    };

    if (res.statusCode >= 500) {
      logger.error(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} in ${durationMs}ms`, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} in ${durationMs}ms`, logData);
    } else {
      logger.info(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} in ${durationMs}ms`, logData);
    }
  });

  next();
}

module.exports = requestLogger;
