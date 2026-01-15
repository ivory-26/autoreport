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
    const webhookUrl = `${process.env.BACKEND_URL || 'https://your-backend.onrender.com'}/webhooks/github`;
    
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

module.exports = {
  getTemplates,
  createProject,
  setupWebhook,
  getProjectById,
  deleteProject
};
