/**
 * Custom operational error class for standardized application errors.
 */
class AppError extends Error {
  /**
   * @param {string} message - Error description
   * @param {number} [statusCode=500] - HTTP status code
   * @param {string} [errorCode='INTERNAL_SERVER_ERROR'] - Operational error code
   */
  constructor(message, statusCode = 500, errorCode = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = errorCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
