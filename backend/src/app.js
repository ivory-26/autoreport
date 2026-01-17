const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import Routes
const webhookRoutes = require('./routes/webhookRoutes');
const projectRoutes = require('./routes/projectRoutes');
const invitationRoutes = require('./routes/invitationRoutes');
const progressRoutes = require('./routes/progressRoutes');

// Import seed function for auto-seeding templates
const { seedTemplates } = require('./seeds/templates');

const app = express();

// Trust proxy - Required for Render/Heroku/Vercel deployments
// This allows rate limiting to work correctly behind reverse proxies
app.set('trust proxy', 1);

// --- Middleware ---

// 1. Security Headers
app.use(helmet());

// 2. Global Rate Limiting
const { globalLimiter } = require('./middleware/rateLimiters');
app.use(globalLimiter);

// 3. Express 5.x Compatibility Workaround for mongo-sanitize
// Source: https://stackoverflow.com/a/78728678
// Posted by Mohammed Sersawy, modified by community
// Retrieved 2026-01-18, License - CC BY-SA 4.0
app.use((req, res, next) => {
  Object.defineProperty(req, 'query', {
    ...Object.getOwnPropertyDescriptor(req, 'query'),
    value: req.query,
    writable: true,
  });
  next();
});

// 4. NoSQL Injection Prevention
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize({
    allowDots: true,
    replaceWith: '_'
}));

// 5. CORS (Strict in Production)
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL 
      : (process.env.FRONTEND_URL || 'http://localhost:3000'),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// 6. JSON Parser with raw body preservation for webhook signature verification
// For webhook routes, we need both raw body (for signature) and parsed JSON
app.use('/webhooks/github', express.json({
    verify: (req, res, buf) => {
        // Store raw body for signature verification
        req.rawBody = buf;
    }
}));

// 7. Standard JSON Parser for other routes
app.use(express.json());

// 8. Logger
app.use(morgan('dev'));

// --- Routes ---
app.get('/', (req, res) => {
    res.status(200).json({ status: 'active', message: 'AutoReport Backend is Running' });
});

// Webhook routes for GitHub events
app.use('/webhooks', webhookRoutes);

// Project management routes
app.use('/api/projects', projectRoutes);

// Invitation/collaboration routes
app.use('/api/invitations', invitationRoutes);

// Progress monitoring routes (SSE + polling for job status)
app.use('/api/progress', progressRoutes);

// --- Queue processor import ---
const { webhookQueue } = require('./services/queue');
const { processInitialReportJob } = require('./controllers/projectController');
const { processWebhookJob } = require('./controllers/webhookController');

// --- Auto-seed templates on startup ---
async function initializeApp() {
    try {
        // Seed default templates if none exist
        await seedTemplates();
        
        // Register queue processor for handling different job types
        webhookQueue.setProcessor(async (job) => {
            const jobType = job.data?.type || 'webhook';
            
            console.log(`[Queue] Processing job ${job.id.substring(0, 8)} of type: ${jobType}`);
            
            switch (jobType) {
                case 'initial_report':
                    await processInitialReportJob(job);
                    break;
                case 'webhook':
                default:
                    await processWebhookJob(job);
                    break;
            }
        });
        
        console.log('✅ App initialization complete');
        console.log('📋 Queue processor registered');
    } catch (error) {
        console.error('⚠️ App initialization warning:', error.message);
        // Don't throw - seeding failure shouldn't prevent app from starting
    }
}

// Export both app and initialization function
module.exports = app;
module.exports.initializeApp = initializeApp;