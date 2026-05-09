#!/usr/bin/env node
/**
 * Local Dev Test Runner
 *
 * Usage: node tests/runLocal.js [--dry] [--unit] [--integration]
 *
 * Examples:
 *   node tests/runLocal.js --unit                        # unit tests only
 *   node tests/runLocal.js --integration --dry           # integration tests, no live AI
 *   node tests/runLocal.js --all                         # everything, live AI
 *   DRY_RUN=1 node tests/runLocal.js --all               # all tests, offline
 */

const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);

const dry = args.includes('--dry');
const unit = args.includes('--unit');
const integration = args.includes('--integration');
const all = args.includes('--all');

if (dry) process.env.DRY_RUN = '1';

// Default to unit if nothing specified
const runUnit = unit || all || (!unit && !integration && !all);
const runIntegration = integration || all;

// Tests live in <repo>/tests but backend deps are in <repo>/backend/node_modules.
// We run node --test from <repo>/backend so that require('dotenv') resolves.
const backendRoot = path.join(__dirname, '../backend');
const testFiles = [];

if (runUnit) {
  testFiles.push(
    '../tests/unit/keyPoolManager.test.js',
    '../tests/unit/chunkingService.test.js',
    '../tests/unit/analyzerAgent.test.js',
    '../tests/unit/writerAgent.test.js'
  );
}
if (runIntegration) {
  testFiles.push('../tests/integration/webhookPipeline.test.js');
}

const nodePath = process.execPath;
const testArgs = ['--test', ...testFiles];
const env = { ...process.env };

// Ensure the backend's node_modules are discoverable (for axios, mongoose, etc.)
env.NODE_PATH = path.join(backendRoot, 'node_modules');

console.log(`\n🚀 Running tests from: ${backendRoot}\n`);
console.log(`   Command: ${nodePath} ${testArgs.join(' ')}`);
console.log(`   NODE_PATH: ${env.NODE_PATH}`);
if (process.env.DRY_RUN) console.log(`   DRY_RUN: ${process.env.DRY_RUN}`);
console.log('');

const result = spawnSync(nodePath, testArgs, {
  cwd: backendRoot,
  stdio: 'inherit',
  env
});

process.exit(result.status ?? 1);
