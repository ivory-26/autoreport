/**
 * Webhook Controller
 * 
 * Handles GitHub webhook requests, validates signatures,
 * and orchestrates the processing pipeline.
 */

const crypto = require('crypto');
const Project = require('../models/Project');
const Report = require('../models/Report');
const Template = require('../models/Template');
const { webhookQueue } = require('../services/queue');
const { processWebhookPayload } = require('../services/gitParser');
const { analyze } = require('../services/analyzerAgent');
const { generateForAllSections } = require('../services/writerAgent');
const { autoLogger, STAGES } = require('../services/autoLogger');

/**
 * Verify GitHub webhook signature
 * @param {Buffer} payload - Raw request body
 * @param {string} signature - X-Hub-Signature-256 header
 * @param {string} secret - Webhook secret
 * @returns {boolean} - True if signature is valid
 */
function verifyGitHubSignature(payload, signature, secret) {
  if (!signature || !secret) {
    console.warn('[Webhook] Missing signature or secret');
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Handle incoming GitHub webhook
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function handleGitHubWebhook(req, res) {
  const receivedAt = new Date();
  const event = req.headers['x-github-event'];
  const signature = req.headers['x-hub-signature-256'];
  const deliveryId = req.headers['x-github-delivery'];

  console.log(`[Webhook] Received ${event} event (delivery: ${deliveryId?.substring(0, 8)})`);

  // Only process push events
  if (event !== 'push') {
    console.log(`[Webhook] Ignoring ${event} event`);
    return res.status(200).json({ 
      message: 'Event ignored',
      event 
    });
  }

  try {
    const payload = req.body;
    const rawBody = req.rawBody; // From express.json middleware

    // Extract repository info
    const repoFullName = payload.repository?.full_name;
    if (!repoFullName) {
      return res.status(400).json({ error: 'Invalid payload: missing repository info' });
    }

    // Find the project
    const project = await Project.findOne({ 
      repoFullName,
      status: 'active'
    });

    if (!project) {
      console.log(`[Webhook] Project not found for ${repoFullName}`);
      return res.status(404).json({ 
        error: 'Project not found',
        repo: repoFullName 
      });
    }

    // Verify signature if project has a webhook secret or env secret is set
    const secret = project.webhookSecret || process.env.GITHUB_WEBHOOK_SECRET;
    if (secret) {
      const isValid = verifyGitHubSignature(rawBody, signature, secret);
      if (!isValid) {
        console.warn(`[Webhook] Invalid signature for ${repoFullName}`);
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // Process the payload
    const processedPayload = processWebhookPayload(payload);

    if (!processedPayload.valid) {
      // Log skipped commit
      if (processedPayload.skipped) {
        await autoLogger.logSkipped({
          projectId: project._id,
          commitHash: payload.head_commit?.id || 'unknown',
          commitMessage: payload.head_commit?.message,
          author: payload.head_commit?.author?.name,
          reason: processedPayload.reason,
          ignoredFiles: processedPayload.ignoredFiles,
          deliveryId
        });
      }

      return res.status(200).json({ 
        message: processedPayload.reason,
        skipped: true
      });
    }

    // Check if commit is already in queue
    if (webhookQueue.isCommitQueued(processedPayload.commit.hash)) {
      return res.status(200).json({ 
        message: 'Commit already queued',
        commitHash: processedPayload.commit.shortHash
      });
    }

    // Enqueue the job
    const jobId = webhookQueue.enqueue({
      type: 'webhook',
      projectId: project._id,
      project: {
        name: project.name,
        templateId: project.activeTemplateId,
        settings: project.settings
      },
      ...processedPayload,
      ...processedPayload,
      receivedAt,
      deliveryId
    });

    // Respond immediately (async processing)
    res.status(202).json({
      message: 'Webhook received',
      jobId,
      commitHash: processedPayload.commit.shortHash,
      queuePosition: webhookQueue.length,
      progressUrl: `/api/progress/${jobId}`,
      streamUrl: `/api/progress/${jobId}/stream`
    });

  } catch (error) {
    console.error('[Webhook] Error handling webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Process a queued webhook job
 * This is the main processing pipeline
 * @param {Object} job - Queue job
 */
async function processWebhookJob(job) {
  const { data } = job;
  const { projectId, project, commit, files, diff, summary, deliveryId } = data;

  const pipelineTrace = {
    ...job.pipelineTrace,
    analysisStarted: new Date()
  };

  try {
    webhookQueue.sendProgress(job.id, {
      stage: 'starting',
      message: 'Processing webhook payload'
    });

    // Get the template
    const template = await Template.findOne({ templateId: project.templateId });
    if (!template) {
      throw new Error(`Template not found: ${project.templateId}`);
    }

    // Get or create the report
    let report = await Report.findOne({ projectId });
    if (!report) {
      // Create a new report based on template
      report = await createReportFromTemplate(projectId, template, project.name);
    }

    webhookQueue.sendProgress(job.id, {
      stage: 'analyzing',
      message: `Analyzing commit ${commit.hash?.substring(0, 7)}`
    });

    // Stage 1: Analyze the diff
    console.log('[Pipeline] Starting analysis for commit:', commit.hash?.substring(0, 7));
    console.log('[Pipeline] Diff length:', diff?.length || 0, 'chars');
    console.log('[Pipeline] Files changed:', summary?.relevantFiles?.length || 0);
    
    const analysisResult = await analyze({
      commitHash: commit.hash,
      commitMessage: commit.message,
      author: commit.author,
      diff: diff,
      filesChanged: summary.relevantFiles,
      projectContext: {
        name: project.name,
        techStack: project.settings?.techStack || []
      },
      templateSections: template.sections,
      onProgress: (progress) => {
        webhookQueue.sendProgress(job.id, progress);
      }
    });

    console.log('[Pipeline] Analysis result:', JSON.stringify({
      success: analysisResult.success,
      changeType: analysisResult.changeType,
      suggestedSections: analysisResult.suggestedSections?.length || 0,
      error: analysisResult.error
    }));

    pipelineTrace.analysisCompleted = new Date();
    pipelineTrace.writingStarted = new Date();

    webhookQueue.sendProgress(job.id, {
      stage: 'writing',
      message: 'Generating content for report sections'
    });

    // Stage 2: Generate content for relevant sections
    console.log('[Pipeline] Starting writer for sections...');
    
    const writerResults = await generateForAllSections({
      analysisResult,
      templateSections: template.sections,
      report,
      projectMetadata: {
        name: project.name,
        description: project.description || ''
      },
      commitInfo: {
        hash: commit.hash,
        message: commit.message,
        author: commit.author
      }
    });

    console.log('[Pipeline] Writer results:', writerResults.map(r => ({
      sectionId: r.sectionId,
      success: r.success,
      contentLength: r.content?.length || 0,
      error: r.error
    })));

    pipelineTrace.writingCompleted = new Date();

    webhookQueue.sendProgress(job.id, {
      stage: 'saving',
      message: 'Saving updates to database'
    });

    // Update the report with generated content
    const successfulUpdates = [];
    const failedUpdates = [];

    for (const result of writerResults) {
      if (result.success && result.content) {
        // Find or create section in report
        let section = report.sections.find(s => s.templateSectionId === result.sectionId);
        
        if (!section) {
          // Add new section
          const templateSection = template.sections.find(s => s.id === result.sectionId);
          section = {
            id: crypto.randomUUID(),
            templateSectionId: result.sectionId,
            title: templateSection?.title || result.sectionTitle,
            number: templateSection?.number || '',
            content: '',
            lastUpdated: new Date(),
            aiLastTouched: true,
            wordCount: 0,
            contributions: [],
            previousVersions: []
          };
          report.sections.push(section);
        }

        // Save current content as previous version before updating (for revert functionality)
        if (section.content && section.content.trim()) {
          if (!section.previousVersions) {
            section.previousVersions = [];
          }
          section.previousVersions.push({
            content: section.content,
            wordCount: section.wordCount || 0,
            savedAt: new Date(),
            reason: 'ai_update'
          });
          // Keep only last 5 versions
          if (section.previousVersions.length > 5) {
            section.previousVersions = section.previousVersions.slice(-5);
          }
        }

        // Append or prepend content
        if (result.insertPosition === 'prepend') {
          section.content = result.content + '\n\n' + section.content;
        } else {
          section.content = section.content 
            ? section.content + '\n\n' + result.content
            : result.content;
        }

        section.lastUpdated = new Date();
        section.aiLastTouched = true;
        section.wordCount = section.content.split(/\s+/).filter(Boolean).length;
        section.contributions.push({
          commitHash: commit.hash,
          addedAt: new Date(),
          contentPreview: result.content.substring(0, 100)
        });

        successfulUpdates.push(result);
      } else {
        failedUpdates.push(result);
      }
    }

    // Save the report
    report.metadata.lastAIUpdate = new Date();
    report.updateWordCount();
    await report.save();

    pipelineTrace.savedAt = new Date();

    // Log to AutoLog
    if (successfulUpdates.length > 0) {
      const primaryUpdate = successfulUpdates[0];
      
      if (failedUpdates.length > 0) {
        // Partial success
        await autoLogger.logPartial({
          projectId,
          reportId: report._id,
          commitHash: commit.hash,
          commitMessage: commit.message,
          author: commit.author,
          successes: successfulUpdates,
          failures: failedUpdates,
          pipelineTrace,
          deliveryId
        });
      } else {
        // Full success
        await autoLogger.logSuccess({
          projectId,
          reportId: report._id,
          commitHash: commit.hash,
          commitMessage: commit.message,
          author: commit.author,
          result: {
            sectionTitle: successfulUpdates.map(u => u.sectionTitle).join(', '),
            sectionId: primaryUpdate.sectionId,
            content: primaryUpdate.content,
            wordCount: successfulUpdates.reduce((sum, u) => sum + (u.wordCount || 0), 0)
          },
          pipelineTrace,
          deliveryId,
          analysisResult: {
            changeType: analysisResult.changeType,
            impactLevel: analysisResult.impactLevel,
            semanticTags: analysisResult.semanticTags,
            entities: analysisResult.entities
          }
        });
      }
    } else {
      // All failed
      throw new Error('No sections were successfully updated');
    }

    console.log(`[Webhook] Processed commit ${commit.shortHash}: ${successfulUpdates.length} sections updated`);

  } catch (error) {
    // Log error to AutoLog
    await autoLogger.logError({
      projectId,
      commitHash: commit.hash,
      commitMessage: commit.message,
      author: commit.author,
      stage: determineErrorStage(error, pipelineTrace),
      error,
      pipelineTrace,
      deliveryId
    });

    throw error; // Re-throw for queue retry logic
  }
}

/**
 * Create a new report from a template
 * @param {ObjectId} projectId - Project ID
 * @param {Object} template - Template document
 * @param {string} projectName - Project name
 * @returns {Promise<Object>} - Created report
 */
async function createReportFromTemplate(projectId, template, projectName) {
  const sections = template.sections.map(s => ({
    id: crypto.randomUUID(),
    templateSectionId: s.id,
    title: s.title,
    number: s.number,
    content: '',
    lastUpdated: new Date(),
    aiLastTouched: false,
    wordCount: 0,
    contributions: []
  }));

  const report = await Report.create({
    projectId,
    templateId: template.templateId,
    title: `${projectName} Report`,
    status: 'draft',
    sections,
    metadata: {
      totalWordCount: 0,
      version: 1
    }
  });

  console.log(`[Webhook] Created new report for project ${projectId}`);
  return report;
}

/**
 * Determine which stage an error occurred in
 * @param {Error} error - The error
 * @param {Object} pipelineTrace - Pipeline trace
 * @returns {string} - Stage name
 */
function determineErrorStage(error, pipelineTrace) {
  if (!pipelineTrace.analysisStarted) return STAGES.WEBHOOK;
  if (!pipelineTrace.analysisCompleted) return STAGES.ANALYZER;
  if (!pipelineTrace.writingCompleted) return STAGES.WRITER;
  return STAGES.DATABASE;
}

/**
 * Get queue status (for monitoring)
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
function getQueueStatus(req, res) {
  res.json(webhookQueue.getStatus());
}

/**
 * Health check for webhook endpoint
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
function healthCheck(req, res) {
  res.json({
    status: 'ok',
    queue: {
      length: webhookQueue.length,
      processing: webhookQueue.processing
    },
    timestamp: new Date()
  });
}

// Set the processor for the queue - REMOVED (Handled in app.js)
// webhookQueue.setProcessor(processWebhookJob);

module.exports = {
  handleGitHubWebhook,
  processWebhookJob,
  getQueueStatus,
  healthCheck,
  verifyGitHubSignature,
  createReportFromTemplate
};
