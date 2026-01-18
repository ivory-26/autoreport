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
  
  // OAuth preferences
  preferredProvider: {
    type: String,
    enum: ['github', 'github-public'],
    default: 'github'
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
  firstLogin: {
    type: Date,
    default: Date.now,
    immutable: true // Can't be changed after creation
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  loginCount: {
    type: Number,
    default: 1
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
  
  // First check if user exists
  const existingUser = await this.findOne({ githubId });
  
  if (existingUser) {
    // User exists - this is a login, not a signup
    existingUser.username = username;
    existingUser.email = email || existingUser.email;
    existingUser.displayName = displayName || username;
    existingUser.avatarUrl = avatarUrl;
    existingUser.lastLogin = new Date();
    existingUser.loginCount = (existingUser.loginCount || 0) + 1;
    
    await existingUser.save();
    return existingUser;
  }
  
  // User doesn't exist - this is a signup
  const newUser = await this.create({
    githubId,
    username,
    email: email || undefined,
    displayName: displayName || username,
    avatarUrl,
    firstLogin: new Date(),
    lastLogin: new Date(),
    loginCount: 1
  });
  
  return newUser;
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
