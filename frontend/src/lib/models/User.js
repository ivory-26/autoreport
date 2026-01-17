import mongoose from 'mongoose';

/**
 * User Schema
 * 
 * Stores GitHub OAuth user information.
 * Users are created/updated on each login to keep data in sync.
 */
const userSchema = new mongoose.Schema({
  // GitHub OAuth identity
  githubId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Profile information
  email: {
    type: String,
    sparse: true
  },
  displayName: {
    type: String
  },
  avatarUrl: {
    type: String
  },
  
  // Activity tracking
  lastLogin: {
    type: Date,
    default: Date.now
  },
  
  // User preferences
  settings: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    }
  }
}, {
  timestamps: true
});

/**
 * Find or create a user from GitHub OAuth profile
 * @param {Object} profile - GitHub OAuth profile data
 * @returns {Promise<User>} The found or created user
 */
userSchema.statics.findOrCreateFromGitHub = async function(profile) {
  const { id: githubId, login: username, email, name: displayName, avatar_url: avatarUrl } = profile;
  
  const user = await this.findOneAndUpdate(
    { githubId },
    {
      $set: {
        username,
        email: email || undefined,
        displayName: displayName || username,
        avatarUrl,
        lastLogin: new Date()
      }
    },
    { 
      new: true, 
      upsert: true,
      runValidators: true 
    }
  );
  
  return user;
};

/**
 * Find user by GitHub username
 * @param {string} username - GitHub username
 * @returns {Promise<User|null>}
 */
userSchema.statics.findByUsername = function(username) {
  return this.findOne({ username });
};

export default mongoose.models.User || mongoose.model('User', userSchema);
