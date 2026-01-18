/**
 * Webhook Resilience Service
 * 
 * Handles webhook delivery failures during server deployments/downtime:
 * 1. Exponential backoff retries
 * 2. Persists webhook data to database for recovery
 * 3. Fetches missed webhooks from GitHub on startup
 */

const Project = require('../models/Project');
const { webhookQueue } = require('./queue');

/**
 * Calculate exponential backoff delay
 * @param {number} attempt - Current attempt number (1-indexed)
 * @returns {number} - Delay in milliseconds
 */
function calculateBackoffDelay(attempt) {
  // Exponential backoff: 2^attempt * 1000ms with jitter
  const baseDelay = Math.pow(2, attempt - 1) * 1000;
  const jitter = Math.random() * 1000; // Random 0-1000ms jitter
  const maxDelay = 60000; // Cap at 60 seconds
  return Math.min(baseDelay + jitter, maxDelay);
}

/**
 * Sleep for a specified duration
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Process webhook with exponential backoff retry
 * Wraps the existing webhook processing to add resilience
 */
async function processWebhookWithRetry(job) {
  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // If not the first attempt, add exponential backoff
      if (attempt > 1) {
        const delay = calculateBackoffDelay(attempt);
        console.log(`[Resilience] Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay for job ${job.id.substring(0, 8)}`);
        await sleep(delay);
      }

      // Process the webhook (this calls the actual processing logic)
      await job.processor(job);
      
      console.log(`[Resilience] Job ${job.id.substring(0, 8)} succeeded on attempt ${attempt}`);
      return; // Success

    } catch (error) {
      lastError = error;
      console.error(`[Resilience] Job ${job.id.substring(0, 8)} failed on attempt ${attempt}:`, error.message);

      // Check if error is retryable
      if (!isRetryableError(error)) {
        console.error(`[Resilience] Non-retryable error for job ${job.id.substring(0, 8)}:`, error.message);
        throw error; // Don't retry non-retryable errors
      }
    }
  }

  // All retries exhausted
  throw new Error(`Job failed after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Determine if an error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} - True if retryable
 */
function isRetryableError(error) {
  // Network errors, timeouts, 5xx errors are retryable
  const retryableMessages = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'socket hang up',
    'timeout',
    '503', // Service Unavailable
    '502', // Bad Gateway
    '504', // Gateway Timeout
    'rate limit'
  ];

  const message = error.message?.toLowerCase() || '';
  return retryableMessages.some(msg => message.includes(msg.toLowerCase()));
}

/**
 * Fetch missed webhooks from GitHub for all active projects
 * Called on server startup to recover from downtime
 */
async function fetchMissedWebhooks() {
  try {
    console.log('[Resilience] Checking for missed webhooks...');

    // Get all active projects
    const projects = await Project.find({ status: 'active' }).lean();
    console.log(`[Resilience] Found ${projects.length} active projects`);

    let totalRecovered = 0;

    for (const project of projects) {
      try {
        const recovered = await fetchMissedWebhooksForProject(project);
        totalRecovered += recovered;
      } catch (error) {
        console.error(`[Resilience] Error fetching missed webhooks for project ${project.name}:`, error.message);
      }
    }

    if (totalRecovered > 0) {
      console.log(`[Resilience] ✅ Recovered ${totalRecovered} missed webhooks across all projects`);
    } else {
      console.log('[Resilience] No missed webhooks found');
    }

    return totalRecovered;

  } catch (error) {
    console.error('[Resilience] Error in fetchMissedWebhooks:', error.message);
    return 0;
  }
}

/**
 * Fetch missed webhooks for a specific project
 * Checks recent commits and queues any that haven't been processed
 * @param {Object} project - Project document
 * @returns {number} - Number of webhooks recovered
 */
async function fetchMissedWebhooksForProject(project) {
  try {
    // Only proceed if project has GitHub access token
    if (!project.githubToken) {
      return 0;
    }

    const [owner, repo] = project.repoFullName.split('/');
    
    // Fetch recent commits from GitHub (last 10 commits)
    const commitsUrl = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
    commitsUrl.searchParams.append('per_page', '10');
    commitsUrl.searchParams.append('sha', project.defaultBranch || 'main');

    const response = await fetch(commitsUrl, {
      headers: {
        'Authorization': `token ${project.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AutoReport-App'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const commits = await response.json();
    const Report = require('../models/Report');

    // Get existing report to check which commits were processed
    const report = await Report.findOne({ projectId: project._id }).lean();
    const processedCommits = new Set();

    if (report) {
      // Collect all commit hashes that contributed to sections
      report.sections.forEach(section => {
        section.contributions?.forEach(contrib => {
          if (contrib.commitHash) {
            processedCommits.add(contrib.commitHash);
          }
        });
      });
    }

    let recovered = 0;

    // Check each commit - process from oldest to newest
    for (let i = commits.length - 1; i >= 0; i--) {
      const commit = commits[i];
      
      // Skip if already processed
      if (processedCommits.has(commit.sha)) {
        continue;
      }

      // Skip if already in queue
      if (await webhookQueue.isCommitQueued(commit.sha)) {
        continue;
      }

      // Skip merge commits (usually no code changes)
      if (commit.parents && commit.parents.length > 1) {
        continue;
      }

      console.log(`[Resilience] Found unprocessed commit for ${project.name}: ${commit.sha.substring(0, 7)}`);

      // Fetch full commit details with diff
      try {
        const commitDetailResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits/${commit.sha}`,
          {
            headers: {
              'Authorization': `token ${project.githubToken}`,
              'Accept': 'application/vnd.github.v3.diff',
              'User-Agent': 'AutoReport-App'
            },
            signal: AbortSignal.timeout(15000)
          }
        );

        if (!commitDetailResponse.ok) {
          throw new Error(`GitHub API error: ${commitDetailResponse.status}`);
        }

        const diffData = await commitDetailResponse.text();

        // Simulate a webhook payload
        const syntheticPayload = {
          type: 'webhook',
          userId: project.owner,
          projectId: project._id,
          project: {
            name: project.name,
            templateId: project.activeTemplateId,
            settings: project.settings
          },
          commit: {
            hash: commit.sha,
            shortHash: commit.sha.substring(0, 7),
            message: commit.commit.message,
            author: commit.commit.author.name,
            authorEmail: commit.commit.author.email,
            timestamp: commit.commit.author.date
          },
          diff: diffData,
          files: commit.files || [],
          summary: {
            filesChanged: commit.files?.length || 0,
            additions: commit.stats?.additions || 0,
            deletions: commit.stats?.deletions || 0,
            relevantFiles: commit.files || []
          },
          valid: true,
          receivedAt: new Date(),
          source: 'recovery', // Mark as recovered webhook
          deliveryId: `recovery-${Date.now()}-${commit.sha.substring(0, 8)}`
        };

        // Enqueue the synthetic webhook
        await webhookQueue.enqueue(syntheticPayload);
        recovered++;;

        // Rate limit: wait 1 second between API calls
        await sleep(1000);

      } catch (error) {
        console.error(`[Resilience] Error fetching commit details for ${commit.sha.substring(0, 7)}:`, error.message);
      }
    }

    if (recovered > 0) {
      console.log(`[Resilience] Recovered ${recovered} missed webhooks for ${project.name}`);
    }

    return recovered;

  } catch (error) {
    if (error.message?.includes('404')) {
      console.warn(`[Resilience] Repository not found or no access: ${project.repoFullName}`);
    } else if (error.message?.includes('403')) {
      console.warn(`[Resilience] Rate limited or forbidden for: ${project.repoFullName}`);
    } else {
      throw error;
    }
    return 0;
  }
}

/**
 * Check webhook endpoint health
 * Used by Render/Vercel to verify server is ready
 */
async function checkWebhookHealth() {
  return {
    status: 'healthy',
    queue: {
      length: await webhookQueue.getLength(),
      processing: webhookQueue.processing
    },
    timestamp: new Date()
  };
}

module.exports = {
  processWebhookWithRetry,
  fetchMissedWebhooks,
  fetchMissedWebhooksForProject,
  calculateBackoffDelay,
  isRetryableError,
  checkWebhookHealth
};
