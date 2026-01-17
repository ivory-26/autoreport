import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Project } from '@/lib/models';

const GITHUB_API_BASE = 'https://api.github.com';

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
        avatarUrl: c.avatarUrl,
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
    const usernameToRemove = searchParams.get('username')?.trim();

    console.log(`[Collaborators] Attempting to remove ${usernameToRemove} from project ${id}`);

    if (!usernameToRemove) {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const project = await Project.findById(id);
    
    if (!project) {
      console.log(`[Collaborators] Project ${id} not found`);
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Only owner can remove collaborators
    const sessionUsername = session.user?.githubUsername || session.user?.name;
    const isOwner = project.ownerUsername?.toLowerCase() === sessionUsername?.toLowerCase();
    
    console.log(`[Collaborators] Owner check: Project Owner (${project.ownerUsername}) vs Session User (${sessionUsername}) = ${isOwner}`);

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only the project owner can remove collaborators' },
        { status: 403 }
      );
    }

    // Remove collaborator
    const initialLength = project.collaborators?.length || 0;
    
    // Debug log current collaborators
    console.log(`[Collaborators] Current collaborators:`, project.collaborators?.map(c => c.username));

    project.collaborators = (project.collaborators || []).filter(
      c => c.username?.toLowerCase() !== usernameToRemove.toLowerCase()
    );

    console.log(`[Collaborators] Removed. New count: ${project.collaborators.length} (was ${initialLength})`);

    if (project.collaborators.length === initialLength) {
      return NextResponse.json(
        { error: 'Collaborator not found in list' },
        { status: 404 }
      );
    }

    await project.save();
    console.log(`[Collaborators] Project saved successfully.`);

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

/**
 * PATCH /api/projects/[id]/collaborators
 * Update a collaborator's role (owner only)
 */
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { username, role } = body;

    if (!username || !role) {
      return NextResponse.json(
        { error: 'Username and role are required' },
        { status: 400 }
      );
    }

    if (!['viewer', 'editor', 'admin'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
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

    // Only owner can update roles
    const sessionUsername = session.user?.githubUsername || session.user?.name;
    const isOwner = project.ownerUsername?.toLowerCase() === sessionUsername?.toLowerCase();
    
    if (!isOwner) {
      return NextResponse.json(
        { error: 'Only the project owner can update roles' },
        { status: 403 }
      );
    }

    const collaboratorIndex = project.collaborators?.findIndex(
      c => c.username?.toLowerCase() === username.toLowerCase()
    );

    if (collaboratorIndex === -1 || collaboratorIndex === undefined) {
      return NextResponse.json(
        { error: 'Collaborator not found' },
        { status: 404 }
      );
    }

    // Update role
    project.collaborators[collaboratorIndex].role = role;
    await project.save();

    console.log(`[Collaborators] Updated role for ${username} to ${role}`);

    return NextResponse.json({
      success: true,
      message: `Role updated to ${role}`
    });

  } catch (error) {
    console.error('[Collaborators] Error updating role:', error);
    return NextResponse.json(
      { error: 'Failed to update role' },
      { status: 500 }
    );
  }
}
