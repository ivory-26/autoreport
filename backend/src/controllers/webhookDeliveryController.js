/**
 * Webhook Delivery Verification Controller
 * 
 * Handles verification of webhook delivery and redelivery requests
 * to ensure commits are properly processed after push events.
 */

const Project = require('../models/Project');
const AutoLog = require('../models/AutoLog');
const Report = require('../models/Report');

/**
 * Check if a specific commit was processed successfully
 * @param {string} projectId - Project ID
 * @param {string} commitHash - Commit hash to check
 * @returns {Promise<Object>} - Processing status
 */
async function checkCommitProcessingStatus(projectId, commitHash) {
  // Check AutoLog for this commit
  const log = await AutoLog.findOne({
    projectId,
    commitHash: { $regex: new RegExp(`^${commitHash}`, 'i') }
  }).sort({ createdAt: -1 });

  if (!log) {
    return {
      processed: false,
      status: 'not_found',
      message: 'No processing record found for this commit'
    };
  }

  // Check if processing was successful
  if (log.status === 'success') {
    return {
      processed: true,
      status: 'success',
      sectionUpdated: log.addedToSection,
      wordCount: log.wordCount,
      processedAt: log.createdAt,
      deliveryId: log.deliveryId,
      message: 'Commit was processed successfully'
    };
  }

  if (log.status === 'partial') {
    return {
      processed: true,
      status: 'partial',
      message: 'Commit was partially processed',
      processedAt: log.createdAt,
      deliveryId: log.deliveryId
    };
  }

  if (log.status === 'pending') {
    return {
      processed: false,
      status: 'pending',
      message: 'Commit is currently being processed',
      queuedAt: log.createdAt,
      deliveryId: log.deliveryId
    };
  }

  if (log.status === 'skipped') {
    return {
      processed: true,
      status: 'skipped',
      message: log.error?.message || 'Commit was skipped',
      processedAt: log.createdAt,
      deliveryId: log.deliveryId
    };
  }

  // Failed status
  return {
    processed: false,
    status: 'failed',
    error: log.error?.message,
    retryable: log.error?.retryable,
    processedAt: log.createdAt,
    deliveryId: log.deliveryId,
    message: 'Commit processing failed'
  };
}

/**
 * Verify webhook delivery status for a project
 * Checks if the latest commit was processed and gets webhook delivery info
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function verifyWebhookDelivery(req, res) {
  const { projectId } = req.params;
  const { accessToken, commitHash } = req.body;

  console.log(`[WebhookDelivery] Verifying delivery for project ${projectId}, commit ${commitHash?.substring(0, 7) || 'latest'}`);

  try {
    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    // Parse repo info from repoFullName (owner/repo)
    const [owner, repo] = project.repoFullName.split('/');

    let targetCommitHash = commitHash;

    // If no specific commit provided, get the latest commit from GitHub
    if (!targetCommitHash && accessToken) {
      try {
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

        if (commitsResponse.ok) {
          const commits = await commitsResponse.json();
          if (commits && commits.length > 0) {
            targetCommitHash = commits[0].sha;
          }
        }
      } catch (err) {
        console.warn('[WebhookDelivery] Failed to fetch latest commit:', err.message);
      }
    }

    if (!targetCommitHash) {
      return res.status(400).json({
        success: false,
        error: 'Could not determine commit to verify. Provide commitHash or accessToken.'
      });
    }

    // Check processing status
    const processingStatus = await checkCommitProcessingStatus(project._id, targetCommitHash);

    // Get report status to see if content was generated
    const report = await Report.findOne({ projectId: project._id });
    const reportHasContent = report?.sections?.some(s => s.content && s.content.trim().length > 0);

    // Get webhook delivery status from GitHub (if accessToken provided)
    let webhookDeliveryInfo = null;
    if (accessToken) {
      try {
        // First, get the webhook ID
        const hooksResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/hooks`,
          {
            headers: {
              'Accept': 'application/vnd.github+json',
              'Authorization': `Bearer ${accessToken}`,
              'X-GitHub-Api-Version': '2022-11-28'
            }
          }
        );

        if (hooksResponse.ok) {
          const hooks = await hooksResponse.json();
          const backendUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '');
          const ourHook = hooks.find(h => h.config?.url?.includes(backendUrl) || h.config?.url?.includes('webhooks/github'));

          if (ourHook) {
            // Get recent deliveries for this webhook
            const deliveriesResponse = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/hooks/${ourHook.id}/deliveries?per_page=5`,
              {
                headers: {
                  'Accept': 'application/vnd.github+json',
                  'Authorization': `Bearer ${accessToken}`,
                  'X-GitHub-Api-Version': '2022-11-28'
                }
              }
            );

            if (deliveriesResponse.ok) {
              const deliveries = await deliveriesResponse.json();
              
              // Find delivery for our commit
              const commitDelivery = deliveries.find(d => {
                // Deliveries contain the payload, check for matching commit
                return d.event === 'push';
              });

              if (commitDelivery) {
                webhookDeliveryInfo = {
                  id: commitDelivery.id,
                  deliveredAt: commitDelivery.delivered_at,
                  redelivery: commitDelivery.redelivery,
                  status: commitDelivery.status,
                  statusCode: commitDelivery.status_code,
                  hookId: ourHook.id
                };
              }

              // Get most recent delivery info
              if (deliveries.length > 0) {
                webhookDeliveryInfo = {
                  ...webhookDeliveryInfo,
                  lastDelivery: {
                    id: deliveries[0].id,
                    deliveredAt: deliveries[0].delivered_at,
                    status: deliveries[0].status,
                    statusCode: deliveries[0].status_code
                  },
                  hookId: ourHook.id,
                  totalRecentDeliveries: deliveries.length
                };
              }
            }
          }
        }
      } catch (err) {
        console.warn('[WebhookDelivery] Failed to fetch webhook deliveries:', err.message);
      }
    }

    // Determine if redelivery is needed
    const needsRedelivery = !processingStatus.processed && 
                           processingStatus.status !== 'pending' &&
                           processingStatus.status !== 'skipped';

    res.status(200).json({
      success: true,
      commitHash: targetCommitHash,
      shortHash: targetCommitHash.substring(0, 7),
      processingStatus,
      reportHasContent,
      webhookDelivery: webhookDeliveryInfo,
      needsRedelivery,
      redeliverySupported: !!webhookDeliveryInfo?.hookId
    });

  } catch (error) {
    console.error('[WebhookDelivery] Error verifying delivery:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify webhook delivery',
      details: error.message
    });
  }
}

/**
 * Request redelivery of a webhook from GitHub
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function requestWebhookRedelivery(req, res) {
  const { projectId } = req.params;
  const { accessToken, deliveryId, hookId } = req.body;

  console.log(`[WebhookDelivery] Requesting redelivery for project ${projectId}, delivery ${deliveryId}`);

  try {
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'GitHub access token is required'
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

    // Parse repo info
    const [owner, repo] = project.repoFullName.split('/');

    let webhookId = hookId;

    // If no hookId provided, find the webhook
    if (!webhookId) {
      const hooksResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/hooks`,
        {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${accessToken}`,
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      if (!hooksResponse.ok) {
        return res.status(hooksResponse.status).json({
          success: false,
          error: 'Failed to fetch webhooks from GitHub'
        });
      }

      const hooks = await hooksResponse.json();
      const backendUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '');
      const ourHook = hooks.find(h => h.config?.url?.includes(backendUrl) || h.config?.url?.includes('webhooks/github'));

      if (!ourHook) {
        return res.status(404).json({
          success: false,
          error: 'AutoReport webhook not found on repository'
        });
      }

      webhookId = ourHook.id;
    }

    let targetDeliveryId = deliveryId;

    // If no delivery ID, get the most recent one
    if (!targetDeliveryId) {
      const deliveriesResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/hooks/${webhookId}/deliveries?per_page=1`,
        {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${accessToken}`,
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      if (!deliveriesResponse.ok) {
        return res.status(deliveriesResponse.status).json({
          success: false,
          error: 'Failed to fetch webhook deliveries'
        });
      }

      const deliveries = await deliveriesResponse.json();
      if (deliveries.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No webhook deliveries found to redeliver'
        });
      }

      targetDeliveryId = deliveries[0].id;
    }

    // Request redelivery
    const redeliveryResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/hooks/${webhookId}/deliveries/${targetDeliveryId}/attempts`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${accessToken}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (!redeliveryResponse.ok) {
      const errorData = await redeliveryResponse.json();
      console.error('[WebhookDelivery] Redelivery request failed:', errorData);
      return res.status(redeliveryResponse.status).json({
        success: false,
        error: 'Failed to request webhook redelivery',
        details: errorData.message
      });
    }

    console.log(`[WebhookDelivery] Redelivery requested successfully for delivery ${targetDeliveryId}`);

    res.status(202).json({
      success: true,
      message: 'Webhook redelivery requested successfully',
      deliveryId: targetDeliveryId,
      hookId: webhookId
    });

  } catch (error) {
    console.error('[WebhookDelivery] Error requesting redelivery:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to request webhook redelivery',
      details: error.message
    });
  }
}

/**
 * Check and auto-request redelivery if needed (combined endpoint)
 * This endpoint verifies delivery status and automatically requests redelivery if needed
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 */
async function verifyAndRedeliverIfNeeded(req, res) {
  const { projectId } = req.params;
  const { accessToken, commitHash, autoRedeliver = true, maxWaitTime = 30000 } = req.body;

  console.log(`[WebhookDelivery] Auto-verify for project ${projectId}, commit ${commitHash?.substring(0, 7) || 'latest'}`);

  try {
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: 'GitHub access token is required'
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

    const [owner, repo] = project.repoFullName.split('/');

    // Get the target commit
    let targetCommitHash = commitHash;
    let commitInfo = null;

    if (!targetCommitHash) {
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
        return res.status(commitsResponse.status).json({
          success: false,
          error: 'Failed to fetch latest commit from GitHub'
        });
      }

      const commits = await commitsResponse.json();
      if (!commits || commits.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No commits found in repository'
        });
      }

      targetCommitHash = commits[0].sha;
      commitInfo = {
        hash: commits[0].sha,
        shortHash: commits[0].sha.substring(0, 7),
        message: commits[0].commit?.message,
        author: commits[0].commit?.author?.name,
        date: commits[0].commit?.author?.date
      };
    }

    // Initial check
    let processingStatus = await checkCommitProcessingStatus(project._id, targetCommitHash);

    // If already processed successfully, return immediately
    if (processingStatus.processed && processingStatus.status !== 'failed') {
      return res.status(200).json({
        success: true,
        action: 'none',
        message: 'Commit already processed',
        commitHash: targetCommitHash,
        commitInfo,
        processingStatus,
        redeliveryPerformed: false
      });
    }

    // If pending, wait a bit and check again
    if (processingStatus.status === 'pending') {
      const startTime = Date.now();
      const pollInterval = 2000; // 2 seconds
      
      while (Date.now() - startTime < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        processingStatus = await checkCommitProcessingStatus(project._id, targetCommitHash);
        
        if (processingStatus.processed && processingStatus.status !== 'pending') {
          break;
        }
      }

      if (processingStatus.processed && processingStatus.status !== 'failed') {
        return res.status(200).json({
          success: true,
          action: 'waited',
          message: 'Commit processing completed after waiting',
          commitHash: targetCommitHash,
          commitInfo,
          processingStatus,
          redeliveryPerformed: false,
          waitedMs: Date.now() - startTime
        });
      }
    }

    // If not processed and auto-redeliver is enabled, request redelivery
    if (!processingStatus.processed && autoRedeliver) {
      // Find webhook and request redelivery
      const hooksResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/hooks`,
        {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${accessToken}`,
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      if (!hooksResponse.ok) {
        return res.status(200).json({
          success: false,
          action: 'redelivery_failed',
          message: 'Could not access webhooks to request redelivery',
          commitHash: targetCommitHash,
          commitInfo,
          processingStatus,
          redeliveryPerformed: false
        });
      }

      const hooks = await hooksResponse.json();
      const backendUrl = (process.env.BACKEND_URL || '').replace(/\/$/, '');
      const ourHook = hooks.find(h => h.config?.url?.includes(backendUrl) || h.config?.url?.includes('webhooks/github'));

      if (!ourHook) {
        return res.status(200).json({
          success: false,
          action: 'no_webhook',
          message: 'AutoReport webhook not found on repository',
          commitHash: targetCommitHash,
          commitInfo,
          processingStatus,
          redeliveryPerformed: false
        });
      }

      // Get recent deliveries
      const deliveriesResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/hooks/${ourHook.id}/deliveries?per_page=5`,
        {
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${accessToken}`,
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      if (!deliveriesResponse.ok) {
        return res.status(200).json({
          success: false,
          action: 'redelivery_failed',
          message: 'Could not fetch webhook deliveries',
          commitHash: targetCommitHash,
          commitInfo,
          processingStatus,
          redeliveryPerformed: false
        });
      }

      const deliveries = await deliveriesResponse.json();
      if (deliveries.length === 0) {
        return res.status(200).json({
          success: false,
          action: 'no_deliveries',
          message: 'No webhook deliveries found to redeliver',
          commitHash: targetCommitHash,
          commitInfo,
          processingStatus,
          redeliveryPerformed: false
        });
      }

      // Request redelivery for the latest delivery
      const redeliveryResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/hooks/${ourHook.id}/deliveries/${deliveries[0].id}/attempts`,
        {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${accessToken}`,
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );

      if (!redeliveryResponse.ok) {
        const errorData = await redeliveryResponse.json().catch(() => ({}));
        return res.status(200).json({
          success: false,
          action: 'redelivery_failed',
          message: errorData.message || 'Failed to request webhook redelivery',
          commitHash: targetCommitHash,
          commitInfo,
          processingStatus,
          redeliveryPerformed: false
        });
      }

      console.log(`[WebhookDelivery] Auto-redelivery requested for delivery ${deliveries[0].id}`);

      // Wait a bit for the redelivery to be processed
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check status again
      const newProcessingStatus = await checkCommitProcessingStatus(project._id, targetCommitHash);

      return res.status(202).json({
        success: true,
        action: 'redelivered',
        message: 'Webhook redelivery requested. Processing may take a few seconds.',
        commitHash: targetCommitHash,
        commitInfo,
        processingStatus: newProcessingStatus,
        redeliveryPerformed: true,
        deliveryId: deliveries[0].id
      });
    }

    // Return current status without redelivery
    res.status(200).json({
      success: !processingStatus.processed,
      action: autoRedeliver ? 'redelivery_not_available' : 'check_only',
      message: processingStatus.message,
      commitHash: targetCommitHash,
      commitInfo,
      processingStatus,
      redeliveryPerformed: false
    });

  } catch (error) {
    console.error('[WebhookDelivery] Error in auto-verify:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify and redeliver webhook',
      details: error.message
    });
  }
}

module.exports = {
  verifyWebhookDelivery,
  requestWebhookRedelivery,
  verifyAndRedeliverIfNeeded,
  checkCommitProcessingStatus
};
