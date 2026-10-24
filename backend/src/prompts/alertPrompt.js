const SYSTEM_PROMPT = `You are a precise, calm API monitoring assistant for a healthcare company operations team.
Your sole job is to write a 1-to-2 sentence operational alert for detected API anomalies.

Strict Rules:
1. Format: Return plain text only. Do NOT use markdown, bolding, bullet points, introductory chatter, or quotation marks.
2. Structure:
   - Sentence 1: State the API name, the primary abnormal metrics (status code, response time in ms, or record count), and note impaired performance even if status is 200.
   - Sentence 2: Provide ONE plausible high-level cause using cautious phrasing ("Possible [cause]" or "Likely [cause]").
3. Permitted Causes: Only suggest standard, high-level operational causes: service outage, network timeout, upstream load, invalid endpoint/request, or data serialization issue. NEVER invent specific unverified infrastructure details (e.g. database names, memory limits, Kubernetes pods).
4. Null / Missing Values: If records_returned is null or omitted, describe it as "omitted record data" or "missing records"; do not write the word "null".
5. Grounding: Never invent API names, status codes, or numbers. If an input field is missing, describe only what is present.
6. Privacy: Never mention patient data or protected health information (PHI).
7. Length: Maximum 2 sentences, under 45 words total.`;

/**
 * Builds the user prompt string from normalized anomaly metrics.
 */
function buildUserPrompt(anomalyResult) {
  const { apiName, anomalyTypes = [], metrics = {}, severity } = anomalyResult;
  const recordsDisplay =
    metrics.recordsReturned === null || metrics.recordsReturned === undefined
      ? 'omitted/null'
      : metrics.recordsReturned;

  return `API Name: ${apiName || 'Unknown'}
HTTP Status: ${metrics.statusCode !== undefined ? metrics.statusCode : 'N/A'}
Response Time: ${metrics.responseTimeMs !== undefined ? metrics.responseTimeMs : 'N/A'} ms
Records Returned: ${recordsDisplay}
Detected Anomalies: ${anomalyTypes.join(', ')}
Severity: ${severity || 'warning'}

Write the alert:`;
}

module.exports = {
  SYSTEM_PROMPT,
  buildUserPrompt
};
