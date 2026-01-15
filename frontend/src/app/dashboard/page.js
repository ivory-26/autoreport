import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Project, Report } from '@/lib/models';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProjectCard } from '@/components/ProjectCard';
import { NewProjectButton } from '@/components/NewProjectButton';
import { EmptyProjectsState } from '@/components/EmptyProjectsState';
import { 
  FileText, 
  Plus
} from 'lucide-react';

async function getProjects() {
  await dbConnect();
  
  const projects = await Project.find({ status: 'active' })
    .sort({ updatedAt: -1 })
    .lean();

  const projectsWithReports = await Promise.all(
    projects.map(async (project) => {
      const report = await Report.findOne({ projectId: project._id })
        .select('title status metadata updatedAt _id projectId')
        .lean();
      
      return {
        ...project,
        _id: project._id.toString(),
        report: report ? {
          ...report,
          _id: report._id?.toString() || '',
          projectId: report.projectId?.toString() || project._id.toString(),
        } : null,
      };
    })
  );

  return projectsWithReports;
}

function getStatusColor(status) {
  switch (status) {
    case 'draft':
      return 'secondary';
    case 'in-progress':
      return 'default';
    case 'review':
      return 'outline';
    case 'final':
      return 'default';
    default:
      return 'secondary';
  }
}

function formatDate(date) {
  if (!date) return 'Never';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/api/auth/signin');
  }

  const projects = await getProjects();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Your projects and auto-generated reports
          </p>
        </div>
        <NewProjectButton />
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <EmptyProjectsState />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard 
                key={project._id} 
                project={project} 
                statusColor={getStatusColor(project.report?.status)}
                formattedDate={formatDate(project.report?.updatedAt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
