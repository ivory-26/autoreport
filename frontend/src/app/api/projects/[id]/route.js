import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Project, Report } from '@/lib/models';
import AutoLog from '@/lib/models/AutoLog';

/**
 * DELETE /api/projects/[id]
 * Deletes a project and its associated report
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

    const { id: projectId } = await params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
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

    // Security Check: Only the owner can delete a project
    const username = session.user?.githubUsername || session.user?.name;
    const isOwner = project.ownerUsername?.toLowerCase() === username?.toLowerCase();

    if (!isOwner) {
      return NextResponse.json(
        { error: 'Forbidden - Only the project owner can delete this project' },
        { status: 403 }
      );
    }

    // Attempt to delete GitHub webhook
    if (session.accessToken && project.repoFullName) {
      try {
        const [owner, repo] = project.repoFullName.split('/');
        
        // If we have a stored webhook ID, use it
        if (project.webhookId) {
          console.log(`[DeleteProject] Deleting webhook ${project.webhookId} from ${owner}/${repo}`);
          await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks/${project.webhookId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${session.accessToken}`,
              'X-GitHub-Api-Version': '2022-11-28',
              'Accept': 'application/vnd.github+json'
            }
          });
        }
      } catch (webhookError) {
        console.warn('[DeleteProject] Failed to delete GitHub webhook:', webhookError);
        // Continue with project deletion even if webhook cleanup fails
      }
    }

    // Delete associated reports
    await Report.deleteMany({ projectId: project._id });
    
    // Delete associated auto logs
    await AutoLog.deleteMany({ projectId: project._id });

    // Delete the project
    await Project.deleteOne({ _id: project._id });

    console.log(`[DeleteProject] Deleted project: ${project.name} (${project._id})`);

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully'
    });

  } catch (error) {
    console.error('[DeleteProject] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]
 * Gets a single project by ID
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

    const { id: projectId } = await params;

    await dbConnect();

    const project = await Project.findById(projectId).lean();
    
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get associated report
    const report = await Report.findOne({ projectId: project._id })
      .select('title status metadata sections')
      .lean();

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        _id: project._id.toString()
      },
      report: report ? {
        ...report,
        _id: report._id.toString(),
        projectId: project._id.toString()
      } : null
    });

  } catch (error) {
    console.error('[GetProject] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}
