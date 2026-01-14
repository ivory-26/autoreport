/**
 * Webhook Queue Service
 * 
 * In-memory queue for processing GitHub webhooks sequentially.
 * Prevents race conditions when multiple commits arrive simultaneously.
 */

const crypto = require('crypto');
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

class WebhookQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.concurrency = 1; // Process one at a time (per PRD NFR-04)
    this.maxAttempts = 3;
    this.processor = null; // Set via setProcessor()
    
    // Stats tracking
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
   * @param {Object} jobData - The webhook data to process
   * @returns {string} - Job ID
   */
  enqueue(jobData) {
    const jobId = crypto.randomUUID();
    
    const job = {
      id: jobId,
      data: jobData,
      status: JOB_STATUS.PENDING,
      queuedAt: new Date(),
      attempts: 0,
      errors: [],
      pipelineTrace: {
        webhookReceived: jobData.receivedAt || new Date(),
        queuedAt: new Date()
      }
    };

    this.queue.push(job);
    console.log(`[Queue] Job ${jobId.substring(0, 8)} enqueued. Queue size: ${this.queue.length}`);

    // Start processing if not already running
    this.process();

    return jobId;
  }

  /**
   * Process jobs in the queue sequentially
   */
  async process() {
    // Already processing or no processor set
    if (this.processing || !this.processor) {
      return;
    }

    // Nothing to process
    if (this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue[0]; // Peek first job

      try {
        job.status = JOB_STATUS.PROCESSING;
        job.startedAt = new Date();
        job.pipelineTrace.processingStarted = job.startedAt;
        job.attempts++;

        console.log(`[Queue] Processing job ${job.id.substring(0, 8)} (attempt ${job.attempts}/${this.maxAttempts})`);

        // Execute the processor
        await this.processor(job);

        // Success
        job.status = JOB_STATUS.COMPLETED;
        job.completedAt = new Date();
        job.pipelineTrace.processingCompleted = job.completedAt;
        this.stats.totalProcessed++;

        console.log(`[Queue] Job ${job.id.substring(0, 8)} completed in ${job.completedAt - job.startedAt}ms`);

        // Remove completed job
        this.queue.shift();

      } catch (error) {
        job.status = JOB_STATUS.FAILED;
        job.errors.push({
          attempt: job.attempts,
          error: error.message,
          timestamp: new Date()
        });

        console.error(`[Queue] Job ${job.id.substring(0, 8)} failed:`, error.message);

        if (job.attempts >= this.maxAttempts) {
          // Move to dead letter (log and remove)
          job.status = JOB_STATUS.DEAD;
          this.stats.totalFailed++;

          console.error(`[Queue] Job ${job.id.substring(0, 8)} permanently failed after ${job.attempts} attempts`);

          // Log to AutoLog
          if (job.data.projectId && job.data.commit?.hash) {
            await autoLogger.logError({
              projectId: job.data.projectId,
              commitHash: job.data.commit.hash,
              commitMessage: job.data.commit.message,
              author: job.data.commit.author,
              stage: STAGES.QUEUE,
              error: new Error(`Job failed after ${job.attempts} attempts: ${error.message}`),
              pipelineTrace: job.pipelineTrace
            });
          }

          // Remove dead job
          this.queue.shift();
        } else {
          // Move to back of queue for retry
          this.queue.shift();
          job.status = JOB_STATUS.PENDING;
          this.queue.push(job);

          console.log(`[Queue] Job ${job.id.substring(0, 8)} requeued for retry`);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Get the current status of the queue
   * @returns {Object} - Queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      stats: {
        ...this.stats,
        uptime: Date.now() - this.stats.startTime.getTime()
      },
      jobs: this.queue.map(j => ({
        id: j.id,
        status: j.status,
        attempts: j.attempts,
        queuedAt: j.queuedAt,
        startedAt: j.startedAt
      }))
    };
  }

  /**
   * Get a specific job by ID
   * @param {string} jobId - Job ID
   * @returns {Object|null} - Job or null
   */
  getJob(jobId) {
    return this.queue.find(j => j.id === jobId) || null;
  }

  /**
   * Check if a commit is already in the queue
   * @param {string} commitHash - Commit hash to check
   * @returns {boolean} - True if commit is already queued
   */
  isCommitQueued(commitHash) {
    return this.queue.some(j => j.data.commit?.hash === commitHash);
  }

  /**
   * Clear all pending jobs (for maintenance)
   * @returns {number} - Number of jobs cleared
   */
  clear() {
    const count = this.queue.length;
    this.queue = [];
    this.processing = false;
    console.log(`[Queue] Cleared ${count} jobs`);
    return count;
  }

  /**
   * Get queue length
   * @returns {number} - Number of jobs in queue
   */
  get length() {
    return this.queue.length;
  }
}

// Singleton instance
const webhookQueue = new WebhookQueue();

module.exports = {
  webhookQueue,
  WebhookQueue,
  JOB_STATUS
};
