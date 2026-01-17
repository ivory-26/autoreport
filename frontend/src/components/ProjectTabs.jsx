'use client';

/**
 * ProjectTabs Component
 * 
 * Tab navigation uses ReportsPageTabs design inspired by Raul Dronca
 * Implementation based on Wes Bos's CodePen - MIT License
 * See @/components/ui/reports-page-tabs for full license text
 */

import { ReportViewer } from '@/components/ReportViewer';
import { AuditLog } from '@/components/AuditLog';
import { CollaboratorsList } from '@/components/CollaboratorsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ReportsPageTabs,
  ReportsPageTabsList,
  ReportsPageTabsTrigger,
  ReportsPageTabsContent,
} from '@/components/ui/reports-page-tabs';
import { FileText, History, Users, BarChart3 } from 'lucide-react';

export function ProjectTabs({ report, project, logs, isOwner }) {
  return (
    <ReportsPageTabs defaultValue="report" className="w-full">
      <ReportsPageTabsList>
        <ReportsPageTabsTrigger value="report">
          <FileText className="h-4 w-4" />
          Report
        </ReportsPageTabsTrigger>
        <ReportsPageTabsTrigger value="stats">
          <BarChart3 className="h-4 w-4" />
          Stats
        </ReportsPageTabsTrigger>
        <ReportsPageTabsTrigger value="team">
          <Users className="h-4 w-4" />
          Team
        </ReportsPageTabsTrigger>
        <ReportsPageTabsTrigger value="activity">
          <History className="h-4 w-4" />
          Activity
        </ReportsPageTabsTrigger>
      </ReportsPageTabsList>

      {/* Report Tab */}
      <ReportsPageTabsContent value="report" className="mt-6">
        <ReportViewer report={report} repoUrl={project?.repoUrl} projectId={project?._id} />
      </ReportsPageTabsContent>

      {/* Stats Tab */}
      <ReportsPageTabsContent value="stats" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Report Statistics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Sections</p>
                <p className="text-2xl font-bold">{report.sections?.length || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Words</p>
                <p className="text-2xl font-bold">{report.metadata?.totalWordCount?.toLocaleString() || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="text-2xl font-bold">v{report.metadata?.version || 1}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Template</p>
                <p className="text-lg font-medium">{report.templateId}</p>
              </div>
            </div>

            {report.metadata?.lastAIUpdate && (
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Last AI Update</span>
                  <span className="font-medium">
                    {new Date(report.metadata.lastAIUpdate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </ReportsPageTabsContent>

      {/* Team Tab */}
      <ReportsPageTabsContent value="team" className="mt-6">
        <CollaboratorsList
          projectId={project?._id}
          projectName={project?.name}
          isOwner={isOwner}
        />
      </ReportsPageTabsContent>

      {/* Activity Tab */}
      <ReportsPageTabsContent value="activity" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AuditLog logs={logs} repoUrl={project?.repoUrl} />
          </CardContent>
        </Card>
      </ReportsPageTabsContent>
    </ReportsPageTabs>
  );
}
