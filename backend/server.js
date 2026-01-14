require('dotenv').config();
const app = require('./src/app');
const { initializeApp } = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 4000;

// Start the server
async function startServer() {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Initialize app (seed templates, etc.)
    await initializeApp();

    // 3. Start Server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/webhooks/github`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();