'use client';

import { SetupWizard } from '@/components/wizard/SetupWizard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Plus } from 'lucide-react';

/**
 * Empty state component for when there are no projects
 * Includes the setup wizard integration
 */
export function EmptyProjectsState() {
  return (
    <Card className="border-dashed shadow-sm rounded-3xl bg-zinc-50/50 dark:bg-zinc-900/50">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-full bg-background shadow-sm mb-4 border">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
        <p className="text-muted-foreground max-w-sm mb-6">
          Create your first project to start generating reports automatically from your Git commits.
        </p>
        <SetupWizard
          trigger={
            <Button variant="outline" className="rounded-xl border-dashed gap-2">
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}

export default EmptyProjectsState;
