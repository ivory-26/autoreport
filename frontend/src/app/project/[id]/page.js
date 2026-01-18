import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Report, Project, AutoLog } from '@/lib/models';
import { ProjectTabs } from '@/components/ProjectTabs';
import { GoToTopButton } from '@/components/GoToTopButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExportDropdown } from '@/components/ExportDropdown';
import { 
  ArrowLeft, 
  GitBranch, 
  ExternalLink
} from 'lucide-react';

// Force dynamic rendering and disable caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getReportData(id) {
  await dbConnect();

  const reportData = await Report.findById(id).lean();
  
  if (!reportData) {
    return null;
  }

  const projectData = await Project.findById(reportData.projectId).lean();

  const logsData = await AutoLog.find({ projectId: reportData.projectId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  // Helper to serialize objects
  const serialize = (obj) => {
    if (!obj) return null;
    return JSON.parse(JSON.stringify(obj));
  };

  return {
    report: serialize(reportData),
    project: serialize(projectData),
    logs: serialize(logsData),
  };
}

export default async function ProjectPage({ params }) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/api/auth/signin');
  }

  const { id } = await params;
  const data = await getReportData(id);

  if (!data) {
    notFound();
  }

  const { report, project, logs } = data;
  
  // Robust ownership check: Try githubUsername first, then fallback to name
  const githubUsername = session.user?.githubUsername;
  const displayName = session.user?.name;
  
  const isOwner = (githubUsername && project?.ownerUsername?.toLowerCase() === githubUsername?.toLowerCase()) ||
                  (displayName && project?.ownerUsername?.toLowerCase() === displayName?.toLowerCase());

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-secondary rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight leading-tight py-1">{project?.name || 'Project'}</h1>
            <Badge variant="outline" className="text-sm px-3 py-1 shadow-sm border-primary/20 bg-primary/5 text-primary">
              {report.status}
            </Badge>
          </div>
          {project && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground ml-12">
              <GitBranch className="h-4 w-4" />
              <span className="font-mono">{project.repoFullName}</span>
              <a 
                href={project.repoUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors p-1 rounded hover:bg-secondary"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}
        </div>

        <div className="flex gap-3 ml-12 md:ml-0">
          <ExportDropdown report={report} />
        </div>
      </div>

      {/* Tabs */}
      <ProjectTabs 
        report={report}
        project={project}
        logs={logs}
        isOwner={isOwner}
      />
      
      {/* Go to Top Button */}
      <GoToTopButton />
    </div>
  );
}
