/**
 * AI Service Configuration and Shared Key Pool
 */

const KeyPoolManager = require('./keyPoolManager');

// Valid Groq Model IDs (as of Jan 2026)
// Using Llama 3.3 70B for high-quality analysis and writing
// Using Llama 3.1 8B as a fast fallback
const MODELS = {
  ANALYZER: {
    PRIMARY: 'openai/gpt-oss-120b',
    FALLBACK: 'meta-llama/llama-4-scout-17b-16e-instruct'
  },
  WRITER: {
    PRIMARY: 'qwen/qwen3-32b',
    FALLBACK: 'meta-llama/llama-4-scout-17b-16e-instruct'
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
