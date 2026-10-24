const pLimit = require('p-limit');
const env = require('../config/env');
const logger = require('../utils/logger');
const { detectAnomalies } = require('./anomalyService');
const { generateAlertMessage } = require('./aiService');
const { persistAlert } = require('./alertService');
const { sendAlertDigest } = require('./emailService');

const CONCURRENCY_LIMIT = env.LLM_CONCURRENCY || 5;

/**
 * Processes a single monitoring item.
 *
 * @param {object} item
 * @returns {Promise<{ status: 'healthy' | 'anomaly', alert?: object }>}
 */
async function processSingleItem(item) {
  // 1. Health evaluation and anomaly detection
  const evaluation = detectAnomalies(item);

  if (!evaluation.isAnomaly) {
    return { status: 'healthy', apiName: item.api_name };
  }

  logger.warn(`[Pipeline] Anomaly detected for "${evaluation.apiName}": [${evaluation.anomalyTypes.join(', ')}] with severity="${evaluation.severity}"`, {
    metrics: evaluation.metrics
  });

  // 2. Anomaly detected: generate human-readable message (AI or fallback)
  const { message, source } = await generateAlertMessage(evaluation);

  // 3. Persist the anomaly to MongoDB as 'active'
  const savedAlert = await persistAlert({
    apiName: evaluation.apiName,
    anomalyTypes: evaluation.anomalyTypes,
    severity: evaluation.severity,
    metrics: evaluation.metrics,
    message,
    messageSource: source
  });

  return {
    status: 'anomaly',
    alert: savedAlert
  };
}

/**
 * Ingests a batch of API metrics, orchestrating health checks, AI generation, and persistence.
 *
 * @param {object} params
 * @param {Array<object>} params.validItems - Schema-validated API metric items
 * @param {Array<object>} [params.invalidItems=[]] - Partitioned malformed items
 * @param {string} [params.requestId='system'] - Tracing ID
 * @returns {Promise<{ summary: object, alerts: Array<object> }>}
 */
async function processBatch({ validItems = [], invalidItems = [], requestId = 'system' }) {
  const startTime = Date.now();
  const limit = pLimit(CONCURRENCY_LIMIT);

  logger.info(`[Batch ${requestId}] Processing batch: ${validItems.length} valid, ${invalidItems.length} invalid items.`);

  const itemTasks = validItems.map((item) =>
    limit(async () => {
      try {
        return await processSingleItem(item);
      } catch (err) {
        logger.error(`[Batch ${requestId}] Error processing item for "${item.api_name}": ${err.message}`, {
          item,
          error: err.stack
        });
        throw err;
      }
    })
  );

  const settledResults = await Promise.allSettled(itemTasks);

  let healthyCount = 0;
  let anomaliesDetectedCount = 0;
  let alertsCreatedCount = 0;
  let failuresCount = 0;
  const createdAlerts = [];

  settledResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      const val = result.value;
      if (val.status === 'healthy') {
        healthyCount++;
      } else if (val.status === 'anomaly') {
        anomaliesDetectedCount++;
        alertsCreatedCount++;
        if (val.alert) {
          createdAlerts.push(val.alert);
        }
      }
    } else {
      failuresCount++;
    }
  });

  const durationMs = Date.now() - startTime;

  const summary = {
    processed: validItems.length,
    healthy: healthyCount,
    anomaliesDetected: anomaliesDetectedCount,
    alertsCreated: alertsCreatedCount,
    invalidItems: invalidItems.length,
    failures: failuresCount,
    durationMs
  };

  logger.info(`[Batch ${requestId}] Batch complete in ${durationMs}ms:`, summary);

  // Trigger optional non-blocking email alert digest
  sendAlertDigest(createdAlerts, summary).catch((err) => {
    logger.error(`[Batch ${requestId}] Background email digest failed: ${err.message}`);
  });

  return {
    summary,
    alerts: createdAlerts
  };
}

module.exports = {
  processBatch,
  processSingleItem
};
