/**
 * Progress Routes
 * 
 * Provides endpoints for monitoring webhook job progress:
 * - SSE endpoint for real-time updates
 * - Polling endpoint for status checks
 * - Queue status endpoint
 */

const express = require('express');
const router = express.Router();
const { 
  streamJobProgress, 
  getJobStatus, 
  getQueueStatus 
} = require('../controllers/progressController');

// GET /api/progress/queue - Get overall queue status
router.get('/queue', getQueueStatus);

// GET /api/progress/:jobId/stream - SSE endpoint for real-time progress
router.get('/:jobId/stream', streamJobProgress);

// GET /api/progress/:jobId - Polling endpoint for job status
router.get('/:jobId', getJobStatus);

module.exports = router;
