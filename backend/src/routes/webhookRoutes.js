/**
 * Webhook Routes
 * 
 * Defines routes for GitHub webhook handling
 */

const express = require('express');
const router = express.Router();
const {
  handleGitHubWebhook,
  getQueueStatus,
  healthCheck
} = require('../controllers/webhookController');

/**
 * POST /webhooks/github
 * Receives GitHub push events
 * 
 * Headers:
 * - X-GitHub-Event: push
 * - X-Hub-Signature-256: sha256=...
 * - X-GitHub-Delivery: uuid
 * 
 * Body: GitHub push event payload
 */
router.post('/github', handleGitHubWebhook);

/**
 * GET /webhooks/github
 * Simple info endpoint for testing connectivity
 */
router.get('/github', (req, res) => {
  res.json({
    message: 'GitHub webhook endpoint is active',
    method: 'Use POST to send webhook events',
    timestamp: new Date()
  });
});

/**
 * GET /webhooks/status
 * Returns the current queue status
 * Useful for monitoring and debugging
 */
router.get('/status', getQueueStatus);

/**
 * GET /webhooks/health
 * Health check endpoint
 */
router.get('/health', healthCheck);

module.exports = router;
