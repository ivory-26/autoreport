/**
 * Create a GitHub issue to notify user of report completion
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} accessToken - GitHub access token
 * @param {Object} project - Project object
 * @param {string} reportId - Report ID
 */
async function notifyUserOnGitHub(owner, repo, accessToken, project, reportId) {
  try {
    const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    // Remove trailing slash if present to avoid double slashes when constructing URLs
    const frontendUrl = rawFrontendUrl.replace(/\/$/, '');
    const reportUrl = `${frontendUrl}/project/${reportId}`;
    
    const issueTitle = `AutoReport: Initial Setup Complete - ${project.name}`;
    
    let webhookSection = '';
    if (project.webhookEnabled) {
      webhookSection = `
### 🚀 Auto-Updates Enabled
Every time you push code to this repository, AutoReport will analyze the changes and update the documentation automatically.
`;
    } else {
      const settingsUrl = `${frontendUrl}/project/${reportId}?tab=settings`;
      webhookSection = `
### ⚠️ Action Required: Enable Auto-Updates
Your project is currently in **one-time report mode**. To enable automatic updates on every push:
1. Go to the [**Project Settings**](${settingsUrl}).
2. Follow the instructions to add a webhook to your repository.
${project.isRepoPublic ? '> **Note:** For security reasons, webhook configuration details are only visible in the AutoReport dashboard.' : ''}
`;
    }

    const issueBody = `
## 🎉 Project Setup Complete!

Hello @${owner},

Your project **${project.name}** has been successfully configured with AutoReport.

### 📝 Initial Documentation Generated
We have analyzed your repository and generated the initial documentation based on your chosen template.
You can view the full report here: [**View Report**](${reportUrl})

${webhookSection}

### 🤝 Collaborate
Invite team members to view or edit the report via the Team tab in the dashboard.

> This issue was automatically created by AutoReport to notify you of the setup completion.
    `;

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody.trim()
      })
    });

    if (!response.ok) {
      console.error('[Notify] Failed to create GitHub issue:', await response.text());
    } else {
      console.log(`[Notify] Created GitHub issue for ${owner}/${repo}`);
    }
  } catch (error) {
    console.error('[Notify] Error sending GitHub notification:', error.message);
  }
}

module.exports = {
  notifyUserOnGitHub
};
