import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Project, Report } from '@/lib/models';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  GitBranch, 
  Clock, 
  Plus, 
  ExternalLink,
  ArrowRight 
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
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Your projects and auto-generated reports
          </p>
        </div>
        <Button className="gap-2" disabled>
          <Plus className="h-4 w-4" />
          New Project
          <Badge variant="outline" className="ml-1 text-xs">Soon</Badge>
        </Button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card className="border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
            <p className="text-muted-foreground max-w-sm">
              Create your first project to start generating reports automatically from your Git commits.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <Card key={project._id} className="hover:shadow-lg transition-all duration-300 border hover:border-primary/50 group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg truncate max-w-[150px] group-hover:text-primary transition-colors">{project.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      <span className="truncate max-w-[180px]">{project.repoFullName}</span>
                    </CardDescription>
                  </div>
                  {project.report && (
                    <Badge variant={getStatusColor(project.report.status)} className="shadow-sm">
                      {project.report.status}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Report Info */}
                {project.report ? (
                  <div className="space-y-2 text-sm bg-secondary/50 p-3 rounded-lg border border-secondary">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium">
                        <FileText className="h-3.5 w-3.5" />
                        {project.report.title}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1 text-xs">
                        <Clock className="h-3.5 w-3.5" />
                        Last updated
                      </span>
                      <span className="text-xs">{formatDate(project.report.updatedAt)}</span>
                    </div>
                    {project.report.metadata?.totalWordCount > 0 && (
                      <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-dashed border-secondary-foreground/20">
                        <span className="text-xs">Word count</span>
                        <span className="text-xs font-mono">{project.report.metadata.totalWordCount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic p-3 bg-secondary/30 rounded-lg text-center">
                    No report generated yet. Push a commit to get started.
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  {project.report ? (
                    <Link href={`/project/${project.report._id}`} className="flex-1">
                      <Button variant="default" className="w-full gap-2 shadow-md shadow-primary/20 hover:shadow-primary/40 transition-shadow">
                        View Report
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button variant="secondary" className="flex-1 opacity-50 cursor-not-allowed" disabled>
                      Waiting for commits...
                    </Button>
                  )}
                  <a 
                    href={project.repoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" size="icon" className="hover:bg-secondary shadow-sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
