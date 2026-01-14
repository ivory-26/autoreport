/**
 * Timeout utility for wrapping promises with timeout protection
 * Prevents AI calls from hanging indefinitely
 */

class TimeoutError extends Error {
  constructor(message, timeoutMs) {
    super(message);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.code = 'TIMEOUT';
  }
}

/**
 * Wraps a promise with a timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of the operation for error messages
 * @returns {Promise} - The wrapped promise
 */
async function withTimeout(promise, timeoutMs, operationName = 'Operation') {
  let timeoutId;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(
        `${operationName} timed out after ${timeoutMs}ms`,
        timeoutMs
      ));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Creates a timeout wrapper with preset configuration
 * @param {number} defaultTimeoutMs - Default timeout in milliseconds
 * @returns {Function} - Configured timeout wrapper
 */
function createTimeoutWrapper(defaultTimeoutMs = 30000) {
  return (promise, operationName) => withTimeout(promise, defaultTimeoutMs, operationName);
}

/**
 * Get timeout value from environment or use default
 * @param {number} defaultMs - Default timeout in milliseconds
 * @returns {number} - Timeout value in milliseconds
 */
function getTimeoutFromEnv(defaultMs = 30000) {
  const envTimeout = process.env.AI_TIMEOUT_MS;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return defaultMs;
}

module.exports = {
  withTimeout,
  createTimeoutWrapper,
  getTimeoutFromEnv,
  TimeoutError
};
