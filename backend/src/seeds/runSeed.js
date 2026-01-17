/**
 * Seed Templates to Autoreport Database
 * 
 * Run this script to seed templates into the autoreport database:
 *   node src/seeds/runSeed.js
 * 
 * This will:
 * 1. Connect to the autoreport database (creates it if it doesn't exist)
 * 2. Seed the default templates
 * 3. Disconnect when done
 */

require('dotenv').config();
const mongoose = require('mongoose');
const { seedTemplates } = require('./templates');

// Override to explicitly use autoreport database
const getAutoreportUri = () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not set in .env');
    process.exit(1);
  }
  
  // Replace database name with 'autoreport' if it's 'test' or another name
  const updatedUri = uri.replace(/\/[^/?]+(\?|$)/, '/autoreport$1');
  return updatedUri;
};

async function runSeed() {
  const uri = getAutoreportUri();
  console.log('🔗 Connecting to MongoDB (autoreport database)...');
  console.log(`   URI: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@')}`);
  
  try {
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB');
    
    // Run seed
    const result = await seedTemplates();
    
    if (result.seeded) {
      console.log(`\n🎉 Successfully seeded ${result.count} templates to autoreport database!`);
    } else {
      console.log(`\nℹ️  Templates already exist. No seeding needed.`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

runSeed();
