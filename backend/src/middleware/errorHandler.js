const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Centralized error-handling middleware.
 * Normalizes all error types into a predictable JSON payload:
 * { success: false, error: { code, message, requestId } }
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || err.status || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected internal server error occurred';

  // 1. JSON Body Parser Syntax Error (malformed JSON sent in request body)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    code = 'MALFORMED_JSON';
    message = 'Request body contains invalid or malformed JSON syntax';
  }

  // 2. Joi Validation Errors
  if (err.isJoi || (err.details && Array.isArray(err.details))) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.details.map((d) => d.message).join('; ');
  }

  // 3. Mongoose CastError (e.g., malformed ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_IDENTIFIER';
    message = `Invalid value "${err.value}" for field "${err.path}"`;
  }

  // 4. Mongoose Document Validation Error
  if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    code = 'DATABASE_VALIDATION_ERROR';
    message = Object.values(err.errors).map((e) => e.message).join('; ');
  }

  // Structured logging
  if (statusCode >= 500) {
    logger.error(`[Server Error] ${message}`, {
      requestId: req.id,
      code,
      statusCode,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method
    });
  } else {
    logger.warn(`[Client Error] ${message}`, {
      requestId: req.id,
      code,
      statusCode,
      url: req.originalUrl,
      method: req.method
    });
  }

  // Response payload (stack traces are strictly hidden in production)
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      requestId: req.id,
      ...(env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
}

module.exports = errorHandler;
