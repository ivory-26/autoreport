const { z } = require('zod');

// Schema for Project Creation
const createProjectSchema = z.object({
  name: z.string().min(3, 'Project name must be at least 3 characters').max(50),
  repoUrl: z.string().url('Invalid repository URL'),
  repoFullName: z.string().regex(/^[\w-]+\/[\w-]+$/, 'Invalid repo format (user/repo)'),
  description: z.string().optional(),
  templateId: z.string().optional()
});

// Schema for Webhook Verification Tools
const verifyWebhookSchema = z.object({
  accessToken: z.string().min(1, 'GitHub Access Token is required'),
  commitHash: z.string().optional()
});

const redeliverWebhookSchema = z.object({
  accessToken: z.string().min(1, 'GitHub Access Token is required'),
  deliveryId: z.string().optional(),
  hookId: z.number().optional()
});

// Generic validator middleware factory
exports.validate = (schema) => (req, res, next) => {
  try {
    // Parse verifies the schema and strips unknown keys if configured (default is passthrough)
    // We strictly validate req.body
    schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }
    next(error);
  }
};

exports.schemas = {
  createProject: createProjectSchema,
  verifyWebhook: verifyWebhookSchema,
  redeliverWebhook: redeliverWebhookSchema
};
