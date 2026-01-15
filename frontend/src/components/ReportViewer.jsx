'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  GitCommit, 
  RefreshCw, 
  Trash2, 
  Eye, 
  EyeOff,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

function SectionContent({ section, onDismissHighlight }) {
  const [showSource, setShowSource] = useState(false);
  
  const hasNewContent = section.aiLastTouched;
  const latestCommit = section.contributions?.[section.contributions.length - 1];

  return (
    <div 
      className={`group relative rounded-lg p-4 transition-colors ${
        hasNewContent 
          ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900' 
          : 'hover:bg-muted/50'
      }`}
    >
      {/* New Content Indicator */}
      {hasNewContent && (
        <div className="absolute -top-2 -right-2">
          <Badge className="bg-green-500 text-white text-xs">
            New AI Content
          </Badge>
        </div>
      )}

      {/* Content */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        {section.content ? (
          <div 
            dangerouslySetInnerHTML={{ __html: section.content.replace(/\n/g, '<br/>') }} 
          />
        ) : (
          <p className="text-muted-foreground italic">
            No content yet. This section will be populated when relevant code changes are detected.
          </p>
        )}
      </div>

      {/* Hover Actions */}
      {section.content && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-2 right-2 flex gap-1">
          {latestCommit && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs gap-1"
              onClick={() => setShowSource(!showSource)}
            >
              <GitCommit className="h-3 w-3" />
              {latestCommit.commitHash?.slice(0, 7)}
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs gap-1"
            disabled
            title="Coming in Phase 3"
          >
            <RefreshCw className="h-3 w-3" />
            Regenerate
          </Button>
          {hasNewContent && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs gap-1"
              onClick={() => onDismissHighlight?.(section.id)}
            >
              <EyeOff className="h-3 w-3" />
              Dismiss
            </Button>
          )}
        </div>
      )}

      {/* Source Info (expanded) */}
      {showSource && latestCommit && (
        <div className="mt-3 p-2 bg-muted rounded text-xs space-y-1">
          <p><strong>Commit:</strong> {latestCommit.commitHash}</p>
          <p><strong>Added:</strong> {new Date(latestCommit.addedAt).toLocaleString()}</p>
          {latestCommit.contentPreview && (
            <p><strong>Preview:</strong> {latestCommit.contentPreview}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function ReportViewer({ report, onDismissHighlight }) {
  const [collapsedSections, setCollapsedSections] = useState(new Set());

  if (!report || !report.sections) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No report data available
      </div>
    );
  }

  const toggleSection = (sectionId) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Group sections by level for proper nesting display
  const sections = report.sections;

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{report.title}</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Badge variant="outline">{report.status}</Badge>
          <span>Template: {report.templateId}</span>
          {report.metadata?.totalWordCount > 0 && (
            <span>{report.metadata.totalWordCount.toLocaleString()} words</span>
          )}
        </div>
      </div>

      <Separator />

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section) => {
          const isCollapsed = collapsedSections.has(section.id);
          const level = parseInt(section.number?.split('.')[0]) || 1;
          const indentClass = level > 1 ? `ml-${Math.min((level - 1) * 4, 12)}` : '';

          return (
            <div key={section.id} className={indentClass}>
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="flex items-center gap-2 w-full text-left py-2 hover:bg-muted/50 rounded px-2 -mx-2"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="font-semibold text-lg">
                  {section.number}. {section.title}
                </span>
                {section.aiLastTouched && (
                  <span className="h-2 w-2 rounded-full bg-green-500" title="New content" />
                )}
                {section.wordCount > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {section.wordCount} words
                  </span>
                )}
              </button>

              {/* Section Content */}
              {!isCollapsed && (
                <div className="mt-2">
                  <SectionContent 
                    section={section} 
                    onDismissHighlight={onDismissHighlight}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
