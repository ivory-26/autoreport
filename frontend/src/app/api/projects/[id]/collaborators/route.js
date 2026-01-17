import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Project } from '@/lib/models';

/**
 * GET /api/projects/[id]/collaborators
 * Get all collaborators for a project
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    await dbConnect();

    const project = await Project.findById(id).lean();
    
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if user is owner or collaborator
    const username = session.user?.githubUsername || session.user?.name;
    const isOwner = project.ownerUsername?.toLowerCase() === username?.toLowerCase();
    const isCollaborator = project.collaborators?.some(
      c => c.username?.toLowerCase() === username?.toLowerCase()
    );

    if (!isOwner && !isCollaborator) {
      return NextResponse.json(
        { error: 'You do not have access to this project' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      owner: {
        username: project.ownerUsername,
        isOwner: true
      },
      collaborators: (project.collaborators || []).map(c => ({
        userId: c.userId,
        username: c.username,
        email: c.email,
        role: c.role,
        addedAt: c.addedAt
      }))
    });

  } catch (error) {
    console.error('[Collaborators] Error fetching collaborators:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collaborators' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/collaborators
 * Remove a collaborator from a project (owner only)
 */
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const usernameToRemove = searchParams.get('username');

    if (!usernameToRemove) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const project = await Project.findById(id);
    
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Only owner can remove collaborators
    const username = session.user?.githubUsername || session.user?.name;
    if (project.ownerUsername?.toLowerCase() !== username?.toLowerCase()) {
      return NextResponse.json(
        { error: 'Only the project owner can remove collaborators' },
        { status: 403 }
      );
    }

    // Remove collaborator
    const initialLength = project.collaborators?.length || 0;
    project.collaborators = (project.collaborators || []).filter(
      c => c.username?.toLowerCase() !== usernameToRemove.toLowerCase()
    );

    if (project.collaborators.length === initialLength) {
      return NextResponse.json(
        { error: 'Collaborator not found' },
        { status: 404 }
      );
    }

    await project.save();

    return NextResponse.json({
      success: true,
      message: `${usernameToRemove} has been removed from the project`
    });

  } catch (error) {
    console.error('[Collaborators] Error removing collaborator:', error);
    return NextResponse.json(
      { error: 'Failed to remove collaborator' },
      { status: 500 }
    );
  }
}
