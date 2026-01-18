'use client';

import { useState, useCallback } from 'react';

/**
 * Custom hook for managing the project setup wizard
 * Handles multi-step form state and API interactions
 */
export function useProjectWizard() {
  // Wizard state
  const [step, setStep] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Data state
  const [repos, setRepos] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [createdProject, setCreatedProject] = useState(null);

  // Pagination for repos
  const [repoPage, setRepoPage] = useState(1);
  const [hasMoreRepos, setHasMoreRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');

  /**
   * Fetch user's GitHub repositories
   */
  const fetchRepos = useCallback(async (page = 1, append = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/github/repos?page=${page}&per_page=30&sort=updated`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch repositories');
      }

      const data = await response.json();
      
      if (append) {
        setRepos(prev => [...prev, ...data.repos]);
      } else {
        setRepos(data.repos);
      }
      
      setHasMoreRepos(data.pagination.hasNextPage);
      setRepoPage(page);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching repos:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch available templates
   */
  const fetchTemplates = useCallback(async () => {
    try {
      console.log('[Wizard] Fetching templates...');
      const response = await fetch('/api/templates');
      
      if (!response.ok) {
        const data = await response.json();
        console.error('[Wizard] Templates API error:', data);
        throw new Error(data.error || 'Failed to fetch templates');
      }

      const data = await response.json();
      console.log('[Wizard] Templates fetched:', data);
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('[Wizard] Error fetching templates:', err);
      setError('Failed to load templates. Please try again.');
    }
  }, []);

  /**
   * Open the wizard and fetch initial data
   */
  const openWizard = useCallback(async () => {
    setIsOpen(true);
    setStep(1);
    setError(null);
    setSelectedRepo(null);
    setSelectedTemplate(null);
    setProjectName('');
    setCreatedProject(null);
    
    // Fetch repos and templates in parallel
    try {
      setIsLoading(true);
      await Promise.all([fetchRepos(), fetchTemplates()]);
    } finally {
      setIsLoading(false);
    }
  }, [fetchRepos, fetchTemplates]);

  /**
   * Close the wizard and reset state
   */
  const closeWizard = useCallback(() => {
    setIsOpen(false);
    setStep(1);
    setError(null);
    setSelectedRepo(null);
    setSelectedTemplate(null);
    setProjectName('');
    setCreatedProject(null);
    setRepoPage(1);
    setRepoSearch('');
  }, []);

  /**
   * Load more repositories
   */
  const loadMoreRepos = useCallback(() => {
    if (hasMoreRepos && !isLoading) {
      fetchRepos(repoPage + 1, true);
    }
  }, [fetchRepos, hasMoreRepos, isLoading, repoPage]);

  /**
   * Select a repository
   */
  const selectRepo = useCallback((repo) => {
    setSelectedRepo(repo);
    setProjectName(repo.name);
    setError(null);
  }, []);

  /**
   * Select a template
   */
  const selectTemplate = useCallback((template) => {
    setSelectedTemplate(template);
    setError(null);
  }, []);

  /**
   * Go to next step
   */
  const nextStep = useCallback(() => {
    if (step === 1 && !selectedRepo) {
      setError('Please select a repository');
      return false;
    }
    if (step === 2 && !selectedTemplate) {
      setError('Please select a template');
      return false;
    }
    if (step === 3 && !projectName.trim()) {
      setError('Please enter a project name');
      return false;
    }
    
    setError(null);
    setStep(prev => Math.min(prev + 1, 4));
    return true;
  }, [step, selectedRepo, selectedTemplate, projectName]);

  /**
   * Go to previous step
   */
  const prevStep = useCallback(() => {
    setError(null);
    setStep(prev => Math.max(prev - 1, 1));
  }, []);

  /**
   * Fetch the latest report for a project
   */
  const fetchLatestReport = useCallback(async (projectId) => {
    try {
      // Poll for the report - it may take a moment to be created
      for (let i = 0; i < 10; i++) {
        const response = await fetch(`/api/projects/${projectId}`);
        if (!response.ok) {
          console.warn('[Wizard] Failed to fetch project details');
          break;
        }

        const data = await response.json();
        
        // Check if project has a report
        if (data.report && data.report._id) {
          // Update the createdProject with report data
          setCreatedProject(prev => ({
            ...prev,
            report: {
              _id: data.report._id,
              title: data.report.title,
              status: data.report.status
            }
          }));
          console.log('[Wizard] Found generated report:', data.report._id);
          return;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // If we didn't find a report, keep previous state (don't mark as complete/false)
      // The polling mechanism will handle the completion state
    } catch (err) {
      console.warn('[Wizard] Error fetching latest report:', err);
    }
  }, []);

  /**
   * Poll job progress until completion
   */
  const pollJobProgress = useCallback(async (jobId, projectId) => {
    try {
      console.log(`[Wizard] Starting polling for job ${jobId}`);
      
      const poll = async () => {
        const response = await fetch(`/api/progress/${jobId}`);
        if (!response.ok) return false;
        
        const data = await response.json();
        const { job } = data;
        
        if (!job) return false;
        
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'dead') {
          return true; // Stop polling
        }
        
        return false; // Continue polling
      };

      // Poll every 2 seconds
      const intervalId = setInterval(async () => {
        const isComplete = await poll();
        if (isComplete) {
          clearInterval(intervalId);
          
          // Fetch final report data
          await fetchLatestReport(projectId);
          
          setCreatedProject(prev => ({
            ...prev,
            generatingInitialReport: false,
            generationComplete: true
          }));
        }
      }, 2000);
      
      // Initial poll
      poll();
      
    } catch (err) {
      console.error('[Wizard] Error polling job:', err);
    }
  }, [fetchLatestReport]);

  /**
   * Create the project and generate initial report
   */
  const createProject = useCallback(async () => {
    if (!selectedRepo || !selectedTemplate || !projectName.trim()) {
      setError('Missing required fields');
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      const [repoOwner, repoName] = selectedRepo.fullName.split('/');

      // Step 1: Create the project
      const response = await fetch('/api/projects/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: projectName.trim(),
          repoUrl: selectedRepo.url,
          repoFullName: selectedRepo.fullName,
          repoOwner,
          repoName,
          templateId: selectedTemplate.id,
          isRepoPublic: !selectedRepo.private,
          settings: {
            autoProcess: true
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      // Step 2: Generate initial report from last commit
      const projectId = data.project.id;
      console.log('[Wizard] Triggering initial report generation for project:', projectId);
      
      const genResponse = await fetch(`/api/projects/${projectId}/generate-initial`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          owner: repoOwner,
          repo: repoName
        })
      });
      
      const genResult = await genResponse.json();
      
      if (genResult.success && genResult.jobId) {
        console.log('[Wizard] Initial report generation started, job:', genResult.jobId);
        // Start polling for progress
        pollJobProgress(genResult.jobId, projectId);
      } else {
        console.warn('[Wizard] Initial report generation failed to start:', genResult.error);
      }

      // Add generation status to created project
      setCreatedProject({
        ...data,
        generatingInitialReport: true,
        generationComplete: false
      });
      setStep(4);
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Error creating project:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [selectedRepo, selectedTemplate, projectName, pollJobProgress]);

  /**
   * Filter repos by search query
   */
  const filteredRepos = repos.filter(repo => 
    repoSearch === '' || 
    repo.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
    repo.fullName.toLowerCase().includes(repoSearch.toLowerCase())
  );

  return {
    // State
    step,
    isOpen,
    isLoading,
    error,
    repos: filteredRepos,
    templates,
    selectedRepo,
    selectedTemplate,
    projectName,
    createdProject,
    hasMoreRepos,
    repoSearch,

    // Actions
    openWizard,
    closeWizard,
    fetchRepos,
    loadMoreRepos,
    fetchTemplates,
    selectRepo,
    selectTemplate,
    setProjectName,
    setRepoSearch,
    nextStep,
    prevStep,
    createProject,
    fetchLatestReport,
    setError
  };
}
