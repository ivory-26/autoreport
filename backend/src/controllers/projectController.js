/**
 * Project Controller
 * 
 * Handles project creation, template management,
 * and GitHub webhook setup.
 */

const crypto = require('crypto');
const Project = require('../models/Project');
const Report = require('../models/Report');
const Template = require('../models/Template');
const { analyze } = require('../services/analyzerAgent');
const { generateForAllSections } = require('../services/writerAgent');
const { autoLogger } = require('../services/autoLogger');

// Fallback templates for when database is empty
const fallbackTemplates = [
  {
    templateId: 'IEEE_SRS_V1',
    name: 'IEEE Software Requirements Specification',
    standard: 'IEEE-830',
    version: '1.0',
    description: 'Based on IEEE 830 standard for documenting software requirements.',
    sections: [
      { id: 'introduction', number: '1', title: 'Introduction', level: 1, required: true },
      { id: 'purpose', number: '1.1', title: 'Purpose', level: 2, required: true },
      { id: 'scope', number: '1.2', title: 'Scope', level: 2, required: true },
      { id: 'overall-description', number: '2', title: 'Overall Description', level: 1, required: true },
      { id: 'specific-requirements', number: '3', title: 'Specific Requirements', level: 1, required: true },
      { id: 'implementation', number: '4', title: 'Implementation Details', level: 1, required: true },
    ]
  },
  {
    templateId: 'IEEE_SDD_V1',
    name: 'IEEE Software Design Description',
    standard: 'IEEE-1016',
    version: '1.0',
    description: 'Based on IEEE 1016 standard for software design documentation.',
    sections: [
      { id: 'introduction', number: '1', title: 'Introduction', level: 1, required: true },
      { id: 'design-overview', number: '2', title: 'Design Overview', level: 1, required: true },
      { id: 'system-architecture', number: '3', title: 'System Architecture', level: 1, required: true },
      { id: 'data-design', number: '4', title: 'Data Design', level: 1, required: true },
    ]
  },
  {
    templateId: 'AGILE_LOG_V1',
    name: 'Agile Sprint Log',
    standard: 'AGILE',
    version: '1.0',
    description: 'Lightweight template for tracking sprint progress.',
    sections: [
      { id: 'sprint-overview', number: '1', title: 'Sprint Overview', level: 1, required: true },
      { id: 'completed-work', number: '2', title: 'Completed Work', level: 1, required: true },
      { id: 'technical-notes', number: '3', title: 'Technical Notes', level: 1, required: false },
    ]
  }
];

/**
 * Helper function to find a template (DB or fallback)
 * @param {string} templateId - Template ID to find
 * @returns {Promise<Object|null>} - Template object or null
 */
async function findTemplate(templateId) {
  // Try database first
  let template = await Template.findOne({ 
    templateId,
    $or: [{ isActive: true }, { isActive: { $exists: false } }]
  });
  
  // If not in DB, check fallbacks
  if (!template) {
    template = fallbackTemplates.find(t => t.templateId === templateId);
  }
  
  return template;
}

/**
 * Generate a random webhook secret
 * @returns {string} - 32 character hex string
 */
function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get all available templates
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function getTemplates(req, res) {
  try {
    const templates = await Template.find({ isActive: true })
      .select('templateId name standard version description metadata sections')
      .lean();

    // Transform to simpler format for frontend
    const templatesForFrontend = templates.map(t => ({
      id: t.templateId,
      name: t.name,
      standard: t.standard,
      version: t.version,
      description: t.description,
      metadata: t.metadata,
      sectionsCount: t.sections?.length || 0,
      sections: t.sections?.map(s => ({
        id: s.id,
        number: s.number,
        title: s.title,
        level: s.level,
        required: s.required
      })) || []
    }));

    res.status(200).json({
      success: true,
      templates: templatesForFrontend
    });
  } catch (error) {
    console.error('[ProjectController] Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates'
    });
  }
}

/**
 * Create a new project with initial report
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function createProject(req, res) {
  try {
    const {
      name,
      repoUrl,
      repoFullName,
      templateId,
      ownerId,
      settings = {}
    } = req.body;

    // Validate required fields
    if (!name || !repoUrl || !repoFullName || !templateId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, repoUrl, repoFullName, templateId'
      });
    }

    // Check if project already exists for this repo
    const existingProject = await Project.findOne({ repoFullName });
    if (existingProject) {
      return res.status(409).json({
        success: false,
        error: 'A project already exists for this repository',
        existingProjectId: existingProject._id
      });
    }

    // Verify template exists
    const template = await Template.findOne({ templateId, isActive: true });
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Generate webhook secret
    const webhookSecret = generateWebhookSecret();

    // Create the project
    const project = new Project({
      name,
      repoUrl,
      repoFullName,
      owner: ownerId || null,
      activeTemplateId: templateId,
      webhookSecret,
      settings: {
        autoProcess: settings.autoProcess !== false,
        ignoredPaths: settings.ignoredPaths || [
          'node_modules/**',
          'package-lock.json',
          'pnpm-lock.yaml',
          'yarn.lock',
          '.git/**',
          'dist/**',
          'build/**',
          '*.min.js',
          '*.min.css'
        ],
        techStack: settings.techStack || []
      },
      status: 'active'
    });

    await project.save();

    // Create initial report with template sections
    const initialSections = template.sections.map(section => ({
      id: crypto.randomUUID(),
      templateSectionId: section.id,
      title: section.title,
      number: section.number,
      content: '',
      lastUpdated: new Date(),
      aiLastTouched: false,
      wordCount: 0,
      contributions: []
    }));

    const report = new Report({
      projectId: project._id,
      templateId: templateId,
      title: `${name} - Project Report`,
      status: 'draft',
      sections: initialSections,
      metadata: {
        totalWordCount: 0,
        lastAIUpdate: null,
        version: 1
      }
    });

    await report.save();

    console.log(`[ProjectController] Created project: ${name} (${repoFullName})`);

    res.status(201).json({
      success: true,
      project: {
        id: project._id,
        name: project.name,
        repoUrl: project.repoUrl,
        repoFullName: project.repoFullName,
        templateId: project.activeTemplateId,
        webhookSecret: project.webhookSecret,
        status: project.status,
        createdAt: project.createdAt
      },
      report: {
        id: report._id,
        title: report.title,
        status: report.status,
        sectionsCount: report.sections.length
      },
      webhookUrl: `${process.env.BACKEND_URL || 'https://your-backend.onrender.com'}/webhooks/github`
    });
  } catch (error) {
    console.error('[ProjectController] Error creating project:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'A project already exists for this repository'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create project'
    });
  }
}

/**
 * Setup GitHub webhook for a project
 * This endpoint is called after project creation to configure the webhook
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function setupWebhook(req, res) {
  try {
    const { projectId } = req.params;
    const { accessToken, owner, repo } = req.body;

    if (!accessToken || !owner || !repo) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: accessToken, owner, repo'
      });
    }

    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Create webhook via GitHub API
    // Remove trailing slash from BACKEND_URL to prevent double-slash issues
    const backendUrl = (process.env.BACKEND_URL || 'https://your-backend.onrender.com').replace(/\/$/, '');
    const webhookUrl = `${backendUrl}/webhooks/github`;
    
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: project.webhookSecret,
          insecure_ssl: '0'
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[ProjectController] GitHub webhook creation failed:', errorData);
      
      // Check if webhook already exists
      if (response.status === 422 && errorData.errors?.some(e => e.message?.includes('already exists'))) {
        return res.status(200).json({
          success: true,
          message: 'Webhook already exists',
          webhookUrl
        });
      }

      return res.status(response.status).json({
        success: false,
        error: 'Failed to create GitHub webhook',
        details: errorData.message || 'Unknown error'
      });
    }

    const webhookData = await response.json();

    console.log(`[ProjectController] Webhook created for ${owner}/${repo}`);

    res.status(201).json({
      success: true,
      webhookId: webhookData.id,
      webhookUrl,
      message: 'Webhook created successfully'
    });
  } catch (error) {
    console.error('[ProjectController] Error setting up webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup webhook'
    });
  }
}

/**
 * Get project by ID
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function getProjectById(req, res) {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId).lean();
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Get associated report
    const report = await Report.findOne({ projectId: project._id })
      .select('title status metadata sections')
      .lean();

    res.status(200).json({
      success: true,
      project: {
        ...project,
        _id: project._id.toString()
      },
      report: report ? {
        ...report,
        _id: report._id.toString(),
        projectId: report.projectId.toString()
      } : null
    });
  } catch (error) {
    console.error('[ProjectController] Error fetching project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project'
    });
  }
}

/**
 * Delete a project and its associated report
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function deleteProject(req, res) {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Delete associated report
    await Report.deleteOne({ projectId: project._id });

    // Delete project
    await Project.deleteOne({ _id: project._id });

    console.log(`[ProjectController] Deleted project: ${project.name}`);

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('[ProjectController] Error deleting project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete project'
    });
  }
}

/**
 * Generate initial report based on last commit
 * Fetches the last commit from GitHub and processes it through the AI pipeline
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function generateInitialReport(req, res) {
  const { projectId } = req.params;
  const { accessToken, owner, repo } = req.body;

  console.log(`[InitialReport] Starting for project ${projectId}`);

  try {
    if (!accessToken || !owner || !repo) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: accessToken, owner, repo'
      });
    }

    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Get the template (from DB or fallback)
    const template = await findTemplate(project.activeTemplateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    // Find the report
    const report = await Report.findOne({ projectId: project._id });
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    // Fetch the last commit from GitHub
    console.log(`[InitialReport] Fetching last commit from ${owner}/${repo}`);
    
    const commitsResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (!commitsResponse.ok) {
      const errorData = await commitsResponse.json();
      console.error('[InitialReport] Failed to fetch commits:', errorData);
      return res.status(commitsResponse.status).json({
        success: false,
        error: 'Failed to fetch commits from GitHub',
        details: errorData.message
      });
    }

    const commits = await commitsResponse.json();
    
    if (!commits || commits.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No commits found in repository'
      });
    }

    const lastCommit = commits[0];
    console.log(`[InitialReport] Last commit: ${lastCommit.sha.substring(0, 7)} - ${lastCommit.commit.message}`);

    // Fetch the commit diff
    const diffResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${lastCommit.sha}`,
      {
        headers: {
          'Accept': 'application/vnd.github.diff',
          'Authorization': `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (!diffResponse.ok) {
      console.error('[InitialReport] Failed to fetch diff');
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch commit diff'
      });
    }

    const diff = await diffResponse.text();
    console.log(`[InitialReport] Diff length: ${diff.length} chars`);

    // Fetch files changed in the commit
    const commitDetailResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${lastCommit.sha}`,
      {
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    const commitDetail = await commitDetailResponse.json();
    const filesChanged = (commitDetail.files || []).map(f => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes
    }));

    console.log(`[InitialReport] Files changed: ${filesChanged.length}`);

    // Stage 1: Analyze the commit
    console.log('[InitialReport] Starting analysis...');
    
    const analysisResult = await analyze({
      commitHash: lastCommit.sha,
      commitMessage: lastCommit.commit.message,
      author: lastCommit.commit.author.name,
      diff: diff.substring(0, 50000), // Limit diff size
      filesChanged: filesChanged,
      projectContext: {
        name: project.name,
        techStack: project.settings?.techStack || []
      },
      templateSections: template.sections
    });

    console.log('[InitialReport] Analysis result:', {
      success: analysisResult.success,
      changeType: analysisResult.changeType,
      suggestedSections: analysisResult.suggestedSections?.length || 0
    });

    if (!analysisResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Analysis failed',
        details: analysisResult.error
      });
    }

    // Stage 2: Generate content for sections
    console.log('[InitialReport] Starting content generation...');
    
    const writerResults = await generateForAllSections({
      analysisResult,
      templateSections: template.sections,
      report,
      projectMetadata: {
        name: project.name,
        description: project.description || ''
      },
      commitInfo: {
        hash: lastCommit.sha,
        message: lastCommit.commit.message,
        author: lastCommit.commit.author.name
      }
    });

    console.log('[InitialReport] Writer results:', writerResults.map(r => ({
      sectionId: r.sectionId,
      success: r.success,
      contentLength: r.content?.length || 0
    })));

    // Update the report with generated content
    const successfulUpdates = [];
    const failedUpdates = [];

    for (const result of writerResults) {
      if (result.success && result.content) {
        // Find section in report
        const sectionIndex = report.sections.findIndex(
          s => s.templateSectionId === result.sectionId
        );
        
        if (sectionIndex !== -1) {
          report.sections[sectionIndex].content = result.content;
          report.sections[sectionIndex].lastUpdated = new Date();
          report.sections[sectionIndex].aiLastTouched = true;
          report.sections[sectionIndex].wordCount = result.content.split(/\s+/).filter(Boolean).length;
          report.sections[sectionIndex].contributions.push({
            commitHash: lastCommit.sha,
            addedAt: new Date(),
            contentPreview: result.content.substring(0, 100)
          });
          successfulUpdates.push(result);
        }
      } else {
        failedUpdates.push(result);
      }
    }

    // Save the report
    report.metadata.lastAIUpdate = new Date();
    report.updateWordCount();
    await report.save();

    // Log to AutoLog
    if (successfulUpdates.length > 0) {
      await autoLogger.logSuccess({
        projectId: project._id,
        reportId: report._id,
        commitHash: lastCommit.sha,
        commitMessage: lastCommit.commit.message,
        author: lastCommit.commit.author.name,
        result: {
          sectionTitle: successfulUpdates.map(u => u.sectionTitle).join(', '),
          sectionId: successfulUpdates[0].sectionId,
          content: successfulUpdates[0].content,
          wordCount: successfulUpdates.reduce((sum, u) => sum + (u.wordCount || 0), 0)
        },
        pipelineTrace: {
          type: 'initial_report',
          triggeredAt: new Date()
        },
        analysisResult: {
          changeType: analysisResult.changeType,
          impactLevel: analysisResult.impactLevel,
          semanticTags: analysisResult.semanticTags
        }
      });
    }

    console.log(`[InitialReport] Completed: ${successfulUpdates.length} sections updated`);

    res.status(200).json({
      success: true,
      message: 'Initial report generated successfully',
      stats: {
        sectionsUpdated: successfulUpdates.length,
        sectionsFailed: failedUpdates.length,
        commitProcessed: lastCommit.sha.substring(0, 7)
      }
    });

  } catch (error) {
    console.error('[InitialReport] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate initial report',
      details: error.message
    });
  }
}

/**
 * Regenerate a section's content using AI
 * Uses the last contribution's context to regenerate content
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function regenerateSection(req, res) {
  const { projectId, sectionId } = req.params;
  
  console.log(`[Regenerate] Starting for project ${projectId}, section ${sectionId}`);
  
  try {
    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    // Find the report
    const report = await Report.findOne({ projectId: project._id });
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }
    
    // Find the section
    const sectionIndex = report.sections.findIndex(
      s => s.templateSectionId === sectionId || s.id === sectionId
    );
    
    if (sectionIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }
    
    const section = report.sections[sectionIndex];
    
    // Get the template for section config
    const template = await findTemplate(project.activeTemplateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    const templateSection = template.sections.find(s => s.id === section.templateSectionId);
    if (!templateSection) {
      return res.status(404).json({
        success: false,
        error: 'Template section not found'
      });
    }
    
    // Save current content as previous version before regenerating
    if (section.content && section.content.trim()) {
      // Keep only last 5 versions
      if (!section.previousVersions) {
        section.previousVersions = [];
      }
      section.previousVersions.push({
        content: section.content,
        wordCount: section.wordCount || 0,
        savedAt: new Date(),
        reason: 'regenerate'
      });
      // Limit to 5 versions
      if (section.previousVersions.length > 5) {
        section.previousVersions = section.previousVersions.slice(-5);
      }
    }
    
    // Get context from section's previous contributions
    const lastContribution = section.contributions?.[section.contributions.length - 1];
    
    // Create a mock analysis result based on existing content context
    // For regeneration, we use the section's existing context
    const mockAnalysisResult = {
      changeType: 'feature',
      impactLevel: 'minor',
      semanticTags: templateSection.aiHints?.keywords || [],
      technicalSummary: `Regenerating content for the ${section.title} section based on existing contributions.`,
      entities: [],
      suggestedSections: [{ sectionId: section.templateSectionId, confidence: 1.0 }]
    };
    
    // Prepare target section with content history
    const targetSection = {
      ...templateSection,
      id: section.templateSectionId,
      existingContent: '', // Start fresh for regeneration
      contentHistory: section.contributions || []
    };
    
    // Generate new content
    const { generate } = require('../services/writerAgent');
    const result = await generate({
      analysisResult: mockAnalysisResult,
      targetSection,
      projectMetadata: {
        name: project.name,
        description: project.description || ''
      },
      commitInfo: {
        hash: lastContribution?.commitHash || 'regenerate',
        message: 'Content regeneration',
        author: 'System'
      }
    });
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to regenerate content',
        details: result.error
      });
    }
    
    // Update the section with new content
    report.sections[sectionIndex].content = result.content;
    report.sections[sectionIndex].wordCount = result.wordCount;
    report.sections[sectionIndex].lastUpdated = new Date();
    report.sections[sectionIndex].aiLastTouched = true;
    
    // Save the report
    report.metadata.lastAIUpdate = new Date();
    report.updateWordCount();
    await report.save();
    
    console.log(`[Regenerate] Successfully regenerated section "${section.title}"`);
    
    res.status(200).json({
      success: true,
      message: 'Section regenerated successfully',
      section: {
        id: section.id,
        templateSectionId: section.templateSectionId,
        title: section.title,
        content: result.content,
        wordCount: result.wordCount
      }
    });
    
  } catch (error) {
    console.error('[Regenerate] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate section',
      details: error.message
    });
  }
}

/**
 * Revert a section to its previous version
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function revertSection(req, res) {
  const { projectId, sectionId } = req.params;
  
  console.log(`[Revert] Starting for project ${projectId}, section ${sectionId}`);
  
  try {
    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    // Find the report
    const report = await Report.findOne({ projectId: project._id });
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }
    
    // Find the section
    const sectionIndex = report.sections.findIndex(
      s => s.templateSectionId === sectionId || s.id === sectionId
    );
    
    if (sectionIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }
    
    const section = report.sections[sectionIndex];
    
    // Check if there are previous versions to revert to
    if (!section.previousVersions || section.previousVersions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No previous version available to revert to'
      });
    }
    
    // Get the latest previous version and remove it from the array
    const previousVersions = [...section.previousVersions];
    const previousVersion = previousVersions.pop();
    
    // Update section with previous content and the updated versions array
    report.sections[sectionIndex].content = previousVersion.content;
    report.sections[sectionIndex].wordCount = previousVersion.wordCount;
    report.sections[sectionIndex].lastUpdated = new Date();
    report.sections[sectionIndex].aiLastTouched = false;
    report.sections[sectionIndex].previousVersions = previousVersions;
    
    // Mark the sections array as modified so Mongoose saves it
    report.markModified('sections');
    
    // Save the report
    report.updateWordCount();
    await report.save();
    
    console.log(`[Revert] Successfully reverted section "${section.title}"`);
    
    res.status(200).json({
      success: true,
      message: 'Section reverted successfully',
      section: {
        id: section.id,
        templateSectionId: section.templateSectionId,
        title: section.title,
        content: previousVersion.content,
        wordCount: previousVersion.wordCount
      },
      versionsRemaining: previousVersions.length
    });
    
  } catch (error) {
    console.error('[Revert] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revert section',
      details: error.message
    });
  }
}

/**
 * Accept a section's content (remove AI highlight, keep content revertable)
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function acceptSection(req, res) {
  const { projectId, sectionId } = req.params;
  
  console.log(`[Accept] Starting for project ${projectId}, section ${sectionId}`);
  
  try {
    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    // Find the report
    const report = await Report.findOne({ projectId: project._id });
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }
    
    // Find the section
    const sectionIndex = report.sections.findIndex(
      s => s.templateSectionId === sectionId || s.id === sectionId
    );
    
    if (sectionIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Section not found'
      });
    }
    
    const section = report.sections[sectionIndex];
    
    // Save current content as previous version before accepting (so it can be reverted)
    if (section.content && section.content.trim()) {
      if (!section.previousVersions) {
        section.previousVersions = [];
      }
      section.previousVersions.push({
        content: section.content,
        wordCount: section.wordCount || 0,
        savedAt: new Date(),
        reason: 'manual' // Accepted by user
      });
      // Keep only last 5 versions
      if (section.previousVersions.length > 5) {
        section.previousVersions = section.previousVersions.slice(-5);
      }
    }
    
    // Remove AI highlight flag (accept the content)
    report.sections[sectionIndex].aiLastTouched = false;
    report.sections[sectionIndex].lastUpdated = new Date();
    
    // Save the report
    await report.save();
    
    console.log(`[Accept] Successfully accepted section "${section.title}"`);
    
    res.status(200).json({
      success: true,
      message: 'Section accepted successfully',
      section: {
        id: section.id,
        templateSectionId: section.templateSectionId,
        title: section.title,
        aiLastTouched: false
      }
    });
    
  } catch (error) {
    console.error('[Accept] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept section',
      details: error.message
    });
  }
}

/**
 * Accept all sections with AI changes
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function acceptAllSections(req, res) {
  const { projectId } = req.params;
  
  console.log(`[AcceptAll] Starting for project ${projectId}`);
  
  try {
    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    // Find the report
    const report = await Report.findOne({ projectId: project._id });
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }
    
    // Find all sections with AI changes
    const acceptedSections = [];
    
    for (let i = 0; i < report.sections.length; i++) {
      const section = report.sections[i];
      
      if (section.aiLastTouched) {
        // Save current content as previous version
        if (section.content && section.content.trim()) {
          if (!section.previousVersions) {
            section.previousVersions = [];
          }
          section.previousVersions.push({
            content: section.content,
            wordCount: section.wordCount || 0,
            savedAt: new Date(),
            reason: 'manual'
          });
          if (section.previousVersions.length > 5) {
            section.previousVersions = section.previousVersions.slice(-5);
          }
        }
        
        // Accept the section
        report.sections[i].aiLastTouched = false;
        report.sections[i].lastUpdated = new Date();
        
        acceptedSections.push({
          id: section.id,
          templateSectionId: section.templateSectionId,
          title: section.title
        });
      }
    }
    
    // Save the report
    await report.save();
    
    console.log(`[AcceptAll] Successfully accepted ${acceptedSections.length} sections`);
    
    res.status(200).json({
      success: true,
      message: `${acceptedSections.length} sections accepted successfully`,
      acceptedSections
    });
    
  } catch (error) {
    console.error('[AcceptAll] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to accept all sections',
      details: error.message
    });
  }
}

module.exports = {
  getTemplates,
  createProject,
  setupWebhook,
  getProjectById,
  deleteProject,
  generateInitialReport,
  regenerateSection,
  revertSection,
  acceptSection,
  acceptAllSections
};
