/**
 * API Key Pool Manager
 * 
 * Manages rotation of multiple API keys to bypass rate limits
 * and improve throughput for LLM requests.
 * 
 * Supports:
 * - Job-level key assignment (same key for all calls in a job)
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
    this.jobKeyAssignments = new Map(); // Track which key is assigned to which job
    
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
   * Assign a key to a specific job. This key will be used for all API calls within this job.
   * @param {string} jobId - Unique identifier for the job
   * @returns {Object} - { key: string, keyIndex: number, masked: string }
   */
  assignKeyForJob(jobId) {
    // Check if this job already has a key assigned
    if (this.jobKeyAssignments.has(jobId)) {
      const keyIndex = this.jobKeyAssignments.get(jobId);
      return {
        key: this.keys[keyIndex],
        keyIndex,
        masked: this.maskKey(this.keys[keyIndex]),
        poolSize: this.keys.length
      };
    }
    
    // Select a key using round-robin, skipping unhealthy keys if possible
    let attempts = 0;
    let selectedIndex = this.currentIndex;
    
    while (attempts < this.keys.length) {
      const stats = this.keyStats.get(selectedIndex);
      const now = Date.now();
      
      // Auto-heal if enough time passed
      if (!stats.isHealthy && stats.lastUsed && (now - stats.lastUsed.getTime() > 60000)) {
        stats.isHealthy = true;
      }
      
      if (stats.isHealthy) {
        break;
      }
      
      selectedIndex = (selectedIndex + 1) % this.keys.length;
      attempts++;
    }
    
    // If all keys are unhealthy, just use the original round-robin choice
    if (attempts >= this.keys.length) {
      selectedIndex = this.currentIndex;
    }
    
    this.currentIndex = (selectedIndex + 1) % this.keys.length;
    
    // Store the assignment
    this.jobKeyAssignments.set(jobId, selectedIndex);
    
    const stats = this.keyStats.get(selectedIndex);
    stats.lastUsed = new Date();
    
    console.log(`[${this.serviceName}] Assigned ${stats.key} to job ${jobId.substring(0, 8)}`);
    
    return {
      key: this.keys[selectedIndex],
      keyIndex: selectedIndex,
      masked: this.maskKey(this.keys[selectedIndex]),
      poolSize: this.keys.length
    };
  }
  
  /**
   * Get the key for a job (must be already assigned via assignKeyForJob)
   * @param {string} jobId - Job identifier
   * @returns {Object|null} - Key info or null if not assigned
   */
  getKeyForJob(jobId) {
    const keyIndex = this.jobKeyAssignments.get(jobId);
    if (keyIndex === undefined) {
      return null;
    }
    
    const stats = this.keyStats.get(keyIndex);
    stats.totalRequests++;
    stats.lastUsed = new Date();
    
    return {
      key: this.keys[keyIndex],
      keyIndex,
      masked: this.maskKey(this.keys[keyIndex]),
      poolSize: this.keys.length
    };
  }
  
  /**
   * Release a job's key assignment (call when job completes)
   * @param {string} jobId - Job identifier
   */
  releaseJobKey(jobId) {
    this.jobKeyAssignments.delete(jobId);
  }

  /**
   * Explicitly rotate the key assigned to a job (call when a key hits rate limit)
   * @param {string} jobId - Job identifier
   * @returns {Object} - New key info
   */
  rotateKeyForJob(jobId) {
    // Force removal of current assignment so assignKeyForJob picks a new one
    this.jobKeyAssignments.delete(jobId);
    return this.assignKeyForJob(jobId);
  }
  
  /**
   * Get an API key using random selection from healthy keys
   * @returns {Promise<Object>} - { key: string, keyIndex: number, masked: string }
   */
  async getNextKey() {
    const now = Date.now();
    
    // Filter for healthy keys
    const healthyIndices = [];
    this.keyStats.forEach((stats, index) => {
      if (stats.isHealthy) {
        healthyIndices.push(index);
      } else {
        const lastUsed = stats.lastUsed ? stats.lastUsed.getTime() : 0;
        if (now - lastUsed > 60000) {
          stats.isHealthy = true;
          healthyIndices.push(index);
        }
      }
    });

    const choices = healthyIndices.length > 0 ? healthyIndices : Array.from(this.keyStats.keys());
    const randomIndex = Math.floor(Math.random() * choices.length);
    const selectedIndex = choices[randomIndex];

    const stats = this.keyStats.get(selectedIndex);
    stats.totalRequests++;
    stats.lastUsed = new Date();
    
    return {
      key: this.keys[selectedIndex],
      keyIndex: selectedIndex,
      masked: this.maskKey(this.keys[selectedIndex]),
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
        stats.isHealthy = false; // Mark temporarily unhealthy
        console.warn(`[${this.serviceName}] Rate limit hit for key ${stats.key}. Marking as unhealthy for 60s.`);
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
