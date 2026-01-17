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
const {
  verifyWebhookDelivery,
  requestWebhookRedelivery,
  verifyAndRedeliverIfNeeded
} = require('../controllers/webhookDeliveryController');

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

/**
 * POST /webhooks/verify/:projectId
 * Verify if a specific commit was processed successfully
 * 
 * Body:
 * - accessToken: GitHub access token (optional, for fetching latest commit)
 * - commitHash: Specific commit to check (optional, defaults to latest)
 */
router.post('/verify/:projectId', verifyWebhookDelivery);

/**
 * POST /webhooks/redeliver/:projectId
 * Request redelivery of a webhook from GitHub
 * 
 * Body:
 * - accessToken: GitHub access token (required)
 * - deliveryId: Specific delivery ID to redeliver (optional, defaults to latest)
 * - hookId: Webhook ID (optional, auto-discovered)
 */
router.post('/redeliver/:projectId', requestWebhookRedelivery);

/**
 * POST /webhooks/verify-and-redeliver/:projectId
 * Verify commit processing status and automatically request redelivery if needed
 * 
 * Body:
 * - accessToken: GitHub access token (required)
 * - commitHash: Specific commit to check (optional, defaults to latest)
 * - autoRedeliver: Whether to auto-request redelivery (default: true)
 * - maxWaitTime: Max ms to wait for pending processing (default: 30000)
 */
router.post('/verify-and-redeliver/:projectId', verifyAndRedeliverIfNeeded);

module.exports = router;
