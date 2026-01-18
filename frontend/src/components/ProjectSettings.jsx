'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Webhook,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';

export function ProjectSettings({ project }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  // Remove trailing slash and add webhooks path
  const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'https://your-backend.onrender.com').replace(/\/$/, '');
  const webhookUrl = `${backendUrl}/webhooks/github`;

  const copyToClipboard = (text, setCopied) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Webhook className="h-5 w-5 text-primary" />
                GitHub Webhook Configuration
              </CardTitle>
              <CardDescription>
                Configure how AutoReport receives updates from your repository
              </CardDescription>
            </div>
            <Badge
              variant={project.webhookEnabled ? "default" : "outline"}
              className={`${project.webhookEnabled ? "bg-green-500 hover:bg-green-600" : "text-amber-600 border-amber-200 bg-amber-50"}`}
            >
              {project.webhookEnabled ? (
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Enabled
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Manual Setup Required
                </span>
              )}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {project.webhookEnabled ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3 text-green-800">
              <ShieldCheck className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Webhook is active</p>
                <p className="text-sm opacity-90">
                  AutoReport is correctly receiving push events from GitHub. Your documentation will be updated automatically on every push.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Webhook not configured</p>
                <p className="text-sm opacity-90">
                  Automatic updates are disabled. You need to manually add a webhook to your GitHub repository to enable auto-generation of reports.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Setup Instructions</h4>

            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</div>
                <div className="text-sm">
                  Go to your repository on GitHub:
                  <a
                    href={`${project.repoUrl}/settings/hooks`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    Settings &gt; Webhooks &gt; Add webhook
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm">Set <strong>Payload URL</strong> to:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-muted rounded border text-xs break-all">
                      {webhookUrl}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(webhookUrl, setCopiedUrl)}
                      className="h-8"
                    >
                      {copiedUrl ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm">Set <strong>Content type</strong> to <code>application/json</code></p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">4</div>
                <div className="flex-1 space-y-2">
                  <p className="text-sm">Set <strong>Secret</strong> to:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-muted rounded border text-xs font-mono">
                      {project.webhookSecret || '••••••••••••••••••••••••••••••••'}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(project.webhookSecret, setCopiedSecret)}
                      className="h-8"
                      disabled={!project.webhookSecret}
                    >
                      {copiedSecret ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">5</div>
                <div className="text-sm">
                  Select <strong>Just the push event</strong> and click <strong>Add webhook</strong>.
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5" />
              <p>
                The webhook secret is used to verify that requests are actually coming from GitHub. Keep it private.
                If your repository is public, do NOT share these details in issues or comments.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
