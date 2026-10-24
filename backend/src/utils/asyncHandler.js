/**
 * Wraps asynchronous controller route handlers to forward unhandled rejections to next(err).
 *
 * @param {Function} fn - Async route handler
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
