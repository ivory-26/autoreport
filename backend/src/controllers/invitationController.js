/**
 * Invitation Controller
 * 
 * Handles project collaboration invitations:
 * - Send invitations to GitHub users
 * - Accept/decline invitations
 * - Manage collaborators
 */

const Project = require('../models/Project');
const Invitation = require('../models/Invitation');
const User = require('../models/User');
const {
  validateGitHubUser,
  notifyInvitationOnGitHub,
  addRepositoryCollaborator,
  removeRepositoryCollaborator
} = require('../services/githubService');

/**
 * Send an invitation to collaborate on a project
 * POST /api/invitations/send
 */
async function sendInvitation(req, res) {
  try {
    const { 
      projectId, 
      inviteeUsername, 
      inviteeEmail,
      role = 'editor',
      message,
      accessToken // GitHub access token for notifications
    } = req.body;

    const { username: inviterUsername } = req.body; // From authenticated session

    if (!projectId || !inviteeUsername) {
      return res.status(400).json({
        success: false,
        error: 'projectId and inviteeUsername are required'
      });
    }

    // Validate GitHub username exists
    const { valid: userExists, user: githubUser } = await validateGitHubUser(inviteeUsername);
    if (!userExists) {
      return res.status(400).json({
        success: false,
        error: `GitHub user "${inviteeUsername}" not found. Please check the username.`
      });
    }

    // Find the project
    const project = await Project.findById(projectId).populate('owner');
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Check if user is already a collaborator
    const existingCollaborator = project.collaborators?.find(
      c => c.username.toLowerCase() === inviteeUsername.toLowerCase()
    );
    if (existingCollaborator) {
      return res.status(400).json({
        success: false,
        error: 'User is already a collaborator on this project'
      });
    }

    // Check for existing pending invitation
    const existingInvitation = await Invitation.findOne({
      projectId,
      inviteeUsername: { $regex: new RegExp(`^${inviteeUsername}$`, 'i') },
      status: 'pending'
    });

    if (existingInvitation) {
      return res.status(400).json({
        success: false,
        error: 'An invitation is already pending for this user'
      });
    }

    // Create the invitation
    const invitation = new Invitation({
      projectId,
      projectName: project.name,
      invitedBy: {
        username: inviterUsername || project.ownerUsername
      },
      inviteeUsername,
      inviteeEmail: inviteeEmail || githubUser.email,
      role,
      message,
      status: 'pending'
    });

    await invitation.save();

    console.log(`[Invitation] ${inviterUsername || project.ownerUsername} invited ${inviteeUsername} to project "${project.name}"`);

    // Send GitHub notification if access token is provided
    let notificationResult = null;
    if (accessToken && project.repoFullName) {
      const [owner, repo] = project.repoFullName.split('/');
      
      notificationResult = await notifyInvitationOnGitHub({
        owner,
        repo,
        accessToken,
        inviteeUsername,
        inviterUsername: inviterUsername || project.ownerUsername,
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

    res.status(201).json({
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
    res.status(500).json({
      success: false,
      error: 'Failed to send invitation'
    });
  }
}

/**
 * Get pending invitations for the current user
 * GET /api/invitations/pending
 */
async function getPendingInvitations(req, res) {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'username is required'
      });
    }

    // Find pending invitations for this user
    const invitations = await Invitation.find({
      inviteeUsername: { $regex: new RegExp(`^${username}$`, 'i') },
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      invitations: invitations.map(inv => ({
        id: inv._id.toString(),
        projectId: inv.projectId.toString(),
        projectName: inv.projectName,
        invitedBy: inv.invitedBy.username,
        role: inv.role,
        message: inv.message,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt
      }))
    });

  } catch (error) {
    console.error('[Invitation] Error fetching invitations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invitations'
    });
  }
}

/**
 * Accept an invitation
 * POST /api/invitations/:id/accept
 */
async function acceptInvitation(req, res) {
  try {
    const { id } = req.params;
    const { username, email, accessToken } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'username is required'
      });
    }

    // Find the invitation
    const invitation = await Invitation.findById(id);
    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found'
      });
    }

    // Verify the invitation is for this user
    if (invitation.inviteeUsername.toLowerCase() !== username.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'This invitation is not for you'
      });
    }

    // Check if expired
    if (invitation.isExpired()) {
      invitation.status = 'expired';
      await invitation.save();
      return res.status(400).json({
        success: false,
        error: 'This invitation has expired'
      });
    }

    // Check if already processed
    if (invitation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: `Invitation has already been ${invitation.status}`
      });
    }

    // Add user to project collaborators
    const project = await Project.findById(invitation.projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project no longer exists'
      });
    }

    // Check if already a collaborator (race condition)
    const existing = project.collaborators?.find(
      c => c.username.toLowerCase() === username.toLowerCase()
    );
    if (!existing) {
      project.collaborators = project.collaborators || [];
      project.collaborators.push({
        username,
        email,
        role: invitation.role,
        addedAt: new Date()
      });
      await project.save();
    }

    // Update invitation status
    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    await invitation.save();

    console.log(`[Invitation] ${username} accepted invitation to project "${project.name}"`);

    res.status(200).json({
      success: true,
      message: 'Invitation accepted',
      project: {
        id: project._id.toString(),
        name: project.name,
        repoFullName: project.repoFullName
      },
      githubAccess: null
    });

  } catch (error) {
    console.error('[Invitation] Error accepting invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept invitation'
    });
  }
}

/**
 * Decline an invitation
 * POST /api/invitations/:id/decline
 */
async function declineInvitation(req, res) {
  try {
    const { id } = req.params;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'username is required'
      });
    }

    const invitation = await Invitation.findById(id);
    if (!invitation) {
      return res.status(404).json({
        success: false,
        error: 'Invitation not found'
      });
    }

    // Verify the invitation is for this user
    if (invitation.inviteeUsername.toLowerCase() !== username.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'This invitation is not for you'
      });
    }

    invitation.status = 'declined';
    await invitation.save();

    console.log(`[Invitation] ${username} declined invitation to project "${invitation.projectName}"`);

    res.status(200).json({
      success: true,
      message: 'Invitation declined'
    });

  } catch (error) {
    console.error('[Invitation] Error declining invitation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to decline invitation'
    });
  }
}

/**
 * Remove a collaborator from a project
 * DELETE /api/projects/:projectId/collaborators/:username
 */
async function removeCollaborator(req, res) {
  try {
    const { projectId, username } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const collaboratorIndex = project.collaborators?.findIndex(
      c => c.username.toLowerCase() === username.toLowerCase()
    );

    if (collaboratorIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Collaborator not found'
      });
    }

    project.collaborators.splice(collaboratorIndex, 1);
    await project.save();

    console.log(`[Invitation] Removed ${username} from project "${project.name}"`);

    res.status(200).json({
      success: true,
      message: 'Collaborator removed'
    });

  } catch (error) {
    console.error('[Invitation] Error removing collaborator:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove collaborator'
    });
  }
}

/**
 * Get collaborators for a project
 * GET /api/projects/:projectId/collaborators
 */
async function getCollaborators(req, res) {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId).select('name collaborators ownerUsername').lean();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Get pending invitations for this project
    const pendingInvitations = await Invitation.find({
      projectId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }).lean();

    res.status(200).json({
      success: true,
      owner: project.ownerUsername,
      collaborators: (project.collaborators || []).map(c => ({
        username: c.username,
        email: c.email,
        role: c.role,
        addedAt: c.addedAt
      })),
      pendingInvitations: pendingInvitations.map(inv => ({
        id: inv._id.toString(),
        username: inv.inviteeUsername,
        role: inv.role,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt
      }))
    });

  } catch (error) {
    console.error('[Invitation] Error fetching collaborators:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch collaborators'
    });
  }
}

module.exports = {
  sendInvitation,
  getPendingInvitations,
  acceptInvitation,
  declineInvitation,
  removeCollaborator,
  getCollaborators
};
