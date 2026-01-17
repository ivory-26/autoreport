'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { marked } from 'marked';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// Configure marked for safe HTML rendering
marked.setOptions({
  breaks: true, // Convert \n to <br>
  gfm: true, // GitHub Flavored Markdown
  headerIds: false,
  mangle: false
});
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
  ChevronLeft,
  Loader2,
  Undo2,
  Check,
  CheckCheck,
  Menu,
  List
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

function SectionContent({ section, onDismissHighlight, onRegenerate, onRevert, onAccept, repoUrl, projectId, isRegenerating, revertTooltip }) {
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
      <div
        className={`prose prose-sm dark:prose-invert max-w-none px-4 py-3 ${hasNewContent ? 'border-l-4 border-green-500 rounded-l-none' : ''} 
          [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:my-3 [&_ul]:space-y-1.5
          [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:my-3 [&_ol]:space-y-1.5
          [&_li]:leading-relaxed [&_li]:text-foreground
          [&_ul_ul]:mt-1.5 [&_ol_ol]:mt-1.5
          [&_li>p]:my-0.5
          [&_strong]:font-semibold [&_strong]:text-foreground
          [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-muted [&_code]:text-sm [&_code]:font-mono
        `}
        style={{ fontFamily: "'Times New Roman', Times, serif" }}
      >
        {isRegenerating ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Regenerating content...</span>
          </div>
        ) : section.content ? (
          <div
            dangerouslySetInnerHTML={{ __html: marked.parse(section.content) }}
          />
        ) : (
          <p className="text-muted-foreground italic">
            No content yet. This section will be populated when relevant code changes are detected.
          </p>
        )}
      </div>

      {/* Hover Actions - Only show if there is content and not regenerating */}
      {section.content && !isRegenerating && (
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
            onClick={() => onRegenerate?.(section.templateSectionId)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Regenerate
          </Button>

          {hasNewContent && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs gap-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/50 rounded-full"
              onClick={() => onAccept?.(section.templateSectionId)}
              title="Accept this content"
            >
              <Check className="h-3.5 w-3.5" />
              Accept
            </Button>
          )}

          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground rounded-full"
              onClick={() => onRevert?.(section.templateSectionId)}
              title="Revert to previous version"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Revert
            </Button>
            {revertTooltip && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-foreground text-background text-xs rounded-md whitespace-nowrap shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
                No more previous versions
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportViewer({ report: initialReport, onDismissHighlight, repoUrl, projectId }) {
  const [report, setReport] = useState(initialReport);
  const [collapsedSections, setCollapsedSections] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const [regeneratingSections, setRegeneratingSections] = useState(new Set());
  const [revertTooltips, setRevertTooltips] = useState(new Set());
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [error, setError] = useState(null);
  // Start with false to avoid hydration mismatch, then restore from localStorage
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [expandedOutlineSections, setExpandedOutlineSections] = useState(new Set());
  const [mounted, setMounted] = useState(false);

  // Restore state from localStorage after mount (client-side only)
  useEffect(() => {
    setMounted(true);

    // Restore outline open state
    const savedOutlineOpen = localStorage.getItem('reportOutlineOpen');
    if (savedOutlineOpen) {
      setIsOutlineOpen(JSON.parse(savedOutlineOpen));
    }

    // Restore expanded sections
    const savedExpanded = localStorage.getItem('reportOutlineExpanded');
    if (savedExpanded) {
      setExpandedOutlineSections(new Set(JSON.parse(savedExpanded)));
    }
  }, []);

  // Persist outline state to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('reportOutlineOpen', JSON.stringify(isOutlineOpen));
    }
  }, [isOutlineOpen, mounted]);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('reportOutlineExpanded', JSON.stringify([...expandedOutlineSections]));
    }
  }, [expandedOutlineSections, mounted]);

  // Count sections with new AI content
  const sectionsWithNewContent = report?.sections?.filter(s => s.aiLastTouched) || [];

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

  // Handle regenerate section
  const handleRegenerate = async (sectionId) => {
    setError(null);
    setRegeneratingSections(prev => new Set(prev).add(sectionId));

    try {
      // Use projectId from report if not provided as prop
      const pid = projectId || report.projectId;

      const response = await fetch(`/api/projects/${pid}/sections/${sectionId}/regenerate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to regenerate section');
      }

      // Update the local state with new content
      setReport(prev => ({
        ...prev,
        sections: prev.sections.map(section =>
          section.templateSectionId === sectionId
            ? {
              ...section,
              content: data.section.content,
              wordCount: data.section.wordCount,
              aiLastTouched: true,
              lastUpdated: new Date().toISOString()
            }
            : section
        )
      }));

    } catch (err) {
      console.error('Regenerate error:', err);
      setError(err.message);
    } finally {
      setRegeneratingSections(prev => {
        const newSet = new Set(prev);
        newSet.delete(sectionId);
        return newSet;
      });
    }
  };

  // Handle revert section
  const handleRevert = async (sectionId) => {
    setError(null);

    try {
      // Use projectId from report if not provided as prop
      const pid = projectId || report.projectId;

      const response = await fetch(`/api/projects/${pid}/sections/${sectionId}/revert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // Special handling for "no previous version" error - show tooltip on button
        if (data.error?.includes('No previous version')) {
          setRevertTooltips(prev => new Set(prev).add(sectionId));
          // Auto-dismiss tooltip after 2 seconds
          setTimeout(() => {
            setRevertTooltips(prev => {
              const newSet = new Set(prev);
              newSet.delete(sectionId);
              return newSet;
            });
          }, 2000);
          return;
        }
        throw new Error(data.error || 'Failed to revert section');
      }

      // Update the local state with reverted content
      setReport(prev => ({
        ...prev,
        sections: prev.sections.map(section =>
          section.templateSectionId === sectionId
            ? {
              ...section,
              content: data.section.content,
              wordCount: data.section.wordCount,
              aiLastTouched: false,
              lastUpdated: new Date().toISOString()
            }
            : section
        )
      }));

      // Call the original dismiss handler if provided
      onDismissHighlight?.(sectionId);

    } catch (err) {
      console.error('Revert error:', err);
      setError(err.message);
    }
  };

  // Handle accept section
  const handleAccept = async (sectionId) => {
    setError(null);

    try {
      const pid = projectId || report.projectId;

      const response = await fetch(`/api/projects/${pid}/sections/${sectionId}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept section');
      }

      // Update the local state
      setReport(prev => ({
        ...prev,
        sections: prev.sections.map(section =>
          section.templateSectionId === sectionId
            ? {
              ...section,
              aiLastTouched: false,
              lastUpdated: new Date().toISOString()
            }
            : section
        )
      }));

    } catch (err) {
      console.error('Accept error:', err);
      setError(err.message);
    }
  };

  // Handle accept all sections
  const handleAcceptAll = async () => {
    setError(null);
    setAcceptingAll(true);

    try {
      const pid = projectId || report.projectId;

      const response = await fetch(`/api/projects/${pid}/sections/accept-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept all sections');
      }

      // Update the local state - set all aiLastTouched to false
      setReport(prev => ({
        ...prev,
        sections: prev.sections.map(section => ({
          ...section,
          aiLastTouched: false,
          lastUpdated: new Date().toISOString()
        }))
      }));

    } catch (err) {
      console.error('Accept all error:', err);
      setError(err.message);
    } finally {
      setAcceptingAll(false);
    }
  };

  // Pagination: Split sections into pages (4-5 sections per page)
  const SECTIONS_PER_PAGE = 5;
  const sections = report.sections;
  const totalPages = Math.ceil(sections.length / SECTIONS_PER_PAGE);
  const startIndex = currentPage * SECTIONS_PER_PAGE;
  const endIndex = startIndex + SECTIONS_PER_PAGE;
  const currentSections = sections.slice(startIndex, endIndex);

  // Helper  // Navigate to a section and smooth scroll
  const navigateToSection = (sectionId) => {
    const targetSection = sections.find(s => s.id === sectionId);
    if (!targetSection) return;

    // Calculate which page the section is on
    const sectionIndex = sections.indexOf(targetSection);
    const targetPage = Math.floor(sectionIndex / SECTIONS_PER_PAGE);

    // Change page if needed
    if (currentPage !== targetPage) {
      setCurrentPage(targetPage);
    }

    // Scroll to section after a brief delay to allow page change
    setTimeout(() => {
      const element = document.getElementById(`section-${sectionId}`);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        });

        // Flash highlight effect
        element.style.transition = 'background-color 0.3s ease';
        const originalBg = element.style.backgroundColor;
        element.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        setTimeout(() => {
          element.style.backgroundColor = originalBg;
        }, 1000);
      }
    }, currentPage !== targetPage ? 100 : 0);
  };

  // Toggle outline section expansion
  const toggleOutlineSection = (sectionNumber) => {
    setExpandedOutlineSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionNumber)) {
        newSet.delete(sectionNumber);
      } else {
        newSet.add(sectionNumber);
      }
      return newSet;
    });
  };

  // Build outline structure (group subsections under parent sections)
  const buildOutlineStructure = () => {
    const structure = [];
    let currentParent = null;

    sections.forEach(section => {
      const isSubSection = section.number.includes('.');
      if (isSubSection) {
        if (currentParent) {
          if (!currentParent.subsections) {
            currentParent.subsections = [];
          }
          currentParent.subsections.push(section);
        }
      } else {
        currentParent = { ...section, subsections: [] };
        structure.push(currentParent);
      }
    });

    return structure;
  };

  const outlineStructure = buildOutlineStructure();

  return (
    <div className="w-full flex flex-col bg-muted/10 min-h-screen py-8 gap-6">
      {/* Error Message */}
      {error && (
        <div className="w-full bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Main Container with Outline Sidebar */}
      <div className="relative flex gap-4 w-full items-start">
        {/* Outline Sidebar - Dynamic Height */}
        <div
          className={`flex-shrink-0 transition-all duration-300 ease-in-out ${isOutlineOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'
            }`}
          style={{ maxHeight: 'calc(100vh - 12rem)' }}
        >
          <div className="bg-card shadow-lg rounded-xl border overflow-hidden flex flex-col h-full">
            {/* Outline Header */}
            <div className="p-5 border-b bg-muted/20 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <List className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-base">Outline</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsOutlineOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Outline Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {outlineStructure.map((section, index) => {
                const hasSubsections = section.subsections && section.subsections.length > 0;
                const isExpanded = expandedOutlineSections.has(section.number);
                const isLastItem = index === outlineStructure.length - 1;

                return (
                  <div key={section.id} className={isLastItem ? 'pb-2' : ''}>
                    {/* Parent Section */}
                    <div
                      className="flex items-center gap-1 group rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      {hasSubsections && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleOutlineSection(section.number);
                          }}
                          className="p-1 hover:bg-muted rounded transition-all"
                        >
                          <ChevronRight
                            className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''
                              }`}
                          />
                        </button>
                      )}
                      <button
                        onClick={() => navigateToSection(section.id)}
                        className={`flex-1 text-left px-3 py-2 rounded-lg transition-all ${!hasSubsections ? 'ml-7' : ''
                          } ${section.aiLastTouched
                            ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
                            : 'hover:bg-muted/50'
                          }`}
                      >
                        <span className="text-muted-foreground/60 text-sm mr-2.5 font-mono">
                          {section.number}
                        </span>
                        <span className={`font-medium text-sm leading-relaxed ${section.aiLastTouched ? 'text-green-700 dark:text-green-400' : 'text-foreground/85'
                          }`}>
                          {section.title}
                        </span>
                        {section.aiLastTouched && (
                          <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        )}
                      </button>
                    </div>

                    {/* Subsections */}
                    {hasSubsections && isExpanded && (
                      <div className="ml-5 mt-1.5 space-y-1 border-l-2 border-muted pl-3">
                        {section.subsections.map((subsection, subIndex) => {
                          const isLastSubItem = subIndex === section.subsections.length - 1;
                          return (
                            <button
                              key={subsection.id}
                              onClick={() => navigateToSection(subsection.id)}
                              className={`w-full text-left px-3 py-1.5 rounded-lg transition-all group ${isLastSubItem ? 'mb-1' : ''
                                } ${subsection.aiLastTouched
                                  ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
                                  : 'hover:bg-muted/50'
                                }`}
                            >
                              <span className="text-muted-foreground/60 mr-2.5 text-sm font-mono">
                                {subsection.number}
                              </span>
                              <span className={`text-sm leading-relaxed ${subsection.aiLastTouched ? 'text-green-700 dark:text-green-400 font-medium' : 'text-foreground/75'
                                }`}>
                                {subsection.title}
                              </span>
                              {subsection.aiLastTouched && (
                                <span className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Report Content - Adjusted width when outline is open */}
        <div className={`flex-1 transition-all duration-300 ${isOutlineOpen ? 'max-w-[calc(100%-21rem)]' : 'max-w-full'}`}>
          {/* A4 Paper-like Container - Fixed Height */}
          <div
            className="w-full bg-card text-card-foreground shadow-xl rounded-xl border min-h-[800px] flex flex-col relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-t-xl opacity-80" />

            {/* Outline Toggle Button - Fixed Position on Left */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 left-4 z-20 h-9 w-9 rounded-full shadow-md bg-background/80 backdrop-blur-sm hover:bg-background border"
              onClick={() => setIsOutlineOpen(!isOutlineOpen)}
              title="Toggle Outline"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Header */}
            <div className="px-8 pt-16 pb-6 space-y-3 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h1
                  className="text-3xl font-bold tracking-tight text-foreground/90 leading-tight py-1"
                  style={{ fontFamily: "'Times New Roman', Times, serif" }}
                >
                  {report.title}
                </h1>
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

            {/* Accept All Button - Show when there are sections with new content */}
            {sectionsWithNewContent.length > 0 && (
              <div className="px-12 pb-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span>{sectionsWithNewContent.length} section{sectionsWithNewContent.length > 1 ? 's' : ''} with new AI content</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950"
                    onClick={handleAcceptAll}
                    disabled={acceptingAll}
                  >
                    {acceptingAll ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCheck className="h-4 w-4" />
                    )}
                    Accept All
                  </Button>
                </div>
              </div>
            )}

            <div className="px-12 pb-3 flex-shrink-0">
              <Separator />
            </div>

            {/* Sections - Scrollable Content Area */}
            <div className="px-8 py-6 space-y-6 flex-1 overflow-y-auto">
              {currentSections.map((section) => {
                const isCollapsed = collapsedSections.has(section.id);
                const isSubSection = section.number.includes('.');
                const isRegenerating = regeneratingSections.has(section.templateSectionId);

                return (
                  <div
                    key={section.id}
                    id={`section-${section.id}`}
                    className={`${isSubSection ? 'ml-6 mt-3' : 'mt-6'}`}
                  >
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
                      {isRegenerating && (
                        <Loader2 className="ml-2 h-4 w-4 animate-spin text-blue-500" />
                      )}
                    </div>

                    {/* Section Content */}
                    <div className={`transition-all duration-300 ease-in-out origin-top ${isCollapsed ? 'h-0 opacity-0 overflow-hidden' : 'opacity-100'}`}>
                      <SectionContent
                        section={section}
                        onDismissHighlight={onDismissHighlight}
                        onRegenerate={handleRegenerate}
                        onRevert={handleRevert}
                        onAccept={handleAccept}
                        repoUrl={repoUrl}
                        projectId={projectId || report.projectId}
                        isRegenerating={isRegenerating}
                        revertTooltip={revertTooltips.has(section.templateSectionId)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer with Page Number */}
            <div className="px-8 py-4 border-t bg-muted/5 rounded-b-xl flex-shrink-0">
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
            <div className="flex items-center justify-center gap-2 mt-6">
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
      </div>
    </div>
  );
}

