'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectWizard } from '@/lib/hooks/useProjectWizard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GitBranch,
  FileText,
  Settings,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Search,
  Lock,
  Globe,
  Star,
  GitFork,
  AlertCircle,
  Sparkles,
  ExternalLink,
  UserPlus,
  X,
  Send
} from 'lucide-react';
import { InviteCollaboratorForm } from '@/components/InviteCollaboratorForm';

/**
 * Step indicator component
 */
function StepIndicator({ currentStep, steps }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${currentStep > index + 1
              ? 'bg-primary border-primary text-primary-foreground'
              : currentStep === index + 1
                ? 'border-primary text-primary'
                : 'border-muted text-muted-foreground'
              }`}
          >
            {currentStep > index + 1 ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <span className="text-sm font-medium">{index + 1}</span>
            )}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-12 h-0.5 mx-1 transition-all ${currentStep > index + 1 ? 'bg-primary' : 'bg-muted'
                }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Repository selection step
 */
function RepoSelectionStep({
  repos,
  selectedRepo,
  onSelect,
  isLoading,
  hasMore,
  onLoadMore,
  searchQuery,
  onSearchChange
}) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      <ScrollArea className="h-[280px] pr-4">
        <div className="space-y-2">
          {repos.length === 0 && !isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No repositories found</p>
            </div>
          ) : (
            repos.map((repo) => (
              <Card
                key={repo.id}
                className={`cursor-pointer transition-all hover:shadow-md ${selectedRepo?.id === repo.id
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'hover:border-primary/50'
                  }`}
                onClick={() => onSelect(repo)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium truncate text-sm">{repo.name}</h4>
                        {repo.private ? (
                          <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {repo.fullName}
                      </p>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        {repo.language && (
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            {repo.language}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {repo.stargazersCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <GitFork className="h-3 w-3" />
                          {repo.forksCount}
                        </span>
                      </div>
                    </div>
                    {selectedRepo?.id === repo.id && (
                      <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {hasMore && !isLoading && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={onLoadMore}
            >
              Load more repositories
            </Button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/**
 * Template selection step
 */
function TemplateSelectionStep({ templates, selectedTemplate, onSelect, isLoading }) {
  console.log('[TemplateSelectionStep] templates:', templates, 'isLoading:', isLoading);

  return (
    <ScrollArea className="h-[300px] pr-4">
      <div className="space-y-3">
        {templates.length === 0 && !isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No templates available</p>
            <p className="text-xs mt-2">Templates may not be seeded in the database yet.</p>
          </div>
        ) : (
          templates.map((template) => (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all hover:shadow-md ${selectedTemplate?.id === template.id
                ? 'border-primary ring-2 ring-primary/20'
                : 'hover:border-primary/50'
                }`}
              onClick={() => onSelect(template)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{template.name}</h4>
                      <Badge variant="outline" className="text-xs">
                        {template.standard}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{template.sectionsCount} sections</span>
                      <span>v{template.version}</span>
                    </div>
                  </div>
                  {selectedTemplate?.id === template.id && (
                    <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

/**
 * Review step
 */
function ReviewStep({
  selectedRepo,
  selectedTemplate,
  projectName,
  onProjectNameChange
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="projectName" className="text-sm font-medium">
          Project Name
        </label>
        <input
          id="projectName"
          type="text"
          value={projectName}
          onChange={(e) => onProjectNameChange(e.target.value)}
          placeholder="Enter project name"
          className="w-full px-4 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-medium">Review Your Selection</h4>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <GitBranch className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Repository</p>
                <p className="text-sm text-muted-foreground">
                  {selectedRepo?.fullName}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Template</p>
                <p className="text-sm text-muted-foreground">
                  {selectedTemplate?.name}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-3 rounded-lg bg-muted/50 border">
        <div className="flex items-start gap-2">
          <Sparkles className="h-4 w-4 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">What happens next?</p>
            <p className="text-muted-foreground mt-1">
              We&apos;ll create your project and set up a GitHub webhook. Every time you push code,
              AutoReport will automatically analyze your changes and update your documentation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Success step with inline collaborator invitations
 */
function SuccessStep({ createdProject, onClose, generationProgress }) {
  const router = useRouter();

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!createdProject?.generatingInitialReport && createdProject?.report) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('AutoReport Project Ready', {
          body: `Your project "${createdProject.project.name}" has been successfully created and the report is ready.`
        });
      }
    }
  }, [createdProject?.generatingInitialReport, createdProject?.report, createdProject?.project?.name]);

  const handleViewProject = () => {
    onClose();
    router.push(`/project/${createdProject.project.id}`);
    router.refresh();
  };

  const handleViewReport = () => {
    if (createdProject?.report?._id) {
      onClose();
      router.push(`/project/${createdProject.report._id}`);
      router.refresh();
    }
  };

  const handleGoToDashboard = () => {
    onClose();
    router.refresh();
  };

  return (
    <div className="text-center space-y-4 py-2">
      <div className="flex justify-center">
        <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold">Project Created!</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Your project &quot;{createdProject?.project?.name}&quot; has been created successfully.
        </p>
      </div>

      {/* Initial Report Generation Status */}
      {createdProject?.generatingInitialReport && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <div className="h-4 w-4 mt-0.5">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
              </div>
              <div className="text-left text-sm w-full">
                <p className="font-medium text-sm text-blue-600 dark:text-blue-400">
                  Your report is being generated
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  You will receive a notification as a GitHub issue with your project link once the report is ready.
                </p>
                {generationProgress?.percent > 0 && (
                  <div className="w-full bg-blue-100 dark:bg-blue-900 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-500"
                      style={{ width: `${generationProgress.percent}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Generated Successfully */}
      {!createdProject?.generatingInitialReport && createdProject?.report && (
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              <div className="text-left text-sm flex-1">
                <p className="font-medium text-sm text-green-600 dark:text-green-400">
                  Initial Report Generated
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Your first report has been created and is ready to view.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {createdProject?.webhook && (
        <Card className={createdProject.webhook.success ? 'border-green-200' : 'border-yellow-200'}>
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              {createdProject.webhook.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              )}
              <div className="text-left text-sm">
                <p className="font-medium text-sm">
                  {createdProject.webhook.success
                    ? 'Webhook Configured'
                    : 'Manual Webhook Setup Required'}
                </p>
                <p className="text-muted-foreground text-xs mt-0.5">
                  {createdProject.webhook.message}
                </p>
                {!createdProject.webhook.success && createdProject.webhookUrl && (
                  <div className="mt-2 p-2 rounded bg-muted font-mono text-xs break-all">
                    {createdProject.webhookUrl}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Team Members - Interactive Form */}
      {createdProject?.project?.id && (
        <InviteCollaboratorForm projectId={createdProject.project.id} />
      )}

      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
        <Button variant="outline" onClick={handleGoToDashboard}>
          Go to Dashboard
        </Button>
        {createdProject?.report?._id && !createdProject?.generatingInitialReport && (
          <Button onClick={handleViewReport} className="gap-2 bg-blue-600 hover:bg-blue-700">
            View Report
            <FileText className="h-4 w-4" />
          </Button>
        )}
        <Button onClick={handleViewProject} className="gap-2">
          View Project
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Main Setup Wizard Component
 */
export function SetupWizard({ trigger }) {
  const wizard = useProjectWizard();
  const steps = [
    { id: 'repo', title: 'Select Repository', icon: GitBranch },
    { id: 'template', title: 'Choose Template', icon: FileText },
    { id: 'review', title: 'Review & Create', icon: Settings },
    { id: 'success', title: 'Complete', icon: CheckCircle2 }
  ];

  const currentStepInfo = steps[wizard.step - 1];

  return (
    <>
      {/* Trigger element that opens the wizard */}
      <div onClick={wizard.openWizard}>
        {trigger}
      </div>

      {/* Wizard Dialog */}
      <Dialog open={wizard.isOpen} onOpenChange={(open) => !open && wizard.closeWizard()}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {currentStepInfo && <currentStepInfo.icon className="h-5 w-5" />}
              {wizard.step === 4 ? 'Setup Complete' : currentStepInfo?.title}
            </DialogTitle>
            <DialogDescription>
              {wizard.step === 1 && 'Choose a GitHub repository to connect with AutoReport.'}
              {wizard.step === 2 && 'Select a template for your project documentation.'}
              {wizard.step === 3 && 'Review your selections and create the project.'}
              {wizard.step === 4 && 'Your project is ready to go!'}
            </DialogDescription>
          </DialogHeader>

          {wizard.step < 4 && (
            <StepIndicator currentStep={wizard.step} steps={steps.slice(0, 3)} />
          )}

          {/* Error display */}
          {wizard.error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {wizard.error}
            </div>
          )}

          {/* Step content */}
          <div className="py-2">
            {wizard.step === 1 && (
              <RepoSelectionStep
                repos={wizard.repos}
                selectedRepo={wizard.selectedRepo}
                onSelect={wizard.selectRepo}
                isLoading={wizard.isLoading}
                hasMore={wizard.hasMoreRepos}
                onLoadMore={wizard.loadMoreRepos}
                searchQuery={wizard.repoSearch}
                onSearchChange={wizard.setRepoSearch}
              />
            )}

            {wizard.step === 2 && (
              <TemplateSelectionStep
                templates={wizard.templates}
                selectedTemplate={wizard.selectedTemplate}
                onSelect={wizard.selectTemplate}
                isLoading={wizard.isLoading}
              />
            )}

            {wizard.step === 3 && (
              <ReviewStep
                selectedRepo={wizard.selectedRepo}
                selectedTemplate={wizard.selectedTemplate}
                projectName={wizard.projectName}
                onProjectNameChange={wizard.setProjectName}
              />
            )}

            {wizard.step === 4 && (
              <SuccessStep
                createdProject={wizard.createdProject}
                onClose={wizard.closeWizard}
                generationProgress={wizard.generationProgress}
              />
            )}
          </div>

          {/* Footer with navigation */}
          {wizard.step < 4 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="ghost"
                onClick={wizard.step === 1 ? wizard.closeWizard : wizard.prevStep}
                disabled={wizard.isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {wizard.step === 1 ? 'Cancel' : 'Back'}
              </Button>

              {wizard.step < 3 ? (
                <Button
                  onClick={wizard.nextStep}
                  disabled={wizard.isLoading ||
                    (wizard.step === 1 && !wizard.selectedRepo) ||
                    (wizard.step === 2 && !wizard.selectedTemplate)
                  }
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={wizard.createProject}
                  disabled={wizard.isLoading || !wizard.projectName.trim()}
                >
                  {wizard.isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Project
                      <Sparkles className="h-4 w-4 ml-2" />
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SetupWizard;
