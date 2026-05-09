/**
 * Unit tests for analyzerAgent (NVIDIA NIM migration)
 * Run: node --test tests/unit/analyzerAgent.test.js
 * NOTE: Requires NVIDIA_API_KEYS env var for live calls.
 * Set DRY_RUN=1 to skip real API calls.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Load dotenv from backend
require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const { analyze, quickAnalyze, parseAIResponse, validateAnalysisResult } = require('../../backend/src/services/analyzerAgent');

const DRY_RUN = process.env.DRY_RUN === '1';

if (!DRY_RUN && !process.env.NVIDIA_API_KEYS) {
  console.warn('WARN: NVIDIA_API_KEYS not set. Set DRY_RUN=1 to skip live calls.');
}

describe('analyzerAgent', () => {
  describe('parseAIResponse()', () => {
    it('should strip markdown fences', () => {
      const input = '```json\n{ "changeType": "feature" }\n```';
      const result = parseAIResponse(input);
      assert.strictEqual(result.changeType, 'feature');
    });

    it('should fall back to raw JSON', () => {
      const input = '{ "changeType": "bugfix" }';
      const result = parseAIResponse(input);
      assert.strictEqual(result.changeType, 'bugfix');
    });
  });

  describe('validateAnalysisResult()', () => {
    it('should normalize unknown changeType', () => {
      const result = validateAnalysisResult({ changeType: 'whatever', entities: null });
      assert.strictEqual(result.changeType, 'unknown');
      assert.deepStrictEqual(result.entities, []);
    });

    it('should cap entities and tags', () => {
      const entities = Array.from({ length: 30 }, (_, i) => ({ name: `e${i}` }));
      const tags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
      const result = validateAnalysisResult({ entities, semanticTags: tags });
      assert.strictEqual(result.entities.length, 20);
      assert.strictEqual(result.semanticTags.length, 10);
    });
  });

  describe('quickAnalyze()', () => {
    it('should infer changeType from commit message', () => {
      const result = quickAnalyze('fix: auth bug', ['src/auth.js']);
      assert.strictEqual(result.changeType, 'bugfix');
      assert.strictEqual(result.entities[0].file, 'src/auth.js');
    });
  });

  describe('analyze() live NIM', () => {
    it('should analyze a small diff', { skip: DRY_RUN || !process.env.NVIDIA_API_KEYS }, async () => {
      const result = await analyze({
        commitHash: 'abc1234',
        commitMessage: 'feat: add user login',
        author: 'alice',
        diff: 'diff --git a/auth.js b/auth.js\n+ function login() { return true; }',
        filesChanged: ['auth.js'],
        projectContext: { name: 'test', techStack: [] },
        templateSections: [{ id: 'features', title: 'Features' }]
      });
      assert.ok(result.success);
      assert.ok(result.changeType);
      assert.ok(result.metadata.model);
      console.log('[Test] analyze() result:', JSON.stringify(result, null, 2));
    });

    it('should chunk a very large diff and merge', { skip: DRY_RUN || !process.env.NVIDIA_API_KEYS }, async () => {
      const bigDiff = 'diff --git a/big.js b/big.js\n'.repeat(15000);
      const result = await analyze({
        commitHash: 'def5678',
        commitMessage: 'refactor: huge refactor',
        author: 'bob',
        diff: bigDiff,
        filesChanged: ['big.js'],
        projectContext: { name: 'test', techStack: [] },
        templateSections: [{ id: 'architecture', title: 'Architecture' }]
      });
      assert.ok(result);
      console.log('[Test] chunked result success:', result.success, 'usedChunking:', result.metadata?.usedChunking);
    });
  });
});
