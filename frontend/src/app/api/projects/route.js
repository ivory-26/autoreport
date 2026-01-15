import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Project, Report } from '@/lib/models';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    // For now, fetch all projects (in production, filter by owner)
    const projects = await Project.find({ status: 'active' })
      .sort({ updatedAt: -1 })
      .lean();

    // Get report info for each project
    const projectsWithReports = await Promise.all(
      projects.map(async (project) => {
        const report = await Report.findOne({ projectId: project._id })
          .select('title status metadata updatedAt')
          .lean();
        
        return {
          ...project,
          _id: project._id.toString(),
          report: report ? {
            ...report,
            _id: report._id.toString(),
            projectId: report.projectId.toString(),
          } : null,
        };
      })
    );

    return NextResponse.json(projectsWithReports);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
