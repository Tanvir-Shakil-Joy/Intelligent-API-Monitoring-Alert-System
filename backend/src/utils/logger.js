const winston = require('winston');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');

const logDir = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Sensitive key filter to prevent accidental credential leakage
const SENSITIVE_KEYS = ['password', 'pass', 'apiKey', 'api_key', 'token', 'authorization', 'secret', 'smtp_pass'];

function maskSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(maskSensitiveData);
  }

  const masked = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      masked[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

const redactFormat = winston.format((info) => {
  return maskSensitiveData(info);
})();

// Development console format
const devConsoleFormat = winston.format.printf(({ level, message, timestamp, requestId, ...meta }) => {
  const reqStr = requestId ? `[${requestId}] ` : '';
  const metaClean = { ...meta };
  delete metaClean.service;
  const metaStr = Object.keys(metaClean).length ? `\n  ${JSON.stringify(metaClean, null, 2)}` : '';
  return `[${timestamp}] ${level}: ${reqStr}${message}${metaStr}`;
});

const logger = winston.createLogger({
  level: env.NODE_ENV === 'test' ? 'error' : (process.env.LOG_LEVEL || 'info'),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    redactFormat,
    winston.format.json()
  ),
  defaultMeta: { service: 'api-monitor' },
  transports: [
    // Console transport (human-readable in development, JSON in production)
    new winston.transports.Console({
      format: env.NODE_ENV === 'production'
        ? winston.format.combine(winston.format.timestamp(), redactFormat, winston.format.json())
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'HH:mm:ss' }),
            devConsoleFormat
          )
    })
  ]
});

// File transports (always active except during automated test runs)
if (env.NODE_ENV !== 'test') {
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );
  logger.add(
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 5,
      tailable: true
    })
  );
}

module.exports = logger;
