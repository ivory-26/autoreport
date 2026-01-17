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
    const issueBody = `
## 🎉 Project Setup Complete!

Hello @${owner},

Your project **${project.name}** has been successfully configured with AutoReport.

### 📝 Initial Documentation Generated
We have analyzed your repository and generated the initial documentation based on your chosen template.
You can view the full report here: [**View Report**](${reportUrl})

### 🚀 Next Steps
1. **Review and Verify**: Check the generated report for accuracy.
2. **Auto-Updates**: Every time you push code to this repository, AutoReport will analyze the changes and update the documentation automatically.
3. **Collaborate**: Invite team members to view or edit the report.

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
