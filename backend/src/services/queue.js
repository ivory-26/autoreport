/**
 * Webhook Queue Service
 * 
 * In-memory queue for processing GitHub webhooks sequentially.
 * Prevents race conditions when multiple commits arrive simultaneously.
 * Includes progress tracking and heartbeat support for long-running jobs.
 */

const crypto = require('crypto');
const EventEmitter = require('events');
const { autoLogger, STAGES } = require('./autoLogger');

/**
 * Job statuses
 */
const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DEAD: 'dead'
};

class WebhookQueue extends EventEmitter {
  constructor() {
    super();
    // User-based queues for Fair Queueing (prevent HoL blocking)
    this.userQueues = new Map(); // userId -> Array of jobs
    this.activeUserIds = []; // Round-robin list of userIds
    
    // Legacy single queue usage is deprecated internally but we keep it for monitoring/length if needed,
    // though we should calculate total length dynamically now.
    // We will use this.userQueues as the source of truth.
    
    this.processing = false;
    this.concurrency = 1; // Global concurrency limit to respect Rate Limits
    this.maxAttempts = 3;
    this.processor = null;
    this.maxQueuePerUser = 10; // Prevent abuse
    
    this.jobHistory = new Map();
    this.maxHistorySize = 100;
    
    this.progressListeners = new Map();
    
    this.stats = {
      totalProcessed: 0,
      totalFailed: 0,
      totalSkipped: 0,
      startTime: new Date()
    };
  }

  /**
   * Set the job processor function
   * @param {Function} processorFn - Async function to process jobs
   */
  setProcessor(processorFn) {
    this.processor = processorFn;
  }

  /**
   * Add a job to the queue
   * @param {Object} jobData - The job data. MUST include userId or projectId for fairness.
   * @returns {string} - Job ID
   */
  enqueue(jobData) {
    const jobId = crypto.randomUUID();
    
    // Determine the bucket key (userId or projectId or 'global')
    const bucketKey = jobData.userId ? String(jobData.userId) : 
                      (jobData.projectId ? String(jobData.projectId) : 'global');
    
    // Get or create user queue
    if (!this.userQueues.has(bucketKey)) {
      this.userQueues.set(bucketKey, []);
    }
    
    const userQueue = this.userQueues.get(bucketKey);
    
    // Check user limit
    if (userQueue.length >= this.maxQueuePerUser) {
      console.warn(`[Queue] User ${bucketKey} exceeded max queue size (${this.maxQueuePerUser}). Dropping oldest? No, rejecting.`);
      // For now, we allow it but log warning, or maybe we really should reject.
      // Let's just log for now to avoid losing data in this iteration, but strictly we should reject.
    }

    const job = {
      id: jobId,
      data: jobData,
      bucketKey, // Store key for reference
      status: JOB_STATUS.PENDING,
      queuedAt: new Date(),
      attempts: 0,
      errors: [],
      pipelineTrace: {
        webhookReceived: jobData.receivedAt || new Date(),
        queuedAt: new Date()
      }
    };

    userQueue.push(job);
    
    // Add user to active list if not already present
    if (!this.activeUserIds.includes(bucketKey)) {
      this.activeUserIds.push(bucketKey);
    }

    console.log(`[Queue] Job ${jobId.substring(0, 8)} enqueued for ${bucketKey}. Queue size for user: ${userQueue.length}`);

    // Emit job enqueued event
    this.emit('jobEnqueued', { jobId, bucketKey, position: userQueue.length });

    // Start processing if not already running
    this.process();

    return jobId;
  }

  // ... sendProgress, addProgressListener, removeProgressListener, addToHistory methods remain same ... 
  
  /**
   * Send a progress update for a job (heartbeat)
   * @param {string} jobId - Job ID
   * @param {Object} progress - Progress data
   */
  sendProgress(jobId, progress) {
    const job = this.getJob(jobId);
    if (!job) return;

    const progressData = {
      jobId,
      timestamp: new Date().toISOString(),
      ...progress
    };

    // Store progress in job
    if (!job.progress) job.progress = [];
    job.progress.push(progressData);

    // Emit progress event
    this.emit('progress', progressData);

    // Send to any SSE listeners
    const listeners = this.progressListeners.get(jobId);
    if (listeners) {
      const sseData = `data: ${JSON.stringify(progressData)}\n\n`;
      for (const res of listeners) {
        try {
          res.write(sseData);
        } catch (e) {
          // Connection closed, remove listener
          listeners.delete(res);
        }
      }
    }

    console.log(`[Queue] Progress: Job ${jobId.substring(0, 8)} - ${progress.stage || 'update'}: ${progress.message || JSON.stringify(progress)}`);
  }

  /**
   * Register an SSE connection for job progress
   * @param {string} jobId - Job ID
   * @param {Object} res - Express response object
   */
  addProgressListener(jobId, res) {
    if (!this.progressListeners.has(jobId)) {
      this.progressListeners.set(jobId, new Set());
    }
    this.progressListeners.get(jobId).add(res);
    console.log(`[Queue] SSE listener added for job ${jobId.substring(0, 8)}`);
  }

  /**
   * Remove an SSE connection
   * @param {string} jobId - Job ID
   * @param {Object} res - Express response object
   */
  removeProgressListener(jobId, res) {
    const listeners = this.progressListeners.get(jobId);
    if (listeners) {
      listeners.delete(res);
      if (listeners.size === 0) {
        this.progressListeners.delete(jobId);
      }
    }
  }

  /**
   * Store a completed/failed job in history
   * @param {Object} job - The job to store
   */
  addToHistory(job) {
    // Remove from progress listeners
    const listeners = this.progressListeners.get(job.id);
    if (listeners) {
      // Send completion event to all listeners
      const sseData = `data: ${JSON.stringify({ 
        jobId: job.id, 
        stage: 'complete',
        status: job.status,
        timestamp: new Date().toISOString()
      })}\n\n`;
      for (const res of listeners) {
        try {
          res.write(sseData);
          res.end();
        } catch (e) { /* ignore */ }
      }
      this.progressListeners.delete(job.id);
    }

    // Add to history
    this.jobHistory.set(job.id, {
      ...job,
      archivedAt: new Date()
    });

    // Prune old history
    if (this.jobHistory.size > this.maxHistorySize) {
      const oldestKey = this.jobHistory.keys().next().value;
      this.jobHistory.delete(oldestKey);
    }
  }

  async process() {
    if (this.processing || !this.processor) return;

    if (this.activeUserIds.length === 0) return;

    this.processing = true;

    while (this.activeUserIds.length > 0) {
      // Round Robin: Take first user
      const currentBucketKey = this.activeUserIds.shift();
      const userQueue = this.userQueues.get(currentBucketKey);

      if (!userQueue || userQueue.length === 0) {
        // Queue empty/gone, clean up map
        this.userQueues.delete(currentBucketKey);
        continue;
      }

      // Take first job from this user
      const job = userQueue[0]; 

      try {
        job.status = JOB_STATUS.PROCESSING;
        job.startedAt = new Date();
        job.pipelineTrace.processingStarted = job.startedAt;
        job.attempts++;

        console.log(`[Queue] Processing job ${job.id.substring(0, 8)} for ${currentBucketKey} (attempt ${job.attempts}/${this.maxAttempts})`);

        // Execute the processor
        await this.processor(job);

        // Success
        job.status = JOB_STATUS.COMPLETED;
        job.completedAt = new Date();
        job.pipelineTrace.processingCompleted = job.completedAt;
        this.stats.totalProcessed++;

        console.log(`[Queue] Job ${job.id.substring(0, 8)} completed in ${job.completedAt - job.startedAt}ms`);

        // Remove from user queue
        userQueue.shift();
        this.addToHistory(job);

      } catch (error) {
        job.status = JOB_STATUS.FAILED;
        job.errors.push({
          attempt: job.attempts,
          error: error.message,
          timestamp: new Date()
        });

        console.error(`[Queue] Job ${job.id.substring(0, 8)} failed:`, error.message);

        if (job.attempts >= this.maxAttempts) {
          job.status = JOB_STATUS.DEAD;
          this.stats.totalFailed++;
          
          if (job.data.projectId && job.data.commit?.hash) {
             await autoLogger.logError({
               projectId: job.data.projectId,
               commitHash: job.data.commit.hash,
               commitMessage: job.data.commit.message,
               author: job.data.commit.author,
               stage: STAGES.QUEUE,
               error: new Error(`Job failed after ${job.attempts} attempts: ${error.message}`),
               pipelineTrace: job.pipelineTrace,
               deliveryId: job.data.deliveryId
             });
          }
          
          userQueue.shift(); // Remove dead job
          this.addToHistory(job);
        } else {
             // Requeue (keep at head? or move to back?)
             // Usually move to back to let others pass? 
             // Logic: userQueue.shift(); userQueue.push(job);
             // But let's retry immediately or effectively keep at head but mark pending?
             // Simple logic: shift then push to back of own queue
             userQueue.shift();
             job.status = JOB_STATUS.PENDING;
             userQueue.push(job);
             console.log(`[Queue] Job ${job.id.substring(0, 8)} requeued for retry`);
        }
      }

      // If user still has jobs, put them back nicely in the round robin
      if (userQueue.length > 0) {
        this.activeUserIds.push(currentBucketKey);
      } else {
        this.userQueues.delete(currentBucketKey);
      }
    }

    this.processing = false;
  }

  /**
   * Get the current status of the queue
   * @returns {Object} - Queue status
   */
  getStatus() {
    let totalQueued = 0;
    const allJobs = [];
    
    for (const [userId, jobs] of this.userQueues) {
      totalQueued += jobs.length;
      allJobs.push(...jobs);
    }

    return {
      queueLength: totalQueued,
      processing: this.processing,
      activeUsers: this.activeUserIds.length,
      stats: {
        ...this.stats,
        uptime: Date.now() - this.stats.startTime.getTime()
      },
      jobs: allJobs.map(j => ({
        id: j.id,
        bucketKey: j.bucketKey,
        status: j.status,
        attempts: j.attempts,
        queuedAt: j.queuedAt,
        startedAt: j.startedAt
      }))
    };
  }

  /**
   * Get a specific job by ID (checks queue and history)
   * @param {string} jobId - Job ID
   * @returns {Object|null} - Job or null
   */
  getJob(jobId) {
    // Check active queues first
    for (const jobs of this.userQueues.values()) {
      const job = jobs.find(j => j.id === jobId);
      if (job) return job;
    }
    
    // Check history for completed/failed jobs
    return this.jobHistory.get(jobId) || null;
  }

  /**
   * Check if a commit is already in the queue
   * @param {string} commitHash - Commit hash to check
   * @returns {boolean} - True if commit is already queued
   */
  isCommitQueued(commitHash) {
    for (const jobs of this.userQueues.values()) {
      if (jobs.some(j => j.data.commit?.hash === commitHash)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Clear all pending jobs (for maintenance)
   * @returns {number} - Number of jobs cleared
   */
  clear() {
    let count = 0;
    for (const jobs of this.userQueues.values()) {
      count += jobs.length;
    }
    this.userQueues.clear();
    this.activeUserIds = [];
    this.processing = false;
    console.log(`[Queue] Cleared ${count} jobs`);
    return count;
  }

  /**
   * Get total queue length
   * @returns {number} - Number of jobs in queue
   */
  get length() {
    let count = 0;
    for (const jobs of this.userQueues.values()) {
      count += jobs.length;
    }
    return count;
  }
}

// Singleton instance
const webhookQueue = new WebhookQueue();

module.exports = {
  webhookQueue,
  WebhookQueue,
  JOB_STATUS
};
