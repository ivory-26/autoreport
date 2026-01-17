const mongoose = require('mongoose');

/**
 * Invitation Schema
 * 
 * Tracks pending invitations for project collaboration.
 * Once accepted, the user is added to project.collaborators
 * and the invitation is marked as accepted.
 */
const invitationSchema = new mongoose.Schema({
  // The project being shared
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  // Project name (denormalized for easy display)
  projectName: {
    type: String,
    required: true
  },
  // Who sent the invitation
  invitedBy: {
    username: {
      type: String,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  // Who is being invited (GitHub username)
  inviteeUsername: {
    type: String,
    required: true,
    index: true
  },
  // Optional email for the invitee
  inviteeEmail: {
    type: String
  },
  // Role to assign when accepted
  role: {
    type: String,
    enum: ['viewer', 'editor', 'admin'],
    default: 'editor'
  },
  // Invitation status
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'expired'],
    default: 'pending',
    index: true
  },
  // When the invitation expires (7 days from creation)
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  },
  // Optional message from inviter
  message: {
    type: String,
    maxlength: 500
  },
  // GitHub notification tracking
  githubNotification: {
    issueNumber: Number,
    issueUrl: String,
    sentAt: Date
  }
}, {
  timestamps: true
});

// Compound index for looking up invitations
invitationSchema.index({ inviteeUsername: 1, status: 1 });
invitationSchema.index({ projectId: 1, status: 1 });

// Check if invitation is expired
invitationSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

module.exports = mongoose.model('Invitation', invitationSchema);
