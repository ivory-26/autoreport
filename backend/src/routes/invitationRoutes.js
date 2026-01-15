/**
 * Invitation Routes
 * 
 * API routes for project collaboration invitations
 */

const express = require('express');
const router = express.Router();
const {
  sendInvitation,
  getPendingInvitations,
  acceptInvitation,
  declineInvitation,
  removeCollaborator,
  getCollaborators
} = require('../controllers/invitationController');

// Invitation management
router.post('/send', sendInvitation);
router.get('/pending', getPendingInvitations);
router.post('/:id/accept', acceptInvitation);
router.post('/:id/decline', declineInvitation);

// Collaborator management (attached to projects)
router.get('/projects/:projectId/collaborators', getCollaborators);
router.delete('/projects/:projectId/collaborators/:username', removeCollaborator);

module.exports = router;
