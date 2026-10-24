const path = require('path');

const fs = require('fs');

// Safely load dotenv from backend/.env or root .env
try {
  const dotenv = require('dotenv');
  const backendEnv = path.resolve(__dirname, '../../.env');
  const rootEnv = path.resolve(__dirname, '../../../.env');

  if (fs.existsSync(backendEnv)) {
    dotenv.config({ path: backendEnv });
  }
  if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv });
  }
} catch (_) {
  // Dotenv optional when running pure unit tests
}

function parseNumber(value, defaultValue) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  return String(value).toLowerCase() === 'true' || value === '1';
}

const env = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseNumber(process.env.PORT, 5001),
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/api_monitor',

  // Anomaly thresholds (ms)
  SLOW_THRESHOLD_MS: parseNumber(process.env.SLOW_THRESHOLD_MS, 3000),
  VERY_SLOW_THRESHOLD_MS: parseNumber(process.env.VERY_SLOW_THRESHOLD_MS, 5000),

  // LLM Configuration
  LLM_PROVIDER: (process.env.LLM_PROVIDER || 'gemini').toLowerCase(),
  LLM_API_KEY: process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '',
  LLM_MODEL: process.env.LLM_MODEL || 'gemini-3.5-flash-lite',
  LLM_TIMEOUT_MS: parseNumber(process.env.LLM_TIMEOUT_MS, 10000),
  LLM_CONCURRENCY: parseNumber(process.env.LLM_CONCURRENCY, 5),

  // Optional Email Digest
  EMAIL_ENABLED: parseBoolean(process.env.EMAIL_ENABLED, false),
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseNumber(process.env.SMTP_PORT, 587),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'alerts@api-monitor.local',
  ALERT_RECIPIENT_EMAIL: process.env.ALERT_RECIPIENT_EMAIL || ''
});

module.exports = env;
