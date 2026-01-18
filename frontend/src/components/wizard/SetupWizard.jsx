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
  return (
    <ScrollArea className="h-[350px] pr-4">
      <div className="grid grid-cols-1 gap-4 p-1">
        {templates.length === 0 && !isLoading ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No templates available</p>
            <p className="text-xs mt-1">Templates may not be seeded in the database yet.</p>
          </div>
        ) : (
          templates.map((template) => (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all duration-300 relative overflow-hidden group ${selectedTemplate?.id === template.id
                ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                : 'hover:border-primary/40 hover:bg-accent/50'
                }`}
              onClick={() => onSelect(template)}
            >
              {selectedTemplate?.id === template.id && (
                <div className="absolute top-0 right-0 p-2">
                  <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl transition-colors ${selectedTemplate?.id === template.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'}`}>
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm leading-none">{template.name}</h4>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 uppercase font-bold tracking-wider">
                        {template.standard}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {template.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-[10px] font-medium text-muted-foreground/70 uppercase tracking-tight">
                      <span className="flex items-center gap-1.5">
                        <List className="h-3 w-3" />
                        {template.sectionsCount} Sections
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3" />
                        v{template.version}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium animate-pulse">Loading templates...</p>
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
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="space-y-2">
        <label htmlFor="projectName" className="text-sm font-bold tracking-tight text-foreground/80">
          Project Name
        </label>
        <div className="relative group">
          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            id="projectName"
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder="Enter a memorable project name"
            className="w-full pl-10 pr-4 py-2.5 border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-bold tracking-tight text-foreground/80">Review Configuration</h4>

        <div className="grid gap-3">
          <Card className="border-none bg-muted/30">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <GitBranch className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Source Repository</p>
                  <p className="text-sm font-bold truncate max-w-[200px] md:max-w-[300px]">
                    {selectedRepo?.fullName}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="rounded-md font-mono text-[10px]">
                {selectedRepo?.private ? 'Private' : 'Public'}
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-none bg-muted/30">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Documentation Template</p>
                  <p className="text-sm font-bold">
                    {selectedTemplate?.name}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="rounded-md font-mono text-[10px]">
                {selectedTemplate?.standard}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedRepo && !selectedRepo.permissions?.admin && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50">
          <div className="flex items-start gap-3">
            <div className="p-1 rounded-full bg-amber-100 dark:bg-amber-900/30">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-xs">
              <p className="font-bold text-amber-900 dark:text-amber-400">
                Admin Permissions Missing
              </p>
              <p className="text-amber-700/80 dark:text-amber-500/80 mt-1 leading-relaxed">
                You are a collaborator but not an admin. Webhooks won't be configured automatically, but you can still generate the initial report.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
        <div className="flex items-start gap-3">
          <div className="p-1 rounded-full bg-primary/10">
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <div className="text-xs">
            <p className="font-bold text-primary">Next Steps</p>
            <p className="text-muted-foreground mt-1 leading-relaxed">
              {selectedRepo?.permissions?.admin
                ? "We'll create the project and set up a GitHub webhook. AutoReport will update your documentation on every push."
                : "We'll generate an initial report now. To enable automatic updates, the repo owner will need to configure a webhook later."}
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
    router.refresh();
    onClose();
  };

  const progress = generationProgress?.percent || 0;

  return (
    <div className="space-y-6 py-4 animate-in fade-in zoom-in-95 duration-500">
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 relative">
            <CheckCircle2 className="h-12 w-12" />
            <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1 border-2 border-background animate-bounce">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        </div>

        <h3 className="text-2xl font-bold tracking-tight">Project Ready!</h3>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Your project <span className="text-foreground font-semibold">&quot;{createdProject?.project?.name}&quot;</span> has been successfully initialized.
        </p>
      </div>

      {/* Initial Report Generation Status */}
      {createdProject?.generatingInitialReport && (
        <Card className="border-blue-100 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-900/10 overflow-hidden relative">
          <div className="absolute top-0 left-0 h-1 bg-blue-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
              </div>
              <div className="text-left space-y-2 flex-1">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-sm text-blue-700 dark:text-blue-400">
                    Generating Initial Report
                  </p>
                  <span className="text-xs font-mono text-blue-600 font-bold">{Math.round(progress)}%</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  We are analyzing your repository and generating the first set of documentation. This usually takes 1-2 minutes.
                </p>
                <div className="w-full bg-blue-100 dark:bg-blue-900/50 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Generated Successfully */}
      {!createdProject?.generatingInitialReport && createdProject?.report && (
        <Card className="border-green-100 dark:border-green-900 bg-green-50/30 dark:bg-green-900/10 shadow-sm transition-all duration-300 hover:shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-left space-y-1 flex-1">
                <p className="font-bold text-sm text-green-700 dark:text-green-400">
                  Documentation Generated
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Your project report is complete and ready for review. You can view it now or continue setting up your team.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Team Members - Interactive Form */}
      {createdProject?.project?.id && (
        <div className="border-t pt-6 mt-2">
          <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-foreground px-1">
            <UserPlus className="h-4 w-4 text-primary" />
            Invite Collaborators
          </div>
          <InviteCollaboratorForm projectId={createdProject.project.id} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <Button variant="ghost" onClick={handleGoToDashboard} className="flex-1 rounded-xl">
          Back to Dashboard
        </Button>
        <div className="flex flex-1 gap-2">
          {createdProject?.report?._id && !createdProject?.generatingInitialReport ? (
            <Button onClick={handleViewReport} className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 rounded-xl">
              View Report
              <FileText className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleViewProject} className="flex-1 gap-2 rounded-xl shadow-lg shadow-primary/20">
              Go to Project
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Main Setup Wizard Component
 */
export function SetupWizard({ trigger }) {
  const router = useRouter();
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
      <Dialog open={wizard.isOpen} onOpenChange={(open) => {
        if (!open) {
          if (wizard.step === 4) {
            router.refresh();
          }
          wizard.closeWizard();
        }
      }}>
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
