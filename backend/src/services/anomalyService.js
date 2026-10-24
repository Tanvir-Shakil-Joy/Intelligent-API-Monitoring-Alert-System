const { getThresholds } = require('../utils/thresholds');

const ANOMALY_TYPES = Object.freeze({
  SERVER_ERROR: 'SERVER_ERROR',
  CLIENT_ERROR: 'CLIENT_ERROR',
  HIGH_RESPONSE_TIME: 'HIGH_RESPONSE_TIME',
  ZERO_RECORDS: 'ZERO_RECORDS'
});

const SEVERITIES = Object.freeze({
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium'
});

const SEVERITY_WEIGHTS = Object.freeze({
  [SEVERITIES.CRITICAL]: 3,
  [SEVERITIES.HIGH]: 2,
  [SEVERITIES.MEDIUM]: 1
});

/**
 * Resolves overall severity using the highest-severity-wins model.
 *
 * @param {Array<'critical'|'high'|'medium'>} severities
 * @returns {'critical'|'high'|'medium'|null}
 */
function resolveOverallSeverity(severities) {
  if (!severities || severities.length === 0) return null;

  return severities.reduce((highest, current) => {
    const currentWeight = SEVERITY_WEIGHTS[current] || 0;
    const highestWeight = SEVERITY_WEIGHTS[highest] || 0;
    return currentWeight > highestWeight ? current : highest;
  }, severities[0]);
}

/**
 * Pure, deterministic evaluation of an API response against health criteria.
 *
 * @param {object} item
 * @param {string} item.api_name
 * @param {number} item.response_time_ms
 * @param {number} item.status_code
 * @param {number|null|undefined} [item.records_returned]
 * @param {object} [options]
 * @param {number} [options.slowThresholdMs]
 * @param {number} [options.verySlowThresholdMs]
 * @returns {object} Normalized anomaly evaluation result
 */
function detectAnomalies(item, options = {}) {
  const { slowThresholdMs, verySlowThresholdMs } = {
    ...getThresholds(),
    ...options
  };

  const detectedAnomalies = [];

  // 1. Latency Anomalies (High vs. Medium)
  if (item.response_time_ms > verySlowThresholdMs) {
    detectedAnomalies.push({
      type: ANOMALY_TYPES.HIGH_RESPONSE_TIME,
      severity: SEVERITIES.HIGH,
      message: `Response time of ${item.response_time_ms}ms exceeds high latency threshold of ${verySlowThresholdMs}ms`
    });
  } else if (item.response_time_ms > slowThresholdMs) {
    detectedAnomalies.push({
      type: ANOMALY_TYPES.HIGH_RESPONSE_TIME,
      severity: SEVERITIES.MEDIUM,
      message: `Response time of ${item.response_time_ms}ms exceeds warning threshold of ${slowThresholdMs}ms`
    });
  }

  // 2. HTTP Status Code Anomalies (5xx Critical, 4xx Medium)
  if (item.status_code >= 500 && item.status_code <= 599) {
    detectedAnomalies.push({
      type: ANOMALY_TYPES.SERVER_ERROR,
      severity: SEVERITIES.CRITICAL,
      message: `Server returned HTTP status ${item.status_code}`
    });
  } else if (item.status_code >= 400 && item.status_code <= 499) {
    detectedAnomalies.push({
      type: ANOMALY_TYPES.CLIENT_ERROR,
      severity: SEVERITIES.MEDIUM,
      message: `Client error with HTTP status ${item.status_code}`
    });
  }

  // 3. Missing or Zero Records (0, null, or undefined -> High)
  const isRecordsMissingOrZero =
    item.records_returned === 0 ||
    item.records_returned === null ||
    item.records_returned === undefined;

  if (isRecordsMissingOrZero) {
    const displayValue = item.records_returned === undefined ? 'omitted' : String(item.records_returned);
    detectedAnomalies.push({
      type: ANOMALY_TYPES.ZERO_RECORDS,
      severity: SEVERITIES.HIGH,
      message: `API returned zero or missing records (value: ${displayValue})`
    });
  }

  const isAnomaly = detectedAnomalies.length > 0;
  const severities = detectedAnomalies.map((a) => a.severity);
  const overallSeverity = resolveOverallSeverity(severities);
  const anomalyTypes = [...new Set(detectedAnomalies.map((a) => a.type))];

  return {
    apiName: item.api_name,
    isAnomaly,
    severity: overallSeverity,
    anomalyTypes,
    anomalies: detectedAnomalies,
    metrics: {
      responseTimeMs: item.response_time_ms,
      statusCode: item.status_code,
      recordsReturned: item.records_returned !== undefined ? item.records_returned : null
    }
  };
}

module.exports = {
  detectAnomalies,
  resolveOverallSeverity,
  ANOMALY_TYPES,
  SEVERITIES
};
