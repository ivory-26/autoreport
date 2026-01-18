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
const { webhookQueue, JOB_STATUS } = require('../services/queue');
const { processWebhookPayload } = require('../services/gitParser');
const { analyze } = require('../services/analyzerAgent');
const { generateForAllSections } = require('../services/writerAgent');
const { autoLogger, STAGES } = require('../services/autoLogger');
const { getGroqKeyPool } = require('../utils/aiConfig');

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
    }).select('+webhookSecret');

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
    if (await webhookQueue.isCommitQueued(processedPayload.commit.hash)) {
      return res.status(200).json({ 
        message: 'Commit already queued',
        commitHash: processedPayload.commit.shortHash
      });
    }

    // Enqueue the job
    const jobId = await webhookQueue.enqueue({
      type: 'webhook',
      userId: project.owner, // For Fair Queueing
      projectId: project._id,
      project: {
        name: project.name,
        templateId: project.activeTemplateId,
        settings: project.settings
      },
      ...processedPayload,
      receivedAt,
      deliveryId
    });

    // Respond immediately (async processing)
    res.status(202).json({
      message: 'Webhook received',
      jobId,
      commitHash: processedPayload.commit.shortHash,
      queuePosition: await webhookQueue.getLength(),
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

  // Helper to determine author's role in the project
  const getAuthorInfo = async (authorName, authorEmail) => {
    try {
      // Fetch the full project document to check collaborators
      const fullProject = await Project.findById(projectId).lean();
      if (!fullProject) {
        return { username: authorName, role: 'external', isCollaborator: false };
      }

      // Check if author is the owner
      if (fullProject.ownerUsername?.toLowerCase() === authorName?.toLowerCase()) {
        return { 
          username: authorName, 
          email: authorEmail,
          role: 'owner', 
          isCollaborator: true,
          avatarUrl: `https://github.com/${authorName}.png`
        };
      }

      // Check if author is a collaborator
      const collaborator = fullProject.collaborators?.find(
        c => c.username?.toLowerCase() === authorName?.toLowerCase() ||
             c.email?.toLowerCase() === authorEmail?.toLowerCase()
      );

      if (collaborator) {
        return {
          username: collaborator.username || authorName,
          email: collaborator.email || authorEmail,
          role: collaborator.role || 'editor',
          isCollaborator: true,
          avatarUrl: `https://github.com/${collaborator.username}.png`
        };
      }

      // External contributor
      return { 
        username: authorName, 
        email: authorEmail,
        role: 'external', 
        isCollaborator: false 
      };
    } catch (error) {
      console.error('[Pipeline] Error getting author info:', error.message);
      return { username: authorName, role: 'external', isCollaborator: false };
    }
  };

  // Get author information for tracking
  const authorInfo = await getAuthorInfo(commit.author, commit.authorEmail);
  console.log(`[Pipeline] Processing commit by ${authorInfo.username} (${authorInfo.role})`);

  try {
    await webhookQueue.sendProgress(job.id, {
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

    await webhookQueue.sendProgress(job.id, {
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
      onProgress: async (progress) => {
        await webhookQueue.sendProgress(job.id, progress);
      },
      jobId: job.id // Pass job ID for consistent key usage
    });

    console.log('[Pipeline] Analysis result:', JSON.stringify({
      success: analysisResult.success,
      changeType: analysisResult.changeType,
      suggestedSections: analysisResult.suggestedSections?.length || 0,
      error: analysisResult.error
    }));

    pipelineTrace.analysisCompleted = new Date();
    pipelineTrace.writingStarted = new Date();

    await webhookQueue.sendProgress(job.id, {
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
      },
      authorInfo, // Pass role/collaborator context
      jobId: job.id // Pass job ID for consistent key usage
    });

    console.log('[Pipeline] Writer results:', writerResults.map(r => ({
      sectionId: r.sectionId,
      success: r.success,
      contentLength: r.content?.length || 0,
      error: r.error
    })));

    pipelineTrace.writingCompleted = new Date();

    await webhookQueue.sendProgress(job.id, {
      stage: 'saving',
      message: 'Saving updates to database'
    });

    // Refetch the report right before saving to minimize VersionError (concurrency issues)
    // AI generation can take minutes, and the report may have changed during that time.
    let refreshedReport = await Report.findById(report._id);
    if (!refreshedReport) {
      refreshedReport = report; // Fallback if somehow deleted
    }

    // Update the report with generated content
    const successfulUpdates = [];
    const failedUpdates = [];

    for (const result of writerResults) {
      if (result.success && result.content) {
        // Find or create section in report
        let section = refreshedReport.sections.find(s => s.templateSectionId === result.sectionId);
        
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
          refreshedReport.sections.push(section);
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

    // Save the report with retry logic for VersionError
    let saveAttempts = 0;
    const maxSaveAttempts = 3;
    let saved = false;

    while (saveAttempts < maxSaveAttempts && !saved) {
      try {
        refreshedReport.metadata.lastAIUpdate = new Date();
        refreshedReport.updateWordCount();
        await refreshedReport.save();
        saved = true;
      } catch (saveError) {
        saveAttempts++;
        if (saveError.name === 'VersionError' && saveAttempts < maxSaveAttempts) {
          console.warn(`[Webhook] VersionError on save attempt ${saveAttempts} for report ${refreshedReport._id}. Refetching and retrying...`);
          // Fetch the latest version from DB
          const latestReport = await Report.findById(refreshedReport._id);
          if (!latestReport) throw saveError;

          // Merge the AI changes into the latest version
          for (const result of successfulUpdates) {
             let latestSection = latestReport.sections.find(s => s.templateSectionId === result.sectionId);
             if (latestSection) {
                // If section was updated since we last looked, we append to the NEW content
                // This is safe because we are just appending
                if (result.insertPosition === 'prepend') {
                  latestSection.content = result.content + '\n\n' + latestSection.content;
                } else {
                  latestSection.content = latestSection.content + '\n\n' + result.content;
                }
                latestSection.lastUpdated = new Date();
                latestSection.aiLastTouched = true;
                latestSection.wordCount = latestSection.content.split(/\s+/).filter(Boolean).length;
                latestSection.contributions.push({
                  commitHash: commit.hash,
                  addedAt: new Date(),
                  contentPreview: result.content.substring(0, 100)
                });
             } else {
                // Should not happen as sections are template-driven, but handle anyway
                latestReport.sections.push(refreshedReport.sections.find(s => s.templateSectionId === result.sectionId));
             }
          }
          refreshedReport = latestReport;
          // Exponential backoff before retry
          await new Promise(resolve => setTimeout(resolve, 500 * saveAttempts));
        } else {
          throw saveError;
        }
      }
    }

    pipelineTrace.savedAt = new Date();

    // Log to AutoLog
    if (successfulUpdates.length > 0) {
      const primaryUpdate = successfulUpdates[0];
      
      if (failedUpdates.length > 0) {
        // Partial success
        await autoLogger.logPartial({
          projectId,
          reportId: refreshedReport._id,
          commitHash: commit.hash,
          commitMessage: commit.message,
          author: commit.author,
          authorInfo,
          successes: successfulUpdates,
          failures: failedUpdates,
          pipelineTrace,
          deliveryId
        });
      } else {
        // Full success
        await autoLogger.logSuccess({
          projectId,
          reportId: refreshedReport._id,
          commitHash: commit.hash,
          commitMessage: commit.message,
          author: commit.author,
          authorInfo,
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

    // If job was aborted, don't mark as error in logs or re-throw for retry
    if (await webhookQueue.isJobAborted(job.id)) {
      console.log(`[Webhook] Job ${job.id.substring(0, 8)} cleanup completed after abortion.`);
      return;
    }

    // Log error to AutoLog
    await autoLogger.logError({
      projectId,
      commitHash: commit.hash,
      commitMessage: commit.message,
      author: commit.author,
      authorInfo,
      stage: determineErrorStage(error, pipelineTrace),
      error,
      pipelineTrace,
      deliveryId
    });

    throw error; // Re-throw for queue retry logic
  } finally {
    // Release key assignment
    const pool = getGroqKeyPool();
    if (pool && job.id) {
      pool.releaseJobKey(job.id);
    }
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
async function getQueueStatus(req, res) {
  res.json(await webhookQueue.getStatus());
}

/**
 * Health check for webhook endpoint
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function healthCheck(req, res) {
  res.json({
    status: 'ok',
    queue: {
      length: await webhookQueue.getLength(),
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
