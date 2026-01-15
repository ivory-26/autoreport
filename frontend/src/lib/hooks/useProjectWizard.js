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
   * Create the project
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
          settings: {
            autoProcess: true
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      setCreatedProject(data);
      setStep(4);
      return true;
    } catch (err) {
      setError(err.message);
      console.error('Error creating project:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [selectedRepo, selectedTemplate, projectName]);

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
    setError
  };
}
