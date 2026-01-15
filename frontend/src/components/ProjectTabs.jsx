'use client';

import { useState } from 'react';
import { ReportViewer } from '@/components/ReportViewer';
import { AuditLog } from '@/components/AuditLog';
import { CollaboratorsList } from '@/components/CollaboratorsList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, History, Users } from 'lucide-react';

export function ProjectTabs({ report, project, logs, isOwner }) {
  return (
    <Tabs defaultValue="report" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-4">
        <TabsTrigger value="report" className="gap-2">
          <FileText className="h-4 w-4" />
          Report
        </TabsTrigger>
        <TabsTrigger value="stats" className="gap-2">
          <FileText className="h-4 w-4" />
          Stats
        </TabsTrigger>
        <TabsTrigger value="team" className="gap-2">
          <Users className="h-4 w-4" />
          Team
        </TabsTrigger>
        <TabsTrigger value="activity" className="gap-2">
          <History className="h-4 w-4" />
          Activity
        </TabsTrigger>
      </TabsList>

      {/* Report Tab */}
      <TabsContent value="report" className="mt-6">
        <ReportViewer report={report} repoUrl={project?.repoUrl} projectId={project?._id} />
      </TabsContent>

      {/* Stats Tab */}
      <TabsContent value="stats" className="mt-6">
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
      </TabsContent>

      {/* Team Tab */}
      <TabsContent value="team" className="mt-6">
        <CollaboratorsList
          projectId={project?._id}
          projectName={project?.name}
          isOwner={isOwner}
        />
      </TabsContent>

      {/* Activity Tab */}
      <TabsContent value="activity" className="mt-6">
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
      </TabsContent>
    </Tabs>
  );
}
