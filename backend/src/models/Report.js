const mongoose = require('mongoose');

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
  }],
  // Store previous versions for revert functionality
  previousVersions: [{
    content: {
      type: String,
      required: true
    },
    wordCount: {
      type: Number,
      default: 0
    },
    savedAt: {
      type: Date,
      default: Date.now
    },
    reason: {
      type: String,
      enum: ['ai_update', 'regenerate', 'manual'],
      default: 'ai_update'
    }
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

// Compound index for project reports
reportSchema.index({ projectId: 1, status: 1 });

// Method to update word count
reportSchema.methods.updateWordCount = function() {
  this.metadata.totalWordCount = this.sections.reduce((total, section) => {
    return total + (section.wordCount || 0);
  }, 0);
};

// Method to find section by template section ID
reportSchema.methods.findSectionByTemplateId = function(templateSectionId) {
  return this.sections.find(s => s.templateSectionId === templateSectionId);
};

module.exports = mongoose.model('Report', reportSchema);
