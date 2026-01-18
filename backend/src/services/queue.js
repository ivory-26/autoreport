/**
 * Webhook Queue Service (MongoDB-backed)
 * 
 * Persistent queue for processing GitHub webhooks sequentially.
 * Uses MongoDB for job storage to survive server restarts.
 * Implements fair queueing (round-robin by user/project).
 */

const EventEmitter = require('events');
const { Job, JOB_STATUS } = require('../models/Job');
const { autoLogger, STAGES } = require('./autoLogger');

class WebhookQueue extends EventEmitter {
  constructor() {
    super();
    this.processing = false;
    this.concurrency = this.calculateConcurrency(); // Dynamic based on API keys
    this.maxAttempts = 3;
    this.processor = null;
    this.maxQueuePerUser = 10; // Prevent abuse
    
    // In-memory SSE progress listeners (can't persist connections)
    this.progressListeners = new Map();
    
    // Track last processed bucket for round-robin
    this.lastProcessedBucket = null;
    
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
   * Calculate optimal concurrency based on number of API keys
   * @returns {number} - Concurrency level
   */
  calculateConcurrency() {
    try {
      // Check for GROQ_API_KEYS (comma-separated) or single GROQ_API_KEY
      const keysString = process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY;
      if (!keysString) return 1;
      
      const keyCount = keysString.split(',').filter(k => k.trim()).length;
      
      // Match concurrency to number of keys, but cap at 5 for safety
      const concurrency = Math.min(keyCount, 5);
      
      if (keyCount > 1) {
        console.log(`[Queue] Using concurrency=${concurrency} (${keyCount} API keys available)`);
      }
      
      return concurrency;
    } catch (error) {
      console.warn('[Queue] Error calculating concurrency, defaulting to 1:', error.message);
      return 1;
    }
  }

  /**
   * Add a job to the queue
   * @param {Object} jobData - The job data. MUST include userId or projectId for fairness.
   * @returns {Promise<string>} - Job ID
   */
  async enqueue(jobData) {
    // Determine the bucket key (userId or projectId or 'global')
    const bucketKey = jobData.userId ? String(jobData.userId) : 
                      (jobData.projectId ? String(jobData.projectId) : 'global');
    
    // Check user queue limit
    const userJobCount = await Job.countDocuments({ 
      bucketKey, 
      status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.PROCESSING] } 
    });
    
    if (userJobCount >= this.maxQueuePerUser) {
      console.warn(`[Queue] User ${bucketKey} exceeded max queue size (${this.maxQueuePerUser}). Rejecting job.`);
      throw new Error(`Queue limit exceeded for bucket ${bucketKey}`);
    }

    // Create job document
    const job = new Job({
      bucketKey,
      data: jobData,
      status: JOB_STATUS.PENDING,
      queuedAt: new Date(),
      attempts: 0,
      errorLog: [],
      pipelineTrace: {
        webhookReceived: jobData.receivedAt || new Date(),
        queuedAt: new Date()
      }
    });

    await job.save();

    console.log(`[Queue] Job ${job._id.toString().substring(0, 8)} enqueued for ${bucketKey}. User queue size: ${userJobCount + 1}`);

    // Emit job enqueued event
    this.emit('jobEnqueued', { jobId: job._id.toString(), bucketKey, position: userJobCount + 1 });

    // Start processing if not already running
    this.process();

    return job._id.toString();
  }

  /**
   * Send a progress update for a job (heartbeat)
   * @param {string} jobId - Job ID
   * @param {Object} progress - Progress data
   */
  async sendProgress(jobId, progress) {
    const progressData = {
      stage: progress.stage,
      message: progress.message,
      percentage: progress.percentage,
      timestamp: new Date()
    };

    // Update job in database
    await Job.findByIdAndUpdate(jobId, {
      $push: { progress: progressData }
    });

    // Emit progress event
    this.emit('progress', { jobId, ...progressData });

    // Send to any SSE listeners
    const listeners = this.progressListeners.get(jobId);
    if (listeners) {
      const sseData = `data: ${JSON.stringify({ jobId, timestamp: new Date().toISOString(), ...progress })}\n\n`;
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
   * Mark a job as completed and notify listeners
   * @param {Object} job - The job document
   */
  async addToHistory(job) {
    // Remove from progress listeners
    const listeners = this.progressListeners.get(job._id.toString());
    if (listeners) {
      // Send completion event to all listeners
      const sseData = `data: ${JSON.stringify({ 
        jobId: job._id.toString(), 
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
      this.progressListeners.delete(job._id.toString());
    }
  }

  /**
   * Get the next job to process using fair queueing (round-robin by bucket)
   * @returns {Promise<Object|null>} - Job document or null
   */
  async getNextJob() {
    // Get all distinct bucket keys with pending jobs
    const buckets = await Job.distinct('bucketKey', { 
      status: JOB_STATUS.PENDING,
      $or: [
        { retryAfter: null },
        { retryAfter: { $lte: new Date() } }
      ]
    });

    if (buckets.length === 0) return null;

    // Round-robin: find the next bucket after lastProcessedBucket
    let nextBucketIndex = 0;
    if (this.lastProcessedBucket) {
      const currentIndex = buckets.indexOf(this.lastProcessedBucket);
      if (currentIndex !== -1) {
        nextBucketIndex = (currentIndex + 1) % buckets.length;
      }
    }
    const nextBucket = buckets[nextBucketIndex];

    // Atomically find and update the oldest pending job in this bucket
    const job = await Job.findOneAndUpdate(
      { 
        bucketKey: nextBucket, 
        status: JOB_STATUS.PENDING,
        $or: [
          { retryAfter: null },
          { retryAfter: { $lte: new Date() } }
        ]
      },
      { 
        $set: { 
          status: JOB_STATUS.PROCESSING,
          startedAt: new Date(),
          'pipelineTrace.processingStarted': new Date()
        },
        $inc: { attempts: 1 }
      },
      { 
        sort: { queuedAt: 1 },
        new: true 
      }
    );

    if (job) {
      this.lastProcessedBucket = nextBucket;
    }

    return job;
  }

  /**
   * Main processing loop
   */
  async process() {
    if (this.processing || !this.processor) return;

    this.processing = true;

    try {
      let job;
      while ((job = await this.getNextJob()) !== null) {
        const jobId = job._id.toString();

        try {
          console.log(`[Queue] Processing job ${jobId.substring(0, 8)} for ${job.bucketKey} (attempt ${job.attempts}/${this.maxAttempts})`);

          // Execute the processor (pass job-like object with id property for compatibility)
          await this.processor({
            id: jobId,
            data: job.data,
            bucketKey: job.bucketKey,
            attempts: job.attempts,
            pipelineTrace: job.pipelineTrace
          });

          // Success - update job
          const completedAt = new Date();
          await Job.findByIdAndUpdate(jobId, {
            $set: {
              status: JOB_STATUS.COMPLETED,
              completedAt,
              'pipelineTrace.processingCompleted': completedAt
            }
          });

          this.stats.totalProcessed++;
          console.log(`[Queue] Job ${jobId.substring(0, 8)} completed in ${completedAt - job.startedAt}ms`);

          await this.addToHistory(job);

        } catch (error) {
          console.error(`[Queue] Job ${jobId.substring(0, 8)} failed:`, error.message);

          const errorEntry = {
            attempt: job.attempts,
            error: error.message,
            timestamp: new Date()
          };

          if (job.attempts >= this.maxAttempts) {
            // Job is dead
            await Job.findByIdAndUpdate(jobId, {
              $set: { status: JOB_STATUS.DEAD },
              $push: { errorLog: errorEntry }
            });

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

            await this.addToHistory(job);
          } else {
            // Schedule retry with exponential backoff
            const backoffDelay = Math.min(
              Math.pow(2, job.attempts) * 1000 + Math.random() * 1000,
              60000
            );
            const retryAfter = new Date(Date.now() + backoffDelay);

            await Job.findByIdAndUpdate(jobId, {
              $set: { 
                status: JOB_STATUS.PENDING,
                retryAfter
              },
              $push: { errorLog: errorEntry }
            });

            console.log(`[Queue] Job ${jobId.substring(0, 8)} will retry after ${retryAfter.toISOString()} (attempt ${job.attempts + 1}/${this.maxAttempts})`);

            // Schedule a process check after the backoff
            setTimeout(() => this.process(), backoffDelay);
          }
        }
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Get the current status of the queue
   * @returns {Promise<Object>} - Queue status
   */
  async getStatus() {
    const [pending, processing, completed, failed] = await Promise.all([
      Job.countDocuments({ status: JOB_STATUS.PENDING }),
      Job.countDocuments({ status: JOB_STATUS.PROCESSING }),
      Job.countDocuments({ status: JOB_STATUS.COMPLETED }),
      Job.countDocuments({ status: { $in: [JOB_STATUS.FAILED, JOB_STATUS.DEAD] } })
    ]);

    const jobs = await Job.find({ 
      status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.PROCESSING] } 
    })
    .select('bucketKey status attempts queuedAt startedAt')
    .sort({ queuedAt: 1 })
    .limit(50)
    .lean();

    return {
      queueLength: pending + processing,
      processing: this.processing,
      activeUsers: (await Job.distinct('bucketKey', { status: JOB_STATUS.PENDING })).length,
      stats: {
        ...this.stats,
        pending,
        processing,
        completed,
        failed,
        uptime: Date.now() - this.stats.startTime.getTime()
      },
      jobs: jobs.map(j => ({
        id: j._id.toString(),
        bucketKey: j.bucketKey,
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
   * @returns {Promise<Object|null>} - Job or null
   */
  async getJob(jobId) {
    try {
      const job = await Job.findById(jobId).lean();
      if (job) {
        // Return with id property for compatibility
        return { ...job, id: job._id.toString() };
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Check if a commit is already in the queue
   * @param {string} commitHash - Commit hash to check
   * @returns {Promise<boolean>} - True if commit is already queued
   */
  async isCommitQueued(commitHash) {
    const count = await Job.countDocuments({
      'data.commit.hash': commitHash,
      status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.PROCESSING] }
    });
    return count > 0;
  }

  /**
   * Abort all jobs related to a project (called when project is deleted)
   * @param {string} projectId - Project ID
   * @returns {Promise<number>} - Number of jobs aborted
   */
  async abortProjectJobs(projectId) {
    // 1. Mark all pending jobs as ABORTED
    const pendingResult = await Job.updateMany(
      { bucketKey: projectId, status: JOB_STATUS.PENDING },
      { $set: { status: JOB_STATUS.ABORTED, completedAt: new Date() } }
    );

    // 2. Mark all processing jobs as ABORTED
    // This serves as a flag for the running processor to stop
    const processingResult = await Job.updateMany(
      { bucketKey: projectId, status: JOB_STATUS.PROCESSING },
      { $set: { status: JOB_STATUS.ABORTED } }
    );

    const total = pendingResult.modifiedCount + processingResult.modifiedCount;
    if (total > 0) {
      console.log(`[Queue] Aborted ${total} jobs for project ${projectId}`);
    }
    return total;
  }

  /**
   * Check if a specific job has been aborted
   * @param {string} jobId - Job ID
   * @returns {Promise<boolean>} - True if aborted
   */
  async isJobAborted(jobId) {
    const job = await Job.findById(jobId).select('status').lean();
    return job?.status === JOB_STATUS.ABORTED;
  }

  /**
   * Clear all pending jobs (for maintenance)
   * @returns {Promise<number>} - Number of jobs cleared
   */
  async clear() {
    const result = await Job.deleteMany({ status: JOB_STATUS.PENDING });
    this.processing = false;
    console.log(`[Queue] Cleared ${result.deletedCount} jobs`);
    return result.deletedCount;
  }

  /**
   * Get total queue length
   * @returns {Promise<number>} - Number of jobs in queue
   */
  async getLength() {
    return await Job.countDocuments({ 
      status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.PROCESSING] } 
    });
  }

  /**
   * Synchronous length getter for compatibility (returns cached or 0)
   * Use getLength() for accurate count
   */
  get length() {
    // For sync access, return 0 - callers should use getLength() for accuracy
    console.warn('[Queue] Sync .length access deprecated, use await getLength()');
    return 0;
  }

  /**
   * Recover jobs stuck in 'processing' status after a crash
   * Should be called on server startup
   * @returns {Promise<number>} - Number of jobs recovered
   */
  async recoverStuckJobs() {
    const result = await Job.updateMany(
      { status: JOB_STATUS.PROCESSING },
      { 
        $set: { 
          status: JOB_STATUS.PENDING,
          retryAfter: null
        }
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`[Queue] Recovered ${result.modifiedCount} stuck jobs from previous crash`);
      // Trigger processing
      this.process();
    }
    
    return result.modifiedCount;
  }
}

// Singleton instance
const webhookQueue = new WebhookQueue();

module.exports = {
  webhookQueue,
  WebhookQueue,
  JOB_STATUS
};
