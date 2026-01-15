'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, GitBranch, Clock, ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export function ProjectCard({ project, statusColor, formattedDate }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="h-full flex flex-col overflow-hidden rounded-3xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-xl dark:bg-zinc-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 overflow-hidden">
              <CardTitle className="text-xl font-bold truncate leading-none tracking-tight">
                {project.name}
              </CardTitle>
              <CardDescription className="flex items-center gap-1.5 text-xs font-mono">
                <GitBranch className="h-3 w-3" />
                <span className="truncate">{project.repoFullName}</span>
              </CardDescription>
            </div>
            {project.report && (
              <Badge variant={statusColor} className="shrink-0 capitalize shadow-sm">
                {project.report.status}
              </Badge>
            )}
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
            <Button asChild className="flex-1 h-10 rounded-xl shadow-md transition-all hover:shadow-lg active:scale-95" size="sm">
              <Link href={`/project/${project._id}`}>
                View Report <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
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
