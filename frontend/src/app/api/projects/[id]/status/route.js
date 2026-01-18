import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Project, Report } from '@/lib/models';

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

    // Fetch the project with generating status
    const project = await Project.findById(id).lean();

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Fetch the associated report
    const report = await Report.findOne({ projectId: id })
      .select('_id title status metadata updatedAt projectId')
      .lean();

    return NextResponse.json({
      isGeneratingInitialReport: project.isGeneratingInitialReport || false,
      report: report ? {
        _id: report._id.toString(),
        title: report.title,
        status: report.status,
        metadata: report.metadata,
        updatedAt: report.updatedAt?.toISOString(),
        projectId: report.projectId.toString(),
      } : null,
    });
  } catch (error) {
    console.error('Error fetching project status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project status' },
      { status: 500 }
    );
  }
}
