/**
 * NVIDIA NIM API Client
 * Thin wrapper around axios for calling NVIDIA NIM chat/completions endpoint.
 * Keeps chunking, token-limit, and key-pool logic aligned with the rest of backend.
 */

const axios = require('axios');

const INVOKE_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

/**
 * Call NVIDIA NIM chat completions endpoint
 * @param {Object} params
 * @param {string} params.apiKey - NVIDIA API key
 * @param {string} params.model - Model name, e.g. 'moonshotai/kimi-k2.6'
 * @param {Array} params.messages - OpenAI-style messages array
 * @param {number} [params.maxTokens=16384] - max_tokens
 * @param {number} [params.temperature=1.0] - temperature
 * @param {number} [params.topP=1.0] - top_p
 * @param {boolean} [params.stream=false] - stream flag (default false for our use-case)
 * @param {Object} [params.extraPayload={}] - extra fields merged into payload
 * @param {number} [params.timeoutMs=120000] - axios request timeout
 * @returns {Promise<Object>} - Parsed response object (non-stream)
 */
async function callNimChatCompletion({
  apiKey,
  model,
  messages,
  maxTokens = 16384,
  temperature = 1.0,
  topP = 1.0,
  stream = false,
  extraPayload = {},
  timeoutMs = 120000
}) {
  if (!apiKey) {
    throw new Error('NVIDIA API key is required.');
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Accept: stream ? 'text/event-stream' : 'application/json',
    'Content-Type': 'application/json'
  };

  const payload = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    top_p: topP,
    stream,
    ...extraPayload
  };

  const response = await axios.post(INVOKE_URL, payload, {
    headers,
    timeout: timeoutMs,
    responseType: stream ? 'stream' : 'json'
  });

  // For non-stream, return parsed JSON directly
  return response.data;
}

/**
 * Safely extracts the assistant message content from a NIM response.
 * Handles both standard OpenAI-style shape and minimal shapes.
 * @param {Object} responseData - JSON response from NIM
 * @returns {string} - Assistant content text
 */
function extractNimContent(responseData) {
  if (!responseData) return '';
  if (typeof responseData === 'string') return responseData;

  // OpenAI-compatible shape
  if (responseData.choices && responseData.choices.length > 0) {
    const choice = responseData.choices[0];
    if (choice.message && typeof choice.message.content === 'string') {
      return choice.message.content;
    }
    if (typeof choice.text === 'string') {
      return choice.text;
    }
  }

  // Fallback to any string field
  if (typeof responseData.content === 'string') {
    return responseData.content;
  }

  if (typeof responseData.text === 'string') {
    return responseData.text;
  }

  return JSON.stringify(responseData);
}

module.exports = {
  callNimChatCompletion,
  extractNimContent,
  INVOKE_URL
};
