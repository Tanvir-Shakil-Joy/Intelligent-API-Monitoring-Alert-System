const env = require('../config/env');

/**
 * Returns the active latency anomaly thresholds from environment configuration.
 *
 * @returns {{ slowThresholdMs: number, verySlowThresholdMs: number }}
 */
function getThresholds() {
  return {
    slowThresholdMs: env.SLOW_THRESHOLD_MS || 3000,
    verySlowThresholdMs: env.VERY_SLOW_THRESHOLD_MS || 5000
  };
}

module.exports = { getThresholds };
