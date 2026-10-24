const { SYSTEM_PROMPT } = require('../../prompts/alertPrompt');

/**
 * Invokes Google Gemini API with timeout signal.
 *
 * @param {object} params
 * @param {string} params.prompt - User prompt string
 * @param {string} params.apiKey - Gemini API key
 * @param {string} [params.model='gemini-1.5-flash'] - Model identifier
 * @param {AbortSignal} params.signal - AbortController signal
 * @returns {Promise<string>} Raw generated text
 */
async function callGemini({ prompt, apiKey, model = 'gemini-3.5-flash-lite', signal }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const payload = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 120,
      topP: 0.8
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const err = new Error(`Gemini API error (HTTP ${response.status}): ${errorText.slice(0, 200)}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const candidateText = candidate?.content?.parts?.find((p) => typeof p.text === 'string')?.text
    || candidate?.content?.parts?.[0]?.text;

  if (!candidateText) {
    throw new Error('Gemini API returned an empty or invalid candidate response');
  }

  return candidateText;
}

module.exports = { callGemini };
