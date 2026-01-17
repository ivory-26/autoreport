const mongoose = require('mongoose');

const errorSchema = new mongoose.Schema({
  stage: {
    type: String,
    enum: ['webhook', 'queue', 'analyzer', 'writer', 'database', 'filter'],
    required: true
  },
  code: {
    type: String,
    enum: ['RATE_LIMIT', 'AUTH_ERROR', 'DB_ERROR', 'TIMEOUT', 'VALIDATION', 'AI_ERROR', 'FILTERED', 'UNKNOWN'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  stack: {
    type: String
  },
  retryable: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const pipelineTraceSchema = new mongoose.Schema({
  webhookReceived: Date,
  queuedAt: Date,
  analysisStarted: Date,
  analysisCompleted: Date,
  writingStarted: Date,
  writingCompleted: Date,
  savedAt: Date
}, { _id: false });

const autoLogSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report'
  },
  commitHash: {
    type: String,
    required: true,
    index: true
  },
  commitMessage: {
    type: String
  },
  // Author information from the commit
  author: {
    type: String
  },
  // Extended author info for collaborator tracking
  authorInfo: {
    username: String,
    email: String,
    avatarUrl: String,
    isCollaborator: {
      type: Boolean,
      default: false
    },
    role: {
      type: String,
      enum: ['owner', 'admin', 'editor', 'viewer', 'external'],
      default: 'external'
    }
  },
  deliveryId: {
    type: String,
    index: true
  },
  
  // Success case fields
  addedToSection: {
    type: String
  },
  sectionId: {
    type: String
  },
  contentPreview: {
    type: String,
    maxlength: 200
  },
  wordCount: {
    type: Number
  },
  
  // Timing metrics
  processingTime: {
    type: Number // milliseconds
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['success', 'partial', 'failed', 'skipped', 'pending'],
    required: true,
    index: true
  },
  
  // Error details
  error: errorSchema,
  
  // Pipeline trace
  pipelineTrace: pipelineTraceSchema,
  
  // Analysis results (for debugging/reference)
  analysisResult: {
    changeType: String,
    impactLevel: String,
    semanticTags: [String],
    entitiesCount: Number
  },
  
  // User actions
  reverted: {
    type: Boolean,
    default: false
  },
  revertedAt: Date,
  regenerated: {
    type: Boolean,
    default: false
  },
  regeneratedAt: Date
}, {
  timestamps: true
});

// Compound indexes for common queries
autoLogSchema.index({ projectId: 1, createdAt: -1 });
autoLogSchema.index({ projectId: 1, status: 1 });
autoLogSchema.index({ commitHash: 1, projectId: 1 });

// Static method to get recent logs for a project
autoLogSchema.statics.getRecentLogs = function(projectId, limit = 20) {
  return this.find({ projectId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get error summary
autoLogSchema.statics.getErrorSummary = function(projectId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        projectId: new mongoose.Types.ObjectId(projectId),
        status: 'failed',
        createdAt: { $gte: since }
      }
    },
    {
      $group: {
        _id: '$error.code',
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('AutoLog', autoLogSchema);
