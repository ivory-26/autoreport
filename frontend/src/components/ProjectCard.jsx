'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileText, GitBranch, Clock, ArrowRight, ExternalLink, MoreVertical, Trash2, Loader2, Users } from 'lucide-react';
import Link from 'next/link';

export function ProjectCard({ project, statusColor, formattedDate, isShared = false }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      const response = await fetch(`/api/projects/${project._id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete project');
      }

      // Refresh the page to update the project list
      router.refresh();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`h-full flex flex-col overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-xl dark:bg-zinc-900/50 ${isShared ? 'border-blue-200 dark:border-blue-800' : ''}`}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 overflow-hidden flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl font-bold truncate leading-tight tracking-tight py-1">
                  {project.name}
                </CardTitle>
                {isShared && (
                  <Badge variant="outline" className="text-xs gap-1 text-blue-600 border-blue-300">
                    <Users className="h-3 w-3" />
                    Shared
                  </Badge>
                )}
              </div>
              <CardDescription className="flex items-center gap-1.5 text-xs font-mono">
                <GitBranch className="h-3 w-3" />
                <span className="truncate">{project.repoFullName}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {project.report && (
                <Badge variant={statusColor} className="capitalize shadow-sm">
                  {project.report.status}
                </Badge>
              )}

              {/* More Options Menu */}
              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">More options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {project.report ? (
                      <DropdownMenuItem asChild>
                        <Link href={`/project/${project.report._id}`} className="cursor-pointer">
                          <FileText className="mr-2 h-4 w-4" />
                          View Report
                        </Link>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem disabled>
                        <FileText className="mr-2 h-4 w-4" />
                        View Report
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href={project.repoUrl || '#'} target="_blank" className="cursor-pointer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Repository
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem className="text-destructive focus:text-destructive cursor-pointer">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Project
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                  </DropdownMenuContent>
                </DropdownMenu>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Project</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete <strong>&quot;{project.name}&quot;</strong>?
                      This will permanently remove the project and all associated reports.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </>
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-4">
          {project.report ? (
            <div className="flex-1 space-y-3 rounded-2xl bg-secondary/30 p-4 border border-secondary/50">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-foreground/80">
                  <FileText className="h-4 w-4 text-blue-500" />
                  Report Summary
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="flex flex-col gap-0.5">
                  <span className="opacity-70">Last Updated</span>
                  <span className="font-medium text-foreground">{formattedDate}</span>
                </div>
                {project.report.metadata?.totalWordCount > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <span className="opacity-70">Word Count</span>
                    <span className="font-medium text-foreground">{project.report.metadata.totalWordCount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <p className="text-xs text-muted-foreground mb-2">No report active</p>
              <Badge variant="outline" className="text-[10px] h-5">Draft Mode</Badge>
            </div>
          )}

          <div className="flex items-center gap-2 mt-auto pt-2">
            {project.report ? (
              <Button asChild className="flex-1 h-10 rounded-xl shadow-md transition-all hover:shadow-lg active:scale-95" size="sm">
                <Link href={`/project/${project.report._id}`}>
                  View Report <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button disabled className="flex-1 h-10 rounded-xl shadow-md" size="sm">
                View Report <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-xl border-dashed hover:border-solid hover:bg-secondary/50">
              <Link href={project.repoUrl || '#'} target="_blank">
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
