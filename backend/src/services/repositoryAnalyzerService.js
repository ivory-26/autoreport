/**
 * Repository Analyzer Service
 * 
 * Provides comprehensive analysis of a GitHub repository for initial report generation.
 * Fetches README, key source files, and generates content for all template sections.
 */

const { getFileImportance, getTopImportantFiles, PRIORITY_FILES } = require('./gitParser');
const { analyze } = require('./analyzerAgent');
const { generate, generateSectionIntro } = require('./writerAgent');
const { webhookQueue, JOB_STATUS } = require('./queue');

/**
 * Fetch repository overview including README and structure
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} accessToken - GitHub access token
 * @returns {Promise<Object>} - Repository overview data
 */
async function fetchRepositoryOverview(owner, repo, accessToken) {
  console.log(`[RepoAnalyzer] Fetching repository overview for ${owner}/${repo}`);
  
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${accessToken}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };

  const result = {
    readme: null,
    packageJson: null,
    repoInfo: null,
    fileTree: [],
    languages: {}
  };

  try {
    // Fetch repository info
    const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (repoResponse.ok) {
      result.repoInfo = await repoResponse.json();
    }

    // Fetch README
    const readmeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers });
    if (readmeResponse.ok) {
      const readmeData = await readmeResponse.json();
      // Decode base64 content
      result.readme = Buffer.from(readmeData.content, 'base64').toString('utf-8');
      console.log(`[RepoAnalyzer] Fetched README: ${result.readme.length} chars`);
    }

    // Fetch package.json for tech stack detection
    try {
      const pkgResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, { headers });
      if (pkgResponse.ok) {
        const pkgData = await pkgResponse.json();
        const pkgContent = Buffer.from(pkgData.content, 'base64').toString('utf-8');
        result.packageJson = JSON.parse(pkgContent);
        console.log(`[RepoAnalyzer] Fetched package.json`);
      }
    } catch (e) {
      // No package.json, not an error
    }

    // Fetch repository languages
    const langResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers });
    if (langResponse.ok) {
      result.languages = await langResponse.json();
    }

    // Fetch file tree (root level)
    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers });
    if (treeResponse.ok) {
      const treeData = await treeResponse.json();
      result.fileTree = treeData.map(f => ({
        name: f.name,
        path: f.path,
        type: f.type,
        size: f.size
      }));
    }

  } catch (error) {
    console.error('[RepoAnalyzer] Error fetching repository overview:', error.message);
  }

  return result;
}

/**
 * Fetch content of key source files
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} accessToken - GitHub access token
 * @param {Array} fileTree - File tree from fetchRepositoryOverview
 * @param {number} maxFiles - Maximum number of files to fetch
 * @returns {Promise<Array>} - Array of file contents
 */
async function fetchKeyFiles(owner, repo, accessToken, fileTree, maxFiles = 5) {
  console.log(`[RepoAnalyzer] Fetching key source files`);
  
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${accessToken}`,
    'X-GitHub-Api-Version': '2022-11-28'
  };

  // Get files sorted by importance
  const filesWithImportance = fileTree
    .filter(f => f.type === 'file')
    .map(f => ({
      ...f,
      importance: getFileImportance(f.path)
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, maxFiles);

  const keyFiles = [];

  for (const file of filesWithImportance) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`,
        { headers }
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.encoding === 'base64') {
          const content = Buffer.from(data.content, 'base64').toString('utf-8');
          keyFiles.push({
            path: file.path,
            content: content.substring(0, 5000), // Limit content size
            importance: file.importance
          });
          console.log(`[RepoAnalyzer] Fetched ${file.path} (${content.length} chars)`);
        }
      }
    } catch (error) {
      console.error(`[RepoAnalyzer] Error fetching ${file.path}:`, error.message);
    }
  }

  return keyFiles;
}

/**
 * Extract tech stack from package.json and languages
 * @param {Object} packageJson - Parsed package.json
 * @param {Object} languages - Languages object from GitHub API
 * @returns {Array<string>} - List of technologies
 */
function extractTechStack(packageJson, languages) {
  const techStack = [];

  // From languages
  const topLanguages = Object.keys(languages || {}).slice(0, 3);
  techStack.push(...topLanguages);

  // From package.json dependencies
  if (packageJson) {
    const deps = { 
      ...packageJson.dependencies, 
      ...packageJson.devDependencies 
    };
    
    // Common frameworks/libraries to detect
    const knownTech = {
      'react': 'React',
      'next': 'Next.js',
      'vue': 'Vue.js',
      'angular': 'Angular',
      'express': 'Express.js',
      'fastify': 'Fastify',
      'mongoose': 'MongoDB/Mongoose',
      'prisma': 'Prisma ORM',
      'tailwindcss': 'Tailwind CSS',
      'typescript': 'TypeScript',
      'jest': 'Jest Testing',
      'socket.io': 'Socket.IO'
    };

    for (const dep of Object.keys(deps)) {
      for (const [key, name] of Object.entries(knownTech)) {
        if (dep.includes(key) && !techStack.includes(name)) {
          techStack.push(name);
        }
      }
    }
  }

  return techStack.slice(0, 8); // Limit to 8 items
}

/**
 * Generate analysis context from repository overview
 * @param {Object} repoOverview - Output from fetchRepositoryOverview
 * @param {Array} keyFiles - Key file contents
 * @returns {Object} - Analysis context for AI
 */
function buildRepositoryContext(repoOverview, keyFiles) {
  const { readme, packageJson, repoInfo, languages, fileTree } = repoOverview;

  // Build file summary
  const fileSummary = fileTree.map(f => f.path).join(', ');
  
  // Build tech stack
  const techStack = extractTechStack(packageJson, languages);

  // Build project description from multiple sources
  let description = repoInfo?.description || '';
  if (readme) {
    // Extract first meaningful paragraph from README
    const paragraphs = readme.split(/\n\n+/).filter(p => 
      p.trim().length > 50 && 
      !p.startsWith('#') && 
      !p.startsWith('```') &&
      !p.startsWith('![')
    );
    if (paragraphs.length > 0) {
      description = paragraphs[0].substring(0, 500);
    }
  }

  return {
    name: repoInfo?.name || 'Project',
    description,
    techStack,
    readme: readme?.substring(0, 3000) || '',
    keyFiles,
    fileStructure: fileSummary,
    stars: repoInfo?.stargazers_count || 0,
    language: repoInfo?.language || 'Unknown'
  };
}

/**
 * Generate initial report content for all sections based on repository analysis
 * @param {Object} params
 * @param {Object} params.repoContext - Repository context from buildRepositoryContext
 * @param {Array} params.templateSections - Template sections to populate
 * @param {Object} params.projectMetadata - Project metadata
 * @param {Function} params.onProgress - Progress callback
 * @returns {Promise<Array>} - Array of generated content per section
 */
async function generateInitialReportContent({
  repoContext,
  templateSections,
  projectMetadata,
  onProgress,
  jobId // Optional job ID for key assignment
}) {
  console.log(`[RepoAnalyzer] Generating initial content for ${templateSections.length} sections`);
  
  const results = [];

  // Build a comprehensive analysis from repository data
  const repositoryAnalysis = {
    success: true,
    changeType: 'feature',
    impactLevel: 'major',
    entities: [],
    semanticTags: repoContext.techStack.map(t => t.toLowerCase()),
    technicalSummary: `This is a ${repoContext.language} project${repoContext.techStack.length > 0 ? ` using ${repoContext.techStack.join(', ')}` : ''}. ${repoContext.description}`,
    suggestedSections: templateSections.map(s => ({
      sectionId: s.id,
      confidence: 0.8,
      reason: 'Initial repository analysis'
    }))
  };

  // Add entities from key files
  for (const file of repoContext.keyFiles || []) {
    repositoryAnalysis.entities.push({
      type: 'file',
      name: file.path.split('/').pop(),
      action: 'created',
      file: file.path,
      description: `Key source file with importance score ${file.importance}`
    });
  }

  // Generate content for each section
  for (let i = 0; i < templateSections.length; i++) {
    const section = templateSections[i];
    
    if (onProgress) {
      onProgress({
        stage: 'generating',
        current: i + 1,
        total: templateSections.length,
        sectionTitle: section.title
      });
    }

    // Check for abortion
    if (jobId && await webhookQueue.isJobAborted(jobId)) {
      console.log(`[RepoAnalyzer] Job ${jobId.substring(0, 8)} was aborted. Stopping generation.`);
      throw new Error('JOB_ABORTED');
    }

    console.log(`[RepoAnalyzer] Generating content for section: ${section.title}`);

    try {
      // Customize analysis based on section type
      const sectionAnalysis = {
        ...repositoryAnalysis,
        technicalSummary: buildSectionSummary(section, repoContext)
      };

      const result = await generate({
        analysisResult: sectionAnalysis,
        targetSection: {
          id: section.id || section._id,
          title: section.title,
          number: section.number,
          aiHints: section.aiHints,
          style: section.style,
          existingContent: '',
          contentHistory: []
        },
        projectMetadata: {
          name: repoContext.name,
          description: repoContext.description
        },
        commitInfo: {
          hash: 'initial',
          message: 'Initial repository analysis',
          author: 'System'
        },
        repoContext, // Pass full context for initial generation
        allSections: templateSections, // Pass template structure for context
        jobId // Pass job ID for consistent key usage
      });

      results.push({
        sectionId: section.id,
        sectionTitle: section.title,
        success: result.success,
        content: result.content,
        wordCount: result.wordCount
      });

    } catch (error) {
      console.error(`[RepoAnalyzer] Error generating content for ${section.title}:`, error.message);
      results.push({
        sectionId: section.id,
        sectionTitle: section.title,
        success: false,
        error: error.message
      });
    }

    // Rate limiting delay
    if (i < templateSections.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * Build a section-specific summary based on section type
 */
function buildSectionSummary(section, repoContext) {
  const sectionId = section.id.toLowerCase();
  
  if (sectionId.includes('introduction') || sectionId.includes('overview')) {
    return `Project Overview: ${repoContext.name} is ${repoContext.description}. Built with ${repoContext.techStack.join(', ')}.`;
  }
  
  if (sectionId.includes('purpose') || sectionId.includes('objective')) {
    return `The project aims to provide a solution using ${repoContext.language} and related technologies. ${repoContext.description}`;
  }
  
  if (sectionId.includes('scope')) {
    return `The scope encompasses ${repoContext.keyFiles?.length || 'multiple'} key components and utilizes ${repoContext.techStack.join(', ')}.`;
  }
  
  if (sectionId.includes('architecture') || sectionId.includes('design')) {
    return `The system architecture is built on ${repoContext.techStack.join(', ')}. Key files include: ${repoContext.keyFiles?.map(f => f.path).join(', ') || 'multiple source files'}.`;
  }
  
  if (sectionId.includes('feature') || sectionId.includes('implementation')) {
    return `The implementation includes various features built with ${repoContext.techStack.join(', ')}. ${repoContext.description}`;
  }

  // Default
  return `${repoContext.description}. Technologies used: ${repoContext.techStack.join(', ')}.`;
}

/**
 * Main function to analyze repository and generate initial report
 * @param {Object} params
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @param {string} params.accessToken - GitHub access token
 * @param {Array} params.templateSections - Template sections
 * @param {Object} params.projectMetadata - Project metadata
 * @param {Function} params.onProgress - Progress callback
 * @returns {Promise<Object>} - Analysis results and generated content
 */
async function analyzeRepositoryForInitialReport({
  owner,
  repo,
  accessToken,
  templateSections,
  projectMetadata,
  onProgress,
  jobId // Optional job ID for key assignment
}) {
  console.log(`[RepoAnalyzer] Starting full repository analysis for ${owner}/${repo}`);

  if (onProgress) {
    onProgress({ stage: 'fetching', message: 'Fetching repository overview' });
  }

  // Step 1: Fetch repository overview
  const repoOverview = await fetchRepositoryOverview(owner, repo, accessToken);

  if (onProgress) {
    onProgress({ stage: 'fetching', message: 'Fetching key source files' });
  }

  // Step 2: Fetch key files
  const keyFiles = await fetchKeyFiles(owner, repo, accessToken, repoOverview.fileTree, 5);

  // Step 3: Build context
  const repoContext = buildRepositoryContext(repoOverview, keyFiles);
  console.log(`[RepoAnalyzer] Repository context built: ${repoContext.techStack.join(', ')}`);

  if (onProgress) {
    onProgress({ stage: 'analyzing', message: 'Generating section content' });
  }

  // Step 4: Generate content for all sections
  const generatedContent = await generateInitialReportContent({
    repoContext,
    templateSections,
    projectMetadata,
    onProgress,
    jobId
  });

  const successCount = generatedContent.filter(r => r.success).length;
  console.log(`[RepoAnalyzer] Completed: ${successCount}/${templateSections.length} sections generated`);

  return {
    success: successCount > 0,
    repoContext,
    generatedContent,
    stats: {
      sectionsGenerated: successCount,
      sectionsFailed: templateSections.length - successCount,
      techStackDetected: repoContext.techStack,
      hasReadme: !!repoOverview.readme,
      keyFilesAnalyzed: keyFiles.length
    }
  };
}

module.exports = {
  fetchRepositoryOverview,
  fetchKeyFiles,
  extractTechStack,
  buildRepositoryContext,
  generateInitialReportContent,
  analyzeRepositoryForInitialReport
};
