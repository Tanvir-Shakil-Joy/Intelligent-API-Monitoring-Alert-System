const { randomUUID } = require('crypto');

/**
 * Attaches a unique requestId to every incoming request.
 * If an X-Request-Id header is passed upstream, it is preserved; otherwise a UUID is generated.
 */
function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = (incomingId && typeof incomingId === 'string' && incomingId.trim())
    ? incomingId.trim()
    : randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

module.exports = requestIdMiddleware;
