const env = require('../config/env');
const logger = require('../utils/logger');
const { buildUserPrompt } = require('../prompts/alertPrompt');
const { generateFallbackMessage } = require('./fallbackMessages');
const { callGemini } = require('./providers/gemini');
const { callOpenAI } = require('./providers/openai');

/**
 * Sanitizes raw LLM output text.
 * Strips markdown formatting, surrounding quotes, and enforces length bounds.
 */
function cleanOutput(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  return rawText
    .replace(/^["']|["']$/g, '')               // Strip outer quotes
    .replace(/[*_#`]/g, '')                     // Strip markdown syntax
    .replace(/^(Alert|Warning|Notice):\s*/i, '') // Strip redundant prefixes
    .replace(/\s+/g, ' ')                       // Collapse multiple spaces/newlines
    .trim()
    .slice(0, 300);                             // Enforce 300-character cap
}

/**
 * Determines whether an error is transient and eligible for a single retry.
 */
function isTransientError(error) {
  if (!error) return false;

  // Do not retry on client errors (4xx)
  if (error.status && error.status >= 400 && error.status < 500) {
    return false;
  }

  // Retry on server errors (5xx)
  if (error.status && error.status >= 500) {
    return true;
  }

  // Retry on network drops / socket timeouts / fetch aborts
  const transientCodes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT'];
  if (transientCodes.includes(error.code)) {
    return true;
  }

  if (error.name === 'AbortError' || error.name === 'TimeoutError') {
    return true;
  }

  if (error.message && /fetch failed|network|timeout/i.test(error.message)) {
    return true;
  }

  return false;
}

/**
 * Dispatches invocation to the configured LLM provider.
 */
async function invokeProvider(prompt, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const provider = env.LLM_PROVIDER;
    const apiKey = env.LLM_API_KEY;
    const model = env.LLM_MODEL;

    if (provider === 'openai') {
      return await callOpenAI({ prompt, apiKey, model, signal: controller.signal });
    }

    // Default provider is Google Gemini
    return await callGemini({ prompt, apiKey, model, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generates an operational alert message for a detected anomaly.
 * Returns { message, source: 'ai' | 'fallback' }.
 * Never throws unhandled errors to the caller.
 *
 * @param {object} anomalyResult - Normalized anomaly result object
 * @returns {Promise<{ message: string, source: 'ai' | 'fallback' }>}
 */
async function generateAlertMessage(anomalyResult) {
  // 1. If no API key is configured, immediately use deterministic fallback without network overhead
  if (!env.LLM_API_KEY) {
    return {
      message: generateFallbackMessage(anomalyResult),
      source: 'fallback'
    };
  }

  const prompt = buildUserPrompt(anomalyResult);
  const timeoutMs = env.LLM_TIMEOUT_MS;
  const startTime = Date.now();
  let lastError = null;

  // 2. Attempt call with at most 1 retry for transient errors
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const rawResponse = await invokeProvider(prompt, timeoutMs);
      const cleaned = cleanOutput(rawResponse);

      if (cleaned.length > 0) {
        const durationMs = Date.now() - startTime;
        logger.info(`[AI Service] Generated alert using provider="${env.LLM_PROVIDER}" model="${env.LLM_MODEL}" in ${durationMs}ms (attempt ${attempt})`);
        return {
          message: cleaned,
          source: 'ai'
        };
      }

      throw new Error('LLM generated an empty cleaned message');
    } catch (err) {
      lastError = err;
      const isRetryable = attempt === 1 && isTransientError(err);

      logger.warn(`[AI Service] Provider "${env.LLM_PROVIDER}" attempt ${attempt} failed: ${err.message}. ${isRetryable ? 'Retrying in 500ms...' : 'No further retries.'}`);

      if (isRetryable) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        break;
      }
    }
  }

  // 3. Fallback on error or non-retryable failure
  const totalDuration = Date.now() - startTime;
  logger.error(`[AI Service] Failed to generate AI alert after ${totalDuration}ms. Falling back to deterministic template. Error: ${lastError?.message}`);

  return {
    message: generateFallbackMessage(anomalyResult),
    source: 'fallback'
  };
}

module.exports = {
  generateAlertMessage,
  cleanOutput,
  isTransientError
};
