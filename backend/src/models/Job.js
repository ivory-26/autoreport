/**
 * Job Model
 * 
 * Stores queue jobs in MongoDB for persistence across server restarts.
 * Used by the WebhookQueue service for fair queueing of webhook processing.
 */

const mongoose = require('mongoose');

const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DEAD: 'dead',
  ABORTED: 'aborted'
};

const jobSchema = new mongoose.Schema({
  // Bucket key for fair queueing (userId or projectId)
  bucketKey: {
    type: String,
    required: true,
    index: true
  },
  
  // Job status
  status: {
    type: String,
    enum: Object.values(JOB_STATUS),
    default: JOB_STATUS.PENDING,
    index: true
  },
  
  // The actual job payload
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Number of processing attempts
  attempts: {
    type: Number,
    default: 0
  },
  
  // Array of errors from failed attempts
  errorLog: [{
    attempt: Number,
    error: String,
    timestamp: Date
  }],
  
  // Progress updates (for SSE streaming)
  progress: [{
    stage: String,
    message: String,
    percentage: Number,
    timestamp: Date
  }],
  
  // Pipeline timing trace
  pipelineTrace: {
    webhookReceived: Date,
    queuedAt: Date,
    processingStarted: Date,
    processingCompleted: Date
  },
  
  // Timestamps
  queuedAt: {
    type: Date,
    default: Date.now
  },
  startedAt: Date,
  completedAt: Date,
  
  // For retry scheduling
  retryAfter: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for efficient queue polling
jobSchema.index({ status: 1, bucketKey: 1, queuedAt: 1 });

// Index for finding jobs ready to retry
jobSchema.index({ status: 1, retryAfter: 1 });

// TTL index to auto-delete completed/dead jobs after 7 days
jobSchema.index(
  { completedAt: 1 }, 
  { expireAfterSeconds: 7 * 24 * 60 * 60, partialFilterExpression: { status: { $in: ['completed', 'dead'] } } }
);

const Job = mongoose.model('Job', jobSchema);

module.exports = { Job, JOB_STATUS };
