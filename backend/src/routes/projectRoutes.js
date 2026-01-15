/**
 * Project Routes
 * 
 * API routes for project management including creation,
 * template fetching, and GitHub repository operations.
 */

const express = require('express');
const router = express.Router();
const {
  getTemplates,
  createProject,
  setupWebhook,
  getProjectById,
  deleteProject
} = require('../controllers/projectController');

// Get all available templates
router.get('/templates', getTemplates);

// Create a new project
router.post('/', createProject);

// Setup GitHub webhook for a project
router.post('/:projectId/webhook', setupWebhook);

// Get project by ID
router.get('/:projectId', getProjectById);

// Delete a project
router.delete('/:projectId', deleteProject);

module.exports = router;
