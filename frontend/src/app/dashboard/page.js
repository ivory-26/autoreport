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
        <Button className="gap-2 rounded-xl shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5" disabled>
          <Plus className="h-4 w-4" />
          New Project
          <Badge variant="secondary" className="ml-1 text-[10px] h-5 bg-background/50 border shadow-none">Soon</Badge>
        </Button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card className="border-dashed shadow-sm rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-background shadow-sm mb-4 border">
                <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              Create your first project to start generating reports automatically from your Git commits.
            </p>
            <Button variant="outline" disabled className="rounded-xl border-dashed">Create Project</Button>
          </CardContent>
        </Card>
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
