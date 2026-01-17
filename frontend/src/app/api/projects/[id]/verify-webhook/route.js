import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/db';
import { Project } from '@/lib/models';
import AutoLog from '@/lib/models/AutoLog';

/**
 * Check if a specific commit was processed successfully
 * @param {string} projectId - Project ID
 * @param {string} commitHash - Commit hash to check
 * @returns {Promise<Object>} - Processing status
 */
async function checkCommitProcessingStatus(projectId, commitHash) {
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

  if (log.status === 'success') {
    return {
      processed: true,
      status: 'success',
      sectionUpdated: log.addedToSection,
      wordCount: log.wordCount,
      processedAt: log.createdAt,
      message: 'Commit was processed successfully'
    };
  }

  if (log.status === 'partial') {
    return {
      processed: true,
      status: 'partial',
      message: 'Commit was partially processed',
      processedAt: log.createdAt
    };
  }

  if (log.status === 'pending') {
    return {
      processed: false,
      status: 'pending',
      message: 'Commit is currently being processed',
      queuedAt: log.createdAt
    };
  }

  if (log.status === 'skipped') {
    return {
      processed: true,
      status: 'skipped',
      message: log.error?.message || 'Commit was skipped',
      processedAt: log.createdAt
    };
  }

  return {
    processed: false,
    status: 'failed',
    error: log.error?.message,
    retryable: log.error?.retryable,
    processedAt: log.createdAt,
    message: 'Commit processing failed'
  };
}

/**
 * POST /api/projects/[id]/verify-webhook
 * Verify webhook delivery status and optionally request redelivery
 */
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const body = await request.json();
    const { 
      commitHash, 
      autoRedeliver = true,
      maxWaitTime = 30000 
    } = body;

    await dbConnect();

    // Find the project
    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const [owner, repo] = project.repoFullName.split('/');
    const accessToken = session.accessToken;

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
        return NextResponse.json(
          { error: 'Failed to fetch latest commit from GitHub' },
          { status: commitsResponse.status }
        );
      }

      const commits = await commitsResponse.json();
      if (!commits || commits.length === 0) {
        return NextResponse.json(
          { error: 'No commits found in repository' },
          { status: 404 }
        );
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
      return NextResponse.json({
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
      const pollInterval = 2000;
      
      while (Date.now() - startTime < Math.min(maxWaitTime, 30000)) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        processingStatus = await checkCommitProcessingStatus(project._id, targetCommitHash);
        
        if (processingStatus.processed && processingStatus.status !== 'pending') {
          break;
        }
      }

      if (processingStatus.processed && processingStatus.status !== 'failed') {
        return NextResponse.json({
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
      // Find webhook
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
        return NextResponse.json({
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
      const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
      const ourHook = hooks.find(h => 
        h.config?.url?.includes(backendUrl) || 
        h.config?.url?.includes('webhooks/github') ||
        h.config?.url?.includes('autoreport')
      );

      if (!ourHook) {
        return NextResponse.json({
          success: false,
          action: 'no_webhook',
          message: 'AutoReport webhook not found on repository. Please check webhook configuration.',
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
        return NextResponse.json({
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
        return NextResponse.json({
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
        return NextResponse.json({
          success: false,
          action: 'redelivery_failed',
          message: errorData.message || 'Failed to request webhook redelivery',
          commitHash: targetCommitHash,
          commitInfo,
          processingStatus,
          redeliveryPerformed: false
        });
      }

      console.log(`[VerifyWebhook] Auto-redelivery requested for project ${projectId}, delivery ${deliveries[0].id}`);

      return NextResponse.json({
        success: true,
        action: 'redelivered',
        message: 'Webhook redelivery requested. Processing may take a few seconds.',
        commitHash: targetCommitHash,
        commitInfo,
        processingStatus,
        redeliveryPerformed: true,
        deliveryId: deliveries[0].id,
        webhookId: ourHook.id
      }, { status: 202 });
    }

    // Return current status without redelivery
    return NextResponse.json({
      success: !processingStatus.processed,
      action: autoRedeliver ? 'redelivery_not_available' : 'check_only',
      message: processingStatus.message,
      commitHash: targetCommitHash,
      commitInfo,
      processingStatus,
      redeliveryPerformed: false
    });

  } catch (error) {
    console.error('[VerifyWebhook] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify webhook delivery', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/verify-webhook
 * Get the processing status of the latest commit
 */
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const commitHash = searchParams.get('commitHash');

    await dbConnect();

    const project = await Project.findById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const [owner, repo] = project.repoFullName.split('/');
    const accessToken = session.accessToken;

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

      if (commitsResponse.ok) {
        const commits = await commitsResponse.json();
        if (commits && commits.length > 0) {
          targetCommitHash = commits[0].sha;
          commitInfo = {
            hash: commits[0].sha,
            shortHash: commits[0].sha.substring(0, 7),
            message: commits[0].commit?.message,
            author: commits[0].commit?.author?.name,
            date: commits[0].commit?.author?.date
          };
        }
      }
    }

    if (!targetCommitHash) {
      return NextResponse.json(
        { error: 'Could not determine commit to verify' },
        { status: 400 }
      );
    }

    const processingStatus = await checkCommitProcessingStatus(project._id, targetCommitHash);

    return NextResponse.json({
      success: true,
      commitHash: targetCommitHash,
      commitInfo,
      processingStatus,
      needsRedelivery: !processingStatus.processed && 
                       processingStatus.status !== 'pending' &&
                       processingStatus.status !== 'skipped'
    });

  } catch (error) {
    console.error('[VerifyWebhook] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook status', details: error.message },
      { status: 500 }
    );
  }
}
