/**
 * Project Routes
 * 
 * API routes for project management including creation,
 * template fetching, and GitHub repository operations.
 */

const express = require('express');

const router = express.Router();
const { aiLimiter } = require('../middleware/rateLimiters');
const { validate, schemas } = require('../middleware/validators');
const {
  getTemplates,
  createProject,
  setupWebhook,
  getProjectById,
  deleteProject,
  generateInitialReport,
  regenerateSection,
  revertSection,
  acceptSection,
  acceptAllSections
} = require('../controllers/projectController');

// Get all available templates
router.get('/templates', getTemplates);

// Create a new project
router.post('/', validate(schemas.createProject), createProject);

// Setup GitHub webhook for a project
router.post('/:projectId/webhook', setupWebhook);

// Generate initial report based on last commit (Expensive AI op)
router.post('/:projectId/generate-initial', aiLimiter, generateInitialReport);

// Accept all sections with AI changes (must come before :sectionId routes)
router.post('/:projectId/sections/accept-all', acceptAllSections);

// Regenerate a specific section's content using AI (Expensive AI op)
router.post('/:projectId/sections/:sectionId/regenerate', aiLimiter, regenerateSection);

// Revert a section to its previous version
router.post('/:projectId/sections/:sectionId/revert', revertSection);

// Accept a section's content (remove AI highlight but keep content revertable)
router.post('/:projectId/sections/:sectionId/accept', acceptSection);

// Get project by ID
router.get('/:projectId', getProjectById);

// Delete a project
router.delete('/:projectId', deleteProject);

module.exports = router;

