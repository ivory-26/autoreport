const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  repoUrl: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  repoFullName: {
    type: String,
    required: true,
    index: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for Phase 1
  },
  activeTemplateId: {
    type: String,
    required: true,
    default: 'IEEE_SRS_V1'
  },
  webhookSecret: {
    type: String,
    required: false
  },
  settings: {
    autoProcess: {
      type: Boolean,
      default: true
    },
    ignoredPaths: [{
      type: String
    }],
    techStack: [{
      type: String
    }]
  },
  status: {
    type: String,
    enum: ['active', 'paused', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Index for webhook lookups
projectSchema.index({ repoFullName: 1, status: 1 });

module.exports = mongoose.model('Project', projectSchema);
