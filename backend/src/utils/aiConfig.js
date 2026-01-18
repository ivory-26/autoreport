/**
 * AI Service Configuration and Shared Key Pool
 */

const KeyPoolManager = require('./keyPoolManager');

// Valid Groq Model IDs (as of Jan 2026)
// Using Llama 3.3 70B for high-quality analysis and writing
// Using Llama 3.1 8B as a fast fallback
const MODELS = {
  // Using Llama 3.3 70B as primary - better free tier limits (30 RPM, higher TPM)
  // The specialized models (qwen, gpt-oss) have stricter limits (60 RPM but only 1K RPD, 6K TPM)
  ANALYZER: {
    PRIMARY: 'openai/gpt-oss-120b',
    FALLBACK: 'llama-3.1-8b-instant'
  },
  WRITER: {
    PRIMARY: 'qwen/qwen3-32b',
    FALLBACK: 'llama-3.1-8b-instant'
  }
};

let sharedKeyPool = null;

/**
 * Get or initialize the shared key pool for Groq
 */
function getGroqKeyPool() {
  if (sharedKeyPool) return sharedKeyPool;
  
  const keysString = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY;
  
  if (!keysString) {
    // We'll throw later in the agents to allow app startup even without keys
    return null;
  }
  
  sharedKeyPool = new KeyPoolManager(keysString, 'Groq-Shared-Pool');
  return sharedKeyPool;
}

module.exports = {
  MODELS,
  getGroqKeyPool
};
