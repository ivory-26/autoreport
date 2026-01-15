'use client';

import { useState } from 'react';
import Link from 'next/link';
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
  ChevronRight,
  Sparkles,
  X,
  ChevronLeft
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

function SectionContent({ section, onDismissHighlight, repoUrl }) {
  const hasNewContent = section.aiLastTouched;
  const latestCommit = section.contributions?.[section.contributions.length - 1];

  // Construct commit URL with normalized repo URL
  const normalizedRepoUrl = normalizeGitHubUrl(repoUrl);
  const commitUrl = latestCommit && normalizedRepoUrl
    ? `${normalizedRepoUrl}/commit/${latestCommit.commitHash}`
    : null;

  return (
    <div
      className={`group relative rounded-md transition-all duration-200 border border-transparent ${hasNewContent
        ? 'bg-green-50/80 dark:bg-green-900/20 hover:bg-green-100/80 dark:hover:bg-green-900/30'
        : 'hover:bg-muted/30'
        }`}
    >
      {/* Content */}
      <div className={`prose prose-sm dark:prose-invert max-w-none px-4 py-3 ${hasNewContent ? 'border-l-4 border-green-500 rounded-l-none' : ''}`}>
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

      {/* Hover Actions - Only show if there is content */}
      {section.content && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-3 right-4 flex items-center gap-2 bg-background/95 backdrop-blur-sm p-1 rounded-full shadow-sm border text-xs z-10">
          {commitUrl && (
            <a
              href={commitUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border-r"
              title="View Commit on GitHub"
            >
              <GitCommit className="h-3.5 w-3.5" />
              <span className="font-mono text-[10px]">{latestCommit.commitHash.slice(0, 7)}</span>
            </a>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-3 text-xs gap-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/50 rounded-full"
            title="Regenerate with AI"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Regenerate
          </Button>

          {hasNewContent && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground rounded-full"
              onClick={() => onDismissHighlight?.(section.id)}
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function ReportViewer({ report, onDismissHighlight, repoUrl }) {
  const [collapsedSections, setCollapsedSections] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(0);

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

  // Pagination: Split sections into pages (4-5 sections per page)
  const SECTIONS_PER_PAGE = 5;
  const sections = report.sections;
  const totalPages = Math.ceil(sections.length / SECTIONS_PER_PAGE);
  const startIndex = currentPage * SECTIONS_PER_PAGE;
  const endIndex = startIndex + SECTIONS_PER_PAGE;
  const currentSections = sections.slice(startIndex, endIndex);

  return (
    <div className="w-full flex flex-col items-center bg-muted/10 min-h-screen py-8 gap-6">
      {/* A4 Paper-like Container - Fixed Height */}
      <div className="w-full max-w-[794px] bg-card text-card-foreground shadow-xl rounded-xl border h-[1123px] flex flex-col relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-t-xl opacity-80" />

        {/* Header */}
        <div className="px-12 pt-16 pb-6 space-y-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight text-foreground/90 font-serif">{report.title}</h1>
            <Badge variant={report.status === 'final' ? 'default' : 'secondary'} className="uppercase tracking-wider text-[10px]">
              {report.status}
            </Badge>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-wider opacity-70">Template</span>
              <span>{report.templateId}</span>
            </div>
            {report.metadata?.totalWordCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                <span>{report.metadata.totalWordCount.toLocaleString()} words</span>
              </div>
            )}
            {report.metadata?.version && (
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-muted-foreground/50" />
                <span>v{report.metadata.version}</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-12 pb-3 flex-shrink-0">
          <Separator />
        </div>

        {/* Sections - Scrollable Content Area */}
        <div className="px-12 py-6 space-y-6 flex-1 overflow-y-auto">
          {currentSections.map((section) => {
            const isCollapsed = collapsedSections.has(section.id);
            const isSubSection = section.number.includes('.');

            return (
              <div key={section.id} className={`${isSubSection ? 'ml-6 mt-3' : 'mt-6'}`}>
                {/* Section Header */}
                <div
                  className="group flex items-center gap-2 w-full text-left py-1 mb-2 rounded hover:bg-muted/30 cursor-pointer -ml-2 pl-2 transition-colors relative"
                  onClick={() => toggleSection(section.id)}
                >
                  <div className={`p-1 rounded-md text-muted-foreground group-hover:bg-muted/50 transition-all ${isCollapsed ? '-rotate-90' : 'rotate-0'} duration-200`}>
                    <ChevronDown className="h-4 w-4" />
                  </div>

                  <span className={`font-semibold text-foreground/80 ${isSubSection ? 'text-base' : 'text-lg'}`}>
                    <span className="text-muted-foreground/60 mr-2 font-normal">{section.number}</span>
                    {section.title}
                  </span>

                  {/* Indicators */}
                  {section.aiLastTouched && (
                    <span className="ml-2 h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" title="New AI content" />
                  )}
                </div>

                {/* Section Content */}
                <div className={`transition-all duration-300 ease-in-out origin-top ${isCollapsed ? 'h-0 opacity-0 overflow-hidden' : 'opacity-100'}`}>
                  <SectionContent
                    section={section}
                    onDismissHighlight={onDismissHighlight}
                    repoUrl={repoUrl}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with Page Number */}
        <div className="px-12 py-4 border-t bg-muted/5 rounded-b-xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium tracking-wide opacity-50">
              AUTOREPORT • {new Date().getFullYear()}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              Page {currentPage + 1} of {totalPages}
            </p>
          </div>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
            disabled={currentPage === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i}
                variant={currentPage === i ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCurrentPage(i)}
                className="w-8 h-8 p-0"
              >
                {i + 1}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
            disabled={currentPage === totalPages - 1}
            className="gap-2"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
