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
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
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

projectSchema.index({ repoFullName: 1, status: 1 });

export default mongoose.models.Project || mongoose.model('Project', projectSchema);
