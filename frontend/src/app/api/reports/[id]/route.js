import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Report, Project, AutoLog } from '@/lib/models';

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

    // Fetch the report with all sections
    const report = await Report.findById(id).lean();

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // Fetch the associated project
    const project = await Project.findById(report.projectId).lean();

    // Fetch recent audit logs for this project
    const logs = await AutoLog.find({ projectId: report.projectId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return NextResponse.json({
      report: {
        ...report,
        _id: report._id.toString(),
        projectId: report.projectId.toString(),
      },
      project: project ? {
        ...project,
        _id: project._id.toString(),
      } : null,
      logs: logs.map(log => ({
        ...log,
        _id: log._id.toString(),
        projectId: log.projectId.toString(),
        reportId: log.reportId?.toString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    );
  }
}
