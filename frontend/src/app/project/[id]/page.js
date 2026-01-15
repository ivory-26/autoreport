import { getServerSession } from 'next-auth';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Report, Project, AutoLog } from '@/lib/models';
import { ReportViewer } from '@/components/ReportViewer';
import { AuditLog } from '@/components/AuditLog';
import { CollaboratorsList } from '@/components/CollaboratorsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  GitBranch, 
  ExternalLink, 
  Download,
  History,
  FileText
} from 'lucide-react';

async function getReportData(id) {
  await dbConnect();

  const report = await Report.findById(id).lean();
  
  if (!report) {
    return null;
  }

  const project = await Project.findById(report.projectId).lean();

  const logs = await AutoLog.find({ projectId: report.projectId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return {
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
  const username = session.user?.name;
  const isOwner = project?.ownerUsername?.toLowerCase() === username?.toLowerCase();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-secondary rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold tracking-tight">{project?.name || 'Project'}</h1>
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
          <Button variant="outline" disabled className="gap-2 shadow-sm">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export PDF</span>
            <Badge variant="secondary" className="text-[10px] px-1 h-4 min-w-0">Soon</Badge>
          </Button>
        </div>
      </div>

      <Separator />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Report Viewer - Main Column */}
        <div className="lg:col-span-3">
          <Card>
            <CardContent className="pt-6">
              <ReportViewer report={report} repoUrl={project?.repoUrl} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Stats Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Report Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sections</span>
                <span className="font-medium">{report.sections?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Words</span>
                <span className="font-medium">
                  {report.metadata?.totalWordCount?.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Version</span>
                <span className="font-medium">v{report.metadata?.version || 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Template</span>
                <span className="font-medium text-xs">{report.templateId}</span>
              </div>
              {report.metadata?.lastAIUpdate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last AI Update</span>
                  <span className="font-medium text-xs">
                    {new Date(report.metadata.lastAIUpdate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Collaborators Card */}
          <CollaboratorsList 
            projectId={project?._id}
            projectName={project?.name}
            isOwner={isOwner}
          />

          {/* Audit Log Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AuditLog logs={logs} repoUrl={project?.repoUrl} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
