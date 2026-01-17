import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Project, Invitation } from '@/lib/models';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Validate if a GitHub username exists
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
 * Create a GitHub issue to notify user of invitation
 */
async function notifyOnGitHub({ owner, repo, accessToken, inviteeUsername, inviterUsername, projectName, role, message }) {
  try {
    const frontendUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
    
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

> 💡 This issue was created automatically to notify you of the invitation. You can close this issue once you've responded.
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
 * POST /api/invitations/send
 * Send an invitation to a GitHub user with optional GitHub notification
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { projectId, inviteeUsername, role = 'editor', message, sendGitHubNotification = true } = await request.json();

    if (!projectId || !inviteeUsername) {
      return NextResponse.json(
        { error: 'projectId and inviteeUsername are required' },
        { status: 400 }
      );
    }

    // Can't invite yourself
    const currentUsername = session.user?.githubUsername || session.user?.name;
    if (inviteeUsername.toLowerCase() === currentUsername?.toLowerCase()) {
      return NextResponse.json(
        { error: 'You cannot invite yourself' },
        { status: 400 }
      );
    }

    // Validate GitHub username exists
    const { valid: userExists, user: githubUser } = await validateGitHubUser(inviteeUsername);
    if (!userExists) {
      return NextResponse.json(
        { error: `GitHub user "${inviteeUsername}" not found. Please check the username.` },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if user is already a collaborator
    const existingCollaborator = project.collaborators?.find(
      c => c.username.toLowerCase() === inviteeUsername.toLowerCase()
    );
    if (existingCollaborator) {
      return NextResponse.json(
        { error: 'User is already a collaborator on this project' },
        { status: 400 }
      );
    }

    // Check for existing pending invitation (Allow multiple invites)
    /* 
    const existingInvitation = await Invitation.findOne({
      projectId,
      inviteeUsername: { $regex: new RegExp(`^${inviteeUsername}$`, 'i') },
      status: 'pending'
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'An invitation is already pending for this user' },
        { status: 400 }
      );
    }
    */

    const inviterUsername = session.user?.githubUsername || session.user?.name || 'Unknown';

    // Create the invitation
    const invitation = new Invitation({
      projectId,
      projectName: project.name,
      invitedBy: {
        username: inviterUsername
      },
      inviteeUsername,
      inviteeEmail: githubUser.email,
      role,
      message,
      status: 'pending'
    });

    await invitation.save();

    console.log(`[Invitation] ${inviterUsername} invited ${inviteeUsername} to project "${project.name}"`);

    // Send GitHub notification if requested and access token is available
    let notificationResult = null;
    if (sendGitHubNotification && session.accessToken && project.repoFullName) {
      const [owner, repo] = project.repoFullName.split('/');
      
      notificationResult = await notifyOnGitHub({
        owner,
        repo,
        accessToken: session.accessToken,
        inviteeUsername,
        inviterUsername,
        projectName: project.name,
        role,
        message
      });

      if (notificationResult.success) {
        // Store the issue URL in the invitation for reference
        invitation.githubNotification = {
          issueNumber: notificationResult.issueNumber,
          issueUrl: notificationResult.issueUrl,
          sentAt: new Date()
        };
        await invitation.save();
      }
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation._id.toString(),
        projectName: invitation.projectName,
        inviteeUsername: invitation.inviteeUsername,
        inviteeAvatarUrl: githubUser.avatar_url,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt
      },
      notification: notificationResult ? {
        sent: notificationResult.success,
        issueUrl: notificationResult.issueUrl
      } : null
    });

  } catch (error) {
    console.error('[Invitation] Error sending invitation:', error);
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}
