import mongoose from 'mongoose';

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
  author: {
    type: String
  },
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
  processingTime: {
    type: Number
  },
  status: {
    type: String,
    enum: ['success', 'partial', 'failed', 'skipped', 'pending'],
    required: true,
    index: true
  },
  error: errorSchema,
  pipelineTrace: pipelineTraceSchema,
  analysisResult: {
    changeType: String,
    impactLevel: String,
    semanticTags: [String],
    entitiesCount: Number
  },
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

autoLogSchema.index({ projectId: 1, createdAt: -1 });
autoLogSchema.index({ projectId: 1, status: 1 });
autoLogSchema.index({ commitHash: 1, projectId: 1 });

// Static method to get recent logs
autoLogSchema.statics.getRecentLogs = function(projectId, limit = 20) {
  return this.find({ projectId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

export default mongoose.models.AutoLog || mongoose.model('AutoLog', autoLogSchema);
