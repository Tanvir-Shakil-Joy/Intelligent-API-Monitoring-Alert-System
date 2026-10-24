const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Alert = require('../models/Alert');
const logger = require('../utils/logger');
const { isUsingMongo } = require('../config/db');

// Embedded fallback store path
const STORAGE_DIR = path.resolve(__dirname, '../../data');
const STORAGE_FILE = path.join(STORAGE_DIR, 'alerts-storage.json');

// Initialize in-memory cache for embedded fallback mode
let embeddedAlerts = [];
try {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  if (fs.existsSync(STORAGE_FILE)) {
    const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
    embeddedAlerts = JSON.parse(raw);
    if (!Array.isArray(embeddedAlerts)) embeddedAlerts = [];
  }
} catch (err) {
  embeddedAlerts = [];
}

function saveEmbeddedAlerts() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(embeddedAlerts, null, 2), 'utf8');
  } catch (err) {
    logger.error(`[Database Fallback] Failed to write alerts to storage file: ${err.message}`);
  }
}

/**
 * Persists a single detected anomaly into MongoDB (or embedded store) as 'active'.
 */
async function persistAlert(payload) {
  if (isUsingMongo()) {
    const alert = new Alert({
      apiName: payload.apiName,
      anomalyTypes: payload.anomalyTypes,
      severity: payload.severity,
      metrics: {
        responseTimeMs: payload.metrics.responseTimeMs,
        statusCode: payload.metrics.statusCode,
        recordsReturned: payload.metrics.recordsReturned ?? null
      },
      message: payload.message,
      messageSource: payload.messageSource,
      status: 'active'
    });

    const doc = await alert.save();
    const alertJson = doc.toJSON();
    logger.info(`[Database] Anomaly persisted: id=${alertJson.id} api="${alertJson.apiName}" severity="${alertJson.severity}" source="${alertJson.messageSource}"`);
    return alertJson;
  }

  // Embedded storage fallback
  const now = new Date().toISOString();
  const alertRecord = {
    id: crypto.randomBytes(12).toString('hex'),
    apiName: payload.apiName,
    anomalyTypes: payload.anomalyTypes,
    severity: payload.severity,
    metrics: {
      responseTimeMs: payload.metrics.responseTimeMs,
      statusCode: payload.metrics.statusCode,
      recordsReturned: payload.metrics.recordsReturned ?? null
    },
    message: payload.message,
    messageSource: payload.messageSource,
    status: 'active',
    createdAt: now,
    updatedAt: now
  };

  embeddedAlerts.push(alertRecord);
  saveEmbeddedAlerts();
  logger.info(`[Embedded Store] Anomaly persisted: id=${alertRecord.id} api="${alertRecord.apiName}" severity="${alertRecord.severity}" source="${alertRecord.messageSource}"`);
  return alertRecord;
}

/**
 * Persists multiple detected anomalies in a batch insert.
 *
 * @param {Array<object>} alertsPayload
 * @returns {Promise<Array<object>>} Persisted alert documents
 */
async function persistBatchAlerts(alertsPayload) {
  if (!Array.isArray(alertsPayload) || alertsPayload.length === 0) {
    return [];
  }

  if (isUsingMongo()) {
    const documents = alertsPayload.map((payload) => ({
      apiName: payload.apiName,
      anomalyTypes: payload.anomalyTypes,
      severity: payload.severity,
      metrics: {
        responseTimeMs: payload.metrics.responseTimeMs,
        statusCode: payload.metrics.statusCode,
        recordsReturned: payload.metrics.recordsReturned ?? null
      },
      message: payload.message,
      messageSource: payload.messageSource,
      status: 'active'
    }));

    const docs = await Alert.insertMany(documents, { ordered: false });
    return docs.map((d) => d.toJSON());
  }

  // Embedded storage fallback
  const created = [];
  alertsPayload.forEach((payload) => {
    const now = new Date().toISOString();
    const alertRecord = {
      id: crypto.randomBytes(12).toString('hex'),
      apiName: payload.apiName,
      anomalyTypes: payload.anomalyTypes,
      severity: payload.severity,
      metrics: {
        responseTimeMs: payload.metrics.responseTimeMs,
        statusCode: payload.metrics.statusCode,
        recordsReturned: payload.metrics.recordsReturned ?? null
      },
      message: payload.message,
      messageSource: payload.messageSource,
      status: 'active',
      createdAt: now,
      updatedAt: now
    };
    embeddedAlerts.push(alertRecord);
    created.push(alertRecord);
  });
  saveEmbeddedAlerts();
  return created;
}

/**
 * Fetches all active alerts matching optional severity and apiName filters.
 * Returns results sorted by createdAt in descending order (Task Section 7.2).
 *
 * @param {object} [filters={}]
 * @param {string} [filters.severity] - 'critical' | 'high' | 'medium' (or 'all')
 * @param {string} [filters.apiName] - Exact API name match (or 'all')
 * @param {number} [filters.limit=200] - Result ceiling
 * @returns {Promise<Array<object>>} Normalized active alert objects
 */
async function getActiveAlerts(filters = {}) {
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 200, 1), 500);

  // Safely extract string filters to prevent TypeError / query injection on object or array inputs
  const targetSeverity = typeof filters.severity === 'string' && filters.severity.trim() !== 'all'
    ? filters.severity.trim().toLowerCase()
    : null;

  const targetApiName = typeof filters.apiName === 'string' && filters.apiName.trim() !== 'all'
    ? filters.apiName.trim()
    : null;

  if (isUsingMongo()) {
    const query = { status: 'active' };

    if (targetSeverity) {
      const validSeverities = ['critical', 'high', 'medium'];
      if (validSeverities.includes(targetSeverity)) {
        query.severity = targetSeverity;
      }
    }

    if (targetApiName) {
      query.apiName = targetApiName;
    }

    const docs = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return docs.map((doc) => ({
      id: doc._id.toString(),
      apiName: doc.apiName,
      anomalyTypes: doc.anomalyTypes,
      severity: doc.severity,
      metrics: doc.metrics,
      message: doc.message,
      messageSource: doc.messageSource,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    }));
  }

  // Embedded storage fallback
  let filtered = embeddedAlerts.filter((a) => a.status === 'active');

  if (targetSeverity) {
    filtered = filtered.filter((a) => a.severity === targetSeverity);
  }

  if (targetApiName) {
    const lowerTarget = targetApiName.toLowerCase();
    filtered = filtered.filter((a) => a.apiName && a.apiName.toLowerCase() === lowerTarget);
  }

  // Sort descending by createdAt (newest first)
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return filtered.slice(0, limit);
}

module.exports = {
  persistAlert,
  persistBatchAlerts,
  getActiveAlerts
};
