import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Project, Invitation } from '@/lib/models';

/**
 * POST /api/invitations/send
 * Send an invitation to a GitHub user
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

    const { projectId, inviteeUsername, role = 'editor', message } = await request.json();

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

    // Check for existing pending invitation
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

    // Create the invitation
    const invitation = new Invitation({
      projectId,
      projectName: project.name,
      invitedBy: {
        username: session.user?.name || 'Unknown'
      },
      inviteeUsername,
      role,
      message,
      status: 'pending'
    });

    await invitation.save();

    console.log(`[Invitation] ${session.user?.name} invited ${inviteeUsername} to project "${project.name}"`);

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation._id.toString(),
        projectName: invitation.projectName,
        inviteeUsername: invitation.inviteeUsername,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt
      }
    });

  } catch (error) {
    console.error('[Invitation] Error sending invitation:', error);
    return NextResponse.json(
      { error: 'Failed to send invitation' },
      { status: 500 }
    );
  }
}
