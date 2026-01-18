/**
 * Progress Controller
 * 
 * Provides endpoints for monitoring job progress:
 * - SSE endpoint for real-time progress updates
 * - Polling endpoint for job status
 * 
 * Used to keep Render service active during long-running chunked analysis
 * and provide feedback to frontend about processing status.
 */

const { webhookQueue, JOB_STATUS } = require('../services/queue');

/**
 * GET /api/progress/:jobId
 * Server-Sent Events endpoint for real-time job progress
 */
async function streamJobProgress(req, res) {
  const { jobId } = req.params;

  console.log(`[Progress] SSE connection requested for job ${jobId.substring(0, 8)}`);

  // Check if job exists
  const job = await webhookQueue.getJob(jobId);
  
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }

  // If job is already completed, return immediately
  if (job.status === JOB_STATUS.COMPLETED || job.status === JOB_STATUS.DEAD) {
    return res.json({
      success: true,
      jobId,
      status: job.status,
      completedAt: job.completedAt || job.archivedAt,
      progress: job.progress || []
    });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Send initial connection message
  const totalJobs = await webhookQueue.getLength();
  res.write(`data: ${JSON.stringify({ 
    type: 'connected', 
    jobId, 
    status: job.status,
    queueSize: totalJobs,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Register this response as a progress listener
  webhookQueue.addProgressListener(jobId, res);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`[Progress] SSE connection closed for job ${jobId.substring(0, 8)}`);
    webhookQueue.removeProgressListener(jobId, res);
  });

  // Send heartbeat every 25 seconds to keep connection alive
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    } catch (e) {
      clearInterval(heartbeatInterval);
    }
  }, 25000);

  // Clean up heartbeat when connection closes
  req.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}

/**
 * GET /api/status/:jobId
 * Polling endpoint for job status
 */
async function getJobStatus(req, res) {
  const { jobId } = req.params;

  const job = await webhookQueue.getJob(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }

  // Calculate queue position if still pending
  let queuePosition = null;
  if (job.status === JOB_STATUS.PENDING || job.status === JOB_STATUS.PROCESSING) {
    // Queue position is approximate since we use fair queueing per user
    queuePosition = await webhookQueue.getLength();  
  }

  res.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      queuePosition,
      queuedAt: job.queuedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      attempts: job.attempts,
      progress: job.progress || [],
      errors: job.errorLog || [],
      // Include result info for completed jobs
      result: job.status === JOB_STATUS.COMPLETED ? {
        processingTime: job.completedAt ? job.completedAt - job.startedAt : null
      } : null
    }
  });
}

/**
 * GET /api/queue/status
 * Get overall queue status
 */
async function getQueueStatus(req, res) {
  const status = await webhookQueue.getStatus();
  
  res.json({
    success: true,
    queue: {
      length: status.queueLength,
      processing: status.processing,
      stats: status.stats,
      activeJobs: status.jobs
    }
  });
}

module.exports = {
  streamJobProgress,
  getJobStatus,
  getQueueStatus
};
