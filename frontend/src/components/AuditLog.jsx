'use client';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  GitCommit,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  SkipForward
} from 'lucide-react';

// Helper to normalize GitHub URL (handles both HTTPS and git@ formats)
function normalizeGitHubUrl(repoUrl) {
  if (!repoUrl) return null;

  // If it's a git@ URL, convert to HTTPS
  if (repoUrl.startsWith('git@github.com:')) {
    const path = repoUrl.replace('git@github.com:', '').replace('.git', '');
    return `https://github.com/${path}`;
  }

  // Remove trailing .git if present
  return repoUrl.replace(/\.git$/, '');
}

function getStatusIcon(status) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'partial':
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'skipped':
      return <SkipForward className="h-4 w-4 text-gray-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
}

function getStatusBadge(status) {
  const variants = {
    success: 'default',
    partial: 'outline',
    failed: 'destructive',
    skipped: 'secondary',
    pending: 'outline',
  };

  return (
    <Badge variant={variants[status] || 'secondary'} className="text-xs">
      {status}
    </Badge>
  );
}

function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;

  // Less than 1 minute
  if (diff < 60000) return 'Just now';
  // Less than 1 hour
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  // Less than 24 hours
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  // Otherwise show date
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AuditLog({ logs = [], repoUrl }) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <GitCommit className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No activity yet</p>
        <p className="text-xs">Push commits to see the audit log</p>
      </div>
    );
  }

  const normalizedRepoUrl = normalizeGitHubUrl(repoUrl);

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-4">
        {logs.map((log, index) => {
          const commitUrl = normalizedRepoUrl && log.commitHash
            ? `${normalizedRepoUrl}/commit/${log.commitHash}`
            : null;

          return (
            <div key={log._id}>
              <div className="flex gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(log.status)}
                </div>
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-y-1.5 gap-x-2">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      {commitUrl ? (
                        <a
                          href={commitUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono hover:bg-muted-foreground/20 hover:text-primary transition-colors hover:underline decoration-dashed underline-offset-2 flex items-center gap-1 flex-shrink-0"
                          title="View commit on GitHub"
                        >
                          <GitCommit className="h-3 w-3" />
                          {log.commitHash?.slice(0, 7)}
                        </a>
                      ) : (
                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                          {log.commitHash?.slice(0, 7)}
                        </code>
                      )}
                      <div className="flex-shrink-0 scale-90 origin-left">
                        {getStatusBadge(log.status)}
                      </div>
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground flex-shrink-0">
                      {formatTime(log.createdAt)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {log.commitMessage && (
                      <p className="text-sm font-medium text-foreground/90 break-words line-clamp-2 leading-snug">
                        {log.commitMessage}
                      </p>
                    )}

                    {log.addedToSection && (
                      <p className="text-[11px] text-muted-foreground break-words leading-tight">
                        <span className="opacity-70">to</span> <span className="font-semibold text-foreground/70">{log.addedToSection}</span>
                      </p>
                    )}

                    {log.contentPreview && (
                      <div className="bg-muted/30 rounded p-1.5 mt-1">
                        <p className="text-[11px] text-muted-foreground italic break-words line-clamp-2 leading-relaxed">
                          &ldquo;{log.contentPreview}&rdquo;
                        </p>
                      </div>
                    )}
                  </div>

                  {(log.error || log.author) && (
                    <div className="flex items-center justify-between gap-2 pt-0.5 mt-1 border-t border-muted/50">
                      {log.author && (
                        <p className="text-[10px] text-muted-foreground font-medium truncate">
                          by {log.author}
                        </p>
                      )}
                      {log.error && (
                        <p className="text-[10px] text-red-500 font-medium truncate">
                          Error: {log.error.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {index < logs.length - 1 && <Separator className="mt-4" />}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
