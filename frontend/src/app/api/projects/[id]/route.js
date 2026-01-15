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
