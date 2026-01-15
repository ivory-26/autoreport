import mongoose from 'mongoose';

const styleSchema = new mongoose.Schema({
  tone: {
    type: String,
    enum: ['formal', 'technical', 'narrative', 'concise'],
    default: 'formal'
  },
  format: {
    type: String,
    enum: ['prose', 'bullets', 'table', 'code', 'mixed'],
    default: 'prose'
  },
  minLength: {
    type: Number,
    default: 50
  },
  maxLength: {
    type: Number,
    default: 500
  }
}, { _id: false });

const aiHintsSchema = new mongoose.Schema({
  keywords: [{
    type: String
  }],
  codePatterns: [{
    type: String
  }],
  description: {
    type: String
  }
}, { _id: false });

const sectionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  number: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  level: {
    type: Number,
    default: 1
  },
  required: {
    type: Boolean,
    default: false
  },
  parentId: {
    type: String,
    default: null
  },
  aiHints: {
    type: aiHintsSchema,
    default: () => ({})
  },
  style: {
    type: styleSchema,
    default: () => ({})
  }
}, { _id: false });

const templateSchema = new mongoose.Schema({
  templateId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  standard: {
    type: String,
    enum: ['IEEE-830', 'IEEE-1016', 'IEEE-829', 'AGILE', 'CUSTOM'],
    default: 'CUSTOM'
  },
  version: {
    type: String,
    default: '1.0'
  },
  description: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sections: [sectionSchema],
  metadata: {
    targetAudience: {
      type: String,
      enum: ['academic', 'professional', 'internal'],
      default: 'academic'
    },
    language: {
      type: String,
      default: 'en'
    }
  }
}, {
  timestamps: true
});

export default mongoose.models.Template || mongoose.model('Template', templateSchema);
