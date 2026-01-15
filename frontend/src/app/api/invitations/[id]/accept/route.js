import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Invitation, Project } from '@/lib/models';

/**
 * POST /api/invitations/[id]/accept
 * Accept an invitation and become a collaborator
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const username = session.user?.githubUsername || session.user?.name;
    const userId = session.user?.id;
    const email = session.user?.email;

    if (!username) {
      return NextResponse.json(
        { error: 'Username not found in session' },
        { status: 400 }
      );
    }

    await dbConnect();

    // Find the invitation
    const invitation = await Invitation.findById(id);
    
    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Check if the invitation is for this user
    if (invitation.inviteeUsername.toLowerCase() !== username.toLowerCase()) {
      return NextResponse.json(
        { error: 'This invitation is not for you' },
        { status: 403 }
      );
    }

    // Check if invitation is still pending
    if (invitation.status !== 'pending') {
      return NextResponse.json(
        { error: `Invitation has already been ${invitation.status}` },
        { status: 400 }
      );
    }

    // Check if invitation has expired
    if (invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      await invitation.save();
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 400 }
      );
    }

    // Add user as collaborator to the project
    const project = await Project.findById(invitation.projectId);
    
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if user is already a collaborator
    const existingCollaborator = project.collaborators?.find(
      c => c.username?.toLowerCase() === username.toLowerCase()
    );

    if (!existingCollaborator) {
      // Add as collaborator
      project.collaborators = project.collaborators || [];
      project.collaborators.push({
        userId: userId,
        username: username,
        email: email,
        role: invitation.role,
        addedAt: new Date()
      });
      await project.save();
    }

    // Update invitation status
    invitation.status = 'accepted';
    invitation.respondedAt = new Date();
    await invitation.save();

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted! You are now a collaborator.',
      project: {
        id: project._id.toString(),
        name: project.name
      }
    });

  } catch (error) {
    console.error('[Invitation] Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
