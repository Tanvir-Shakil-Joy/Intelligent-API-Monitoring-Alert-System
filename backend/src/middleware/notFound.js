const AppError = require('../utils/AppError');

/**
 * 404 handler for undefined application routes.
 */
function notFoundHandler(req, res, next) {
  const err = new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND');
  next(err);
}

module.exports = notFoundHandler;
