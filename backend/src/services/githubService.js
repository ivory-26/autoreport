/**
 * GitHub Service
 * 
 * Handles GitHub API interactions for collaboration features:
 * - Creating issues for notifications
 * - Managing repository collaborators
 * - Validating GitHub usernames
 */

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Validate if a GitHub username exists
 * @param {string} username - GitHub username to validate
 * @returns {Promise<{valid: boolean, user: Object|null}>}
 */
async function validateGitHubUser(username) {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/users/${username}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AutoReport-Bot'
      }
    });

    if (response.ok) {
      const user = await response.json();
      return { valid: true, user };
    }
    return { valid: false, user: null };
  } catch (error) {
    console.error('[GitHub] Error validating user:', error.message);
    return { valid: false, user: null };
  }
}

/**
 * Create a GitHub issue to notify user of project invitation
 * @param {Object} params
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.accessToken - GitHub access token
 * @param {string} params.inviteeUsername - Username of the invited user
 * @param {string} params.inviterUsername - Username of the person who invited
 * @param {string} params.projectName - Name of the project
 * @param {string} params.role - Role being offered (viewer, editor, admin)
 * @param {string} params.message - Optional custom message
 * @param {string} params.invitationUrl - URL to accept the invitation
 */
async function notifyInvitationOnGitHub({
  owner,
  repo,
  accessToken,
  inviteeUsername,
  inviterUsername,
  projectName,
  role,
  message,
  invitationUrl
}) {
  try {
    const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const frontendUrl = rawFrontendUrl.replace(/\/$/, '');
    
    const roleDescriptions = {
      viewer: 'View reports and activity',
      editor: 'View, edit, and contribute to reports',
      admin: 'Full access including team management'
    };

    const issueTitle = `📬 AutoReport Collaboration Invitation - ${projectName}`;
    const issueBody = `
## 👋 Hello @${inviteeUsername}!

You've been invited by **@${inviterUsername}** to collaborate on the project **${projectName}** in AutoReport.

### 📋 Invitation Details
| Field | Value |
|-------|-------|
| **Project** | ${projectName} |
| **Your Role** | ${role.charAt(0).toUpperCase() + role.slice(1)} |
| **Permissions** | ${roleDescriptions[role] || 'Standard permissions'} |
| **Invited By** | @${inviterUsername} |

${message ? `### 💬 Personal Message\n> ${message}\n` : ''}

### 🚀 How to Accept

1. **Login to AutoReport** with your GitHub account
2. Go to your **Dashboard**
3. Click on the **Invitations** tab
4. Accept or decline this invitation

**[→ Go to AutoReport Dashboard](${frontendUrl}/dashboard)**

---

### About AutoReport

AutoReport automatically generates and maintains documentation for your repositories. When you accept this invitation, you'll be able to ${role === 'viewer' ? 'view the generated reports' : 'contribute to and view the generated reports'}.

> 💡 This issue was created automatically to notify you of the invitation. You can close this issue once you've responded to the invitation.
    `;

    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'AutoReport-Bot'
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody.trim(),
        labels: ['autoreport', 'invitation']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GitHub] Failed to create invitation issue:', errorText);
      return { success: false, error: errorText };
    }

    const issue = await response.json();
    console.log(`[GitHub] Created invitation issue #${issue.number} for @${inviteeUsername}`);
    
    return { 
      success: true, 
      issueNumber: issue.number,
      issueUrl: issue.html_url 
    };
  } catch (error) {
    console.error('[GitHub] Error creating invitation issue:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Add a collaborator to a GitHub repository
 * @param {Object} params
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.accessToken - GitHub access token with repo admin scope
 * @param {string} params.username - GitHub username to add
 * @param {string} params.permission - Permission level: 'pull', 'push', 'admin', 'maintain', 'triage'
 */
async function addRepositoryCollaborator({
  owner,
  repo,
  accessToken,
  username,
  permission = 'push'
}) {
  try {
    // Map our roles to GitHub permissions
    const permissionMap = {
      viewer: 'pull',      // Read-only access
      editor: 'push',      // Read and write access
      admin: 'admin'       // Full admin access
    };

    const githubPermission = permissionMap[permission] || permission;

    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/collaborators/${username}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'AutoReport-Bot'
        },
        body: JSON.stringify({ permission: githubPermission })
      }
    );

    if (response.status === 201) {
      console.log(`[GitHub] Invitation sent to @${username} for ${owner}/${repo}`);
      return { success: true, status: 'invited' };
    } else if (response.status === 204) {
      console.log(`[GitHub] @${username} already has access to ${owner}/${repo}`);
      return { success: true, status: 'already_collaborator' };
    } else {
      const errorText = await response.text();
      console.error('[GitHub] Failed to add collaborator:', errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error('[GitHub] Error adding collaborator:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Remove a collaborator from a GitHub repository
 * @param {Object} params
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.accessToken - GitHub access token with repo admin scope
 * @param {string} params.username - GitHub username to remove
 */
async function removeRepositoryCollaborator({
  owner,
  repo,
  accessToken,
  username
}) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/collaborators/${username}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'AutoReport-Bot'
        }
      }
    );

    if (response.status === 204) {
      console.log(`[GitHub] Removed @${username} from ${owner}/${repo}`);
      return { success: true };
    } else {
      const errorText = await response.text();
      console.error('[GitHub] Failed to remove collaborator:', errorText);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error('[GitHub] Error removing collaborator:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a user has access to a repository
 * @param {Object} params
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.accessToken - GitHub access token
 * @param {string} params.username - GitHub username to check
 */
async function checkRepositoryAccess({
  owner,
  repo,
  accessToken,
  username
}) {
  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/collaborators/${username}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'AutoReport-Bot'
        }
      }
    );

    if (response.status === 204) {
      return { hasAccess: true };
    } else if (response.status === 404) {
      return { hasAccess: false };
    } else {
      const errorText = await response.text();
      console.error('[GitHub] Error checking access:', errorText);
      return { hasAccess: false, error: errorText };
    }
  } catch (error) {
    console.error('[GitHub] Error checking repository access:', error.message);
    return { hasAccess: false, error: error.message };
  }
}

/**
 * Get repository information
 * @param {Object} params
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.accessToken - GitHub access token
 */
async function getRepositoryInfo({
  owner,
  repo,
  accessToken
}) {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AutoReport-Bot'
      }
    });

    if (response.ok) {
      const repoInfo = await response.json();
      return { success: true, repo: repoInfo };
    } else {
      const errorText = await response.text();
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.error('[GitHub] Error getting repository info:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  validateGitHubUser,
  notifyInvitationOnGitHub,
  addRepositoryCollaborator,
  removeRepositoryCollaborator,
  checkRepositoryAccess,
  getRepositoryInfo
};
