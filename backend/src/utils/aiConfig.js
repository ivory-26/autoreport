/**
 * AI Service Configuration and Shared Key Pool
 * Unified NVIDIA NIM API client
 */

const KeyPoolManager = require('./keyPoolManager');

// NVIDIA NIM model IDs
const MODELS = {
  ANALYZER: {
    PRIMARY: 'moonshotai/kimi-k2.6',
    FALLBACK: 'meta/llama-3.1-8b-instruct'
  },
  WRITER: {
    PRIMARY: 'moonshotai/kimi-k2.6',
    FALLBACK: 'meta/llama-3.1-8b-instruct'
  }
};

let sharedKeyPool = null;

/**
 * Get or initialize the shared key pool for NVIDIA NIM
 */
function getNimKeyPool() {
  if (sharedKeyPool) return sharedKeyPool;

  const keysString = process.env.NVIDIA_API_KEYS || process.env.NVIDIA_API_KEY;

  if (!keysString) {
    return null;
  }

  sharedKeyPool = new KeyPoolManager(keysString, 'NVIDIA-NIM-Pool');
  return sharedKeyPool;
}

module.exports = {
  MODELS,
  getNimKeyPool
};
