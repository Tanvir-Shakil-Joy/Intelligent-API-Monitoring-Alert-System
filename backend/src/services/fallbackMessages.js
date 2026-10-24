/**
 * Generates a clean, deterministic 1-to-2 sentence alert message when AI generation is unavailable.
 * Never throws errors; gracefully handles partial or missing metrics.
 *
 * @param {object} params
 * @param {string} [params.apiName='Monitored API']
 * @param {Array<string>} [params.anomalyTypes=[]]
 * @param {object} [params.metrics={}]
 * @param {number} [params.metrics.responseTimeMs]
 * @param {number} [params.metrics.statusCode]
 * @param {number|null} [params.metrics.recordsReturned]
 * @returns {string} 1-to-2 sentence plain text alert message
 */
function generateFallbackMessage(params = {}) {
  const { apiName, anomalyTypes = [], metrics = {} } = params;
  const safeName = (apiName && typeof apiName === 'string' && apiName.trim()) ? apiName.trim() : 'Monitored API';
  const statusCode = metrics.statusCode;
  const responseTimeMs = metrics.responseTimeMs;
  const recordsReturned = metrics.recordsReturned;

  const isServerError = anomalyTypes.includes('SERVER_ERROR') || (statusCode >= 500 && statusCode <= 599);
  const isClientError = anomalyTypes.includes('CLIENT_ERROR') || (statusCode >= 400 && statusCode <= 499);
  const isLatencyHigh = anomalyTypes.includes('HIGH_RESPONSE_TIME');
  const isZeroOrMissingRecords = anomalyTypes.includes('ZERO_RECORDS') || recordsReturned === 0 || recordsReturned === null;

  // --- Scenario 1: Compound Server Error + Zero/Missing Records (Reference Task Example) ---
  if (isServerError && isZeroOrMissingRecords) {
    const recordsText = recordsReturned === null || recordsReturned === undefined ? 'omitted record data' : `${recordsReturned} records`;
    const latencySuffix = responseTimeMs ? ` in ${responseTimeMs} ms` : '';
    return `${safeName} failed with status ${statusCode || 500}${latencySuffix} and returned ${recordsText}. Possible outage or data issue.`;
  }

  // --- Scenario 2: Server Error (5xx) with or without High Latency ---
  if (isServerError) {
    const latencyPart = responseTimeMs ? ` after ${responseTimeMs} ms` : '';
    return `${safeName} failed with HTTP status ${statusCode || 500}${latencyPart}. Possible service outage or backend failure.`;
  }

  // --- Scenario 3: Client Error (4xx) ---
  if (isClientError) {
    const recordsPart = isZeroOrMissingRecords ? ' with no records returned' : '';
    return `${safeName} returned client error status ${statusCode || 400}${recordsPart}. Possible invalid request parameters or missing resource.`;
  }

  // --- Scenario 4: High Latency with Zero or Missing Records ---
  if (isLatencyHigh && isZeroOrMissingRecords) {
    const recordsText = recordsReturned === null || recordsReturned === undefined ? 'omitted record data' : `${recordsReturned} records`;
    return `${safeName} took ${responseTimeMs || 'elevated'} ms and returned ${recordsText}. Possible slow query or data retrieval issue.`;
  }

  // --- Scenario 5: High Response Time Alone (Status is OK, Records Present) ---
  if (isLatencyHigh) {
    if (typeof recordsReturned === 'number' && recordsReturned > 0) {
      return `${safeName} responded successfully with ${recordsReturned} records but took ${responseTimeMs} ms, well above normal. Possible performance degradation or upstream load.`;
    }
    return `${safeName} experienced elevated response latency of ${responseTimeMs} ms. Possible performance degradation or upstream load.`;
  }

  // --- Scenario 6: Zero or Missing Records Alone (Status 200 and Latency Normal) ---
  if (isZeroOrMissingRecords) {
    if (recordsReturned === 0) {
      return `${safeName} responded successfully with status ${statusCode || 200} but returned 0 records. Possible empty dataset or querying issue.`;
    }
    return `${safeName} responded with status ${statusCode || 200} but omitted record data. Possible data serialization issue.`;
  }

  // --- Fallback Safe Default ---
  const statusInfo = statusCode ? ` (HTTP ${statusCode})` : '';
  return `${safeName} triggered operational warnings${statusInfo}. Possible intermittent connectivity or data issue.`;
}

module.exports = { generateFallbackMessage };
