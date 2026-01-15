import mongoose from 'mongoose';

const sectionContentSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  templateSectionId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  number: {
    type: String,
    required: true
  },
  content: {
    type: String,
    default: ''
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  aiLastTouched: {
    type: Boolean,
    default: false
  },
  wordCount: {
    type: Number,
    default: 0
  },
  contributions: [{
    commitHash: String,
    addedAt: Date,
    contentPreview: String
  }]
}, { _id: false });

const reportSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  templateId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'in-progress', 'review', 'final'],
    default: 'draft'
  },
  sections: [sectionContentSchema],
  metadata: {
    totalWordCount: {
      type: Number,
      default: 0
    },
    lastAIUpdate: {
      type: Date
    },
    version: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true
});

reportSchema.index({ projectId: 1, status: 1 });

reportSchema.methods.updateWordCount = function() {
  this.metadata.totalWordCount = this.sections.reduce((total, section) => {
    return total + (section.wordCount || 0);
  }, 0);
};

reportSchema.methods.findSectionByTemplateId = function(templateSectionId) {
  return this.sections.find(s => s.templateSectionId === templateSectionId);
};

export default mongoose.models.Report || mongoose.model('Report', reportSchema);
