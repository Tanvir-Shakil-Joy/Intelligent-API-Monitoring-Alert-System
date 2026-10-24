const { SYSTEM_PROMPT } = require('../../prompts/alertPrompt');

/**
 * Invokes OpenAI API with timeout signal.
 *
 * @param {object} params
 * @param {string} params.prompt - User prompt string
 * @param {string} params.apiKey - OpenAI API key
 * @param {string} [params.model='gpt-4o-mini'] - Model identifier
 * @param {AbortSignal} params.signal - AbortController signal
 * @returns {Promise<string>} Raw generated text
 */
async function callOpenAI({ prompt, apiKey, model = 'gpt-4o-mini', signal }) {
  const url = 'https://api.openai.com/v1/chat/completions';

  const payload = {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 120,
    top_p: 0.8
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const err = new Error(`OpenAI API error (HTTP ${response.status}): ${errorText.slice(0, 200)}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('OpenAI API returned an empty or invalid completion response');
  }

  return content;
}

module.exports = { callOpenAI };
