/**
 * API Key Pool Manager
 * 
 * Manages rotation of multiple API keys to bypass rate limits
 * and improve throughput for LLM requests.
 * 
 * Supports:
 * - Round-robin key selection
 * - Per-key usage tracking
 * - Graceful fallback to single key
 * - Key health monitoring
 */

class KeyPoolManager {
  constructor(keyString, serviceName = 'API') {
    this.serviceName = serviceName;
    this.currentIndex = 0;
    this.keys = [];
    this.keyStats = new Map();
    
    // Parse keys from environment variable (comma-separated)
    if (keyString) {
      this.keys = keyString
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
    }
    
    if (this.keys.length === 0) {
      throw new Error(`${serviceName}: No API keys provided`);
    }
    
    // Initialize stats for each key
    this.keys.forEach((key, index) => {
      this.keyStats.set(index, {
        key: `Key-${index + 1}`, // Just show index, not masked key
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        rateLimitHits: 0,
        lastUsed: null,
        isHealthy: true
      });
    });
    
    console.log(`[${serviceName}] Initialized key pool with ${this.keys.length} key(s)`);
  }
  
  /**
   * Get the next available API key (round-robin)
   * @returns {Object} - { key: string, keyIndex: number, masked: string }
   */
  getNextKey() {
    // Simple round-robin
    const keyIndex = this.currentIndex;
    const key = this.keys[keyIndex];
    
    // Move to next key for next request
    this.currentIndex = (this.currentIndex + 1) % this.keys.length;
    
    // Update stats
    const stats = this.keyStats.get(keyIndex);
    stats.totalRequests++;
    stats.lastUsed = new Date();
    
    return {
      key,
      keyIndex,
      masked: this.maskKey(key),
      poolSize: this.keys.length
    };
  }
  
  /**
   * Record a successful request for a key
   * @param {number} keyIndex - Index of the key that was used
   */
  recordSuccess(keyIndex) {
    const stats = this.keyStats.get(keyIndex);
    if (stats) {
      stats.successfulRequests++;
      stats.isHealthy = true;
    }
  }
  
  /**
   * Record a failed request for a key
   * @param {number} keyIndex - Index of the key that was used
   * @param {boolean} isRateLimit - Whether the failure was due to rate limiting
   */
  recordFailure(keyIndex, isRateLimit = false) {
    const stats = this.keyStats.get(keyIndex);
    if (stats) {
      stats.failedRequests++;
      if (isRateLimit) {
        stats.rateLimitHits++;
        console.warn(`[${this.serviceName}] Rate limit hit for key ${stats.key}`);
      }
    }
  }
  
  /**
   * Get statistics for all keys
   * @returns {Array} - Array of key statistics
   */
  getStats() {
    const statsArray = [];
    this.keyStats.forEach((stats, index) => {
      statsArray.push({
        index,
        ...stats,
        successRate: stats.totalRequests > 0 
          ? ((stats.successfulRequests / stats.totalRequests) * 100).toFixed(2) + '%'
          : 'N/A'
      });
    });
    return statsArray;
  }
  
  /**
   * Mask API key for logging (show first 8 and last 4 chars)
   * @param {string} key - API key to mask
   * @returns {string} - Masked key
   */
  maskKey(key) {
    if (!key || key.length < 16) return '***';
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  }
  
  /**
   * Get total number of keys in the pool
   * @returns {number}
   */
  getPoolSize() {
    return this.keys.length;
  }
  
  /**
   * Check if using multiple keys
   * @returns {boolean}
   */
  isMultiKey() {
    return this.keys.length > 1;
  }
}

module.exports = KeyPoolManager;
