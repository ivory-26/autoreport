import mongoose from 'mongoose';

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
  isRepoPublic: {
    type: Boolean,
    default: false
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  activeTemplateId: {
    type: String,
    required: true,
    default: 'IEEE_SRS_V1'
  },
  webhookSecret: {
    type: String,
    required: false,
    select: false
  },
  webhookId: {
    type: String,
    required: false
  },
  webhookEnabled: {
    type: Boolean,
    default: false
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
  },
  // Flag for initial report generation in progress
  isGeneratingInitialReport: {
    type: Boolean,
    default: false
  },
  // Owner's GitHub username (for display)
  ownerUsername: {
    type: String,
    required: false
  },
  // Collaborators who can view/edit the project
  collaborators: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    username: {
      type: String,
      required: true
    },
    email: {
      type: String
    },
    role: {
      type: String,
      enum: ['viewer', 'editor', 'admin'],
      default: 'editor'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

projectSchema.index({ repoFullName: 1, status: 1 });

export default mongoose.models.Project || mongoose.model('Project', projectSchema);
