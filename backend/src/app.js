const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Import Routes (We will create these later)
// const webhookRoutes = require('./routes/webhookRoutes');

const app = express();

// --- Middleware ---

// 1. Security Headers
app.use(helmet());

// 2. CORS (Allow Vercel Frontend to talk to Render Backend)
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// 3. Raw Body Parser for GitHub Webhooks (Critical for Signature Verification)
app.use('/webhooks/github', express.raw({ type: 'application/json' }));

// 4. Standard JSON Parser for other routes
app.use(express.json());

// 5. Logger
app.use(morgan('dev'));

// --- Routes ---
app.get('/', (req, res) => {
    res.status(200).json({ status: 'active', message: 'AutoReport Backend is Running' });
});

// app.use('/webhooks', webhookRoutes);

module.exports = app;