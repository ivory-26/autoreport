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

export function AuditLog({ logs = [] }) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
        <GitCommit className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No activity yet</p>
        <p className="text-xs">Push commits to see the audit log</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-4">
        {logs.map((log, index) => (
          <div key={log._id}>
            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {getStatusIcon(log.status)}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                      {log.commitHash?.slice(0, 7)}
                    </code>
                    {getStatusBadge(log.status)}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(log.createdAt)}
                  </span>
                </div>
                
                {log.commitMessage && (
                  <p className="text-sm text-muted-foreground truncate">
                    {log.commitMessage}
                  </p>
                )}
                
                {log.addedToSection && (
                  <p className="text-xs text-muted-foreground">
                    → Added to <span className="font-medium">{log.addedToSection}</span>
                  </p>
                )}
                
                {log.contentPreview && (
                  <p className="text-xs text-muted-foreground italic truncate">
                    &ldquo;{log.contentPreview}&rdquo;
                  </p>
                )}
                
                {log.error && (
                  <p className="text-xs text-red-500">
                    Error: {log.error.message}
                  </p>
                )}
                
                {log.author && (
                  <p className="text-xs text-muted-foreground">
                    by {log.author}
                  </p>
                )}
              </div>
            </div>
            {index < logs.length - 1 && <Separator className="mt-4" />}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
