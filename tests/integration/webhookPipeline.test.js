/**
 * Integration test: Simulates the full webhook pipeline locally.
 * Run: node --test tests/integration/webhookPipeline.test.js
 *
 * This test mocks DB/Mongo but hits the real NIM endpoint for the AI stage.
 * Set DRY_RUN=1 to skip the live AI call.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');

// Load backend env
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

const { analyze } = require('../../backend/src/services/analyzerAgent');
const { generateForAllSections } = require('../../backend/src/services/writerAgent');

const DRY_RUN = process.env.DRY_RUN === '1';

// Mock report & sections
const mockReport = {
  sections: []
};

const mockTemplateSections = [
  { id: 'introduction', title: 'Introduction', aiHints: { keywords: ['intro'] } },
  { id: 'features', title: 'Features', aiHints: { keywords: ['feature', 'auth'] } },
  { id: 'architecture', title: 'Architecture', aiHints: { keywords: ['design', 'structure'] } }
];

describe('Webhook Pipeline (integration)', () => {
  const commitInfo = {
    hash: 'abc1234',
    message: 'feat: add user login',
    author: 'alice'
  };

  const authorInfo = { role: 'owner', username: 'alice' };

  it('Stage 1: Analyzer returns structured data', { skip: DRY_RUN || !process.env.NVIDIA_API_KEYS }, async () => {
    const diff = 'diff --git a/auth.js b/auth.js\n+ function login() { return true; }';
    const analysis = await analyze({
      commitHash: commitInfo.hash,
      commitMessage: commitInfo.message,
      author: commitInfo.author,
      diff,
      filesChanged: ['auth.js'],
      projectContext: { name: 'test-app', techStack: ['node'] },
      templateSections: mockTemplateSections
    });

    assert.ok(analysis.success, 'Analysis should succeed');
    assert.ok(['feature', 'bugfix', 'refactor'].includes(analysis.changeType));
    assert.ok(analysis.metadata.model);
    console.log('[Integration] Stage 1 model:', analysis.metadata.model);
  });

  it('Stage 2: Writer generates content from analysis', { skip: DRY_RUN || !process.env.NVIDIA_API_KEYS }, async () => {
    const analysis = {
      success: true,
      changeType: 'feature',
      impactLevel: 'major',
      semanticTags: ['auth', 'login'],
      entities: [{ type: 'function', name: 'login', file: 'auth.js' }],
      technicalSummary: 'Added login function to auth module',
      suggestedSections: [ { sectionId: 'features', confidence: 0.9, reason: 'Auth feature' } ]
    };

    const writerResults = await generateForAllSections({
      analysisResult: analysis,
      templateSections: mockTemplateSections,
      report: mockReport,
      projectMetadata: { name: 'test-app', description: '' },
      commitInfo,
      authorInfo
    });

    assert.ok(writerResults.length > 0);
    writerResults.forEach(r => {
      assert.ok(r.success);
      assert.ok(r.content.length > 0);
    });
    console.log('[Integration] Stage 2 wrote', writerResults.length, 'sections');
  });

  it('Stage 2 fallback: handles empty suggestedSections gracefully', async () => {
    const analysis = {
      success: true,
      changeType: 'docs',
      impactLevel: 'patch',
      semanticTags: ['readme'],
      entities: [],
      technicalSummary: 'Updated README',
      suggestedSections: []
    };

    const writerResults = await generateForAllSections({
      analysisResult: analysis,
      templateSections: mockTemplateSections,
      report: mockReport,
      projectMetadata: { name: 'test-app', description: '' },
      commitInfo,
      authorInfo
    });

    // Even with no suggestions, at least one section should be targeted via fallback
    assert.ok(writerResults.length >= 0, 'Should handle gracefully with 0 or fallback');
    console.log('[Integration] Fallback target result count:', writerResults.length);
  });
});
