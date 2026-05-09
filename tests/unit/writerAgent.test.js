/**
 * Unit tests for writerAgent (NVIDIA NIM migration)
 * Run: node --test tests/unit/writerAgent.test.js
 * Set DRY_RUN=1 for offline-only tests (no live API calls).
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

// Load backend env
require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const { generate, parseWriterResponse, validateWriterResult } = require('../../backend/src/services/writerAgent');

const DRY_RUN = process.env.DRY_RUN === '1';

if (!DRY_RUN && !process.env.NVIDIA_API_KEYS) {
  console.warn('WARN: NVIDIA_API_KEYS not set. Set DRY_RUN=1 to skip live calls.');
}

describe('writerAgent', () => {
  describe('parseWriterResponse()', () => {
    it('should strip markdown fences', () => {
      const input = '```json\n{ "content": "hello" }\n```';
      const result = parseWriterResponse(input);
      assert.strictEqual(result.content, 'hello');
    });

    it('should flatten nested content objects', () => {
      const input = '{ "content": { "features": "added auth" } }';
      const result = parseWriterResponse(input);
      assert.ok(result.content.includes('features'));
    });

    it('should return raw text when no JSON found', () => {
      const input = 'This is plain text';
      const result = parseWriterResponse(input);
      assert.strictEqual(result.content, 'This is plain text');
      assert.strictEqual(result.insertPosition, 'append');
    });
  });

  describe('validateWriterResult()', () => {
    it('should truncate when content exceeds 1.5x maxLength', () => {
      // 600 words * 1.5 = 900, so we need >900 to trigger truncation
      const longContent = Array(1000).fill('word').join(' ');
      const result = validateWriterResult({ content: longContent }, { id: 'sec', title: 'Section', style: { maxLength: 500 } });
      assert.ok(result.wordCount <= 500);
    });

    it('should not truncate when under threshold', () => {
      const shortContent = Array(400).fill('word').join(' '); // 400 < 750
      const result = validateWriterResult({ content: shortContent }, { id: 'sec', title: 'Section', style: { maxLength: 500 } });
      assert.ok(result.wordCount === 400);
    });
  });

  describe('generate() live NIM', () => {
    it('should write a section', { skip: DRY_RUN || !process.env.NVIDIA_API_KEYS }, async () => {
      const result = await generate({
        analysisResult: {
          changeType: 'feature',
          impactLevel: 'major',
          semanticTags: ['auth'],
          entities: [],
          technicalSummary: 'Added login'
        },
        targetSection: { id: 'features', title: 'Features', style: { maxLength: 500 } },
        projectMetadata: { name: 'test' },
        commitInfo: { hash: 'abc', message: 'feat: login', author: 'alice' },
        authorInfo: { role: 'owner' }
      });

      assert.ok(result.success);
      assert.ok(result.content.length > 0);
      console.log('[Test] generate() wordCount:', result.wordCount, 'model:', result.metadata.model);
    });
  });
});
