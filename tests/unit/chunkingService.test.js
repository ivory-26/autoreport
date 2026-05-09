/**
 * Unit tests for chunkingService
 * Run with: node --test tests/unit/chunkingService.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const { chunkDiff, mergeChunkAnalyses, DEFAULT_CHUNK_SIZE } = require('../../backend/src/services/chunkingService');

describe('chunkingService', () => {
  describe('chunkDiff()', () => {
    it('should return single chunk for small diffs', () => {
      const diff = 'diff --git a/file.js b/file.js\n+ hello world';
      const chunks = chunkDiff(diff);
      assert.strictEqual(chunks.length, 1);
      assert.strictEqual(chunks[0].index, 0);
      assert.strictEqual(chunks[0].total, 1);
    });

    it('should split large diffs across file boundaries', () => {
      // Build a diff that exceeds DEFAULT_CHUNK_SIZE
      const fileA = 'diff --git a/a.js b/a.js\n+'.repeat(100);
      const fileB = 'diff --git a/b.js b/b.js\n+'.repeat(100);
      const diff = fileA + '\n' + fileB;
      const chunks = chunkDiff(diff, { chunkSize: 200 });
      assert.ok(chunks.length > 1, 'Expected multiple chunks');
    });

    it('should preserve file names in chunk metadata', () => {
      const diff = `diff --git a/src/index.js b/src/index.js
+++ b/src/index.js
@@ -1,3 +1,3 @@
- old
+ new
`.repeat(10);
      const chunks = chunkDiff(diff, { chunkSize: 500 });
      chunks.forEach(c => {
        assert.ok(Array.isArray(c.files));
      });
    });
  });

  describe('mergeChunkAnalyses()', () => {
    it('should return null for empty input', () => {
      assert.strictEqual(mergeChunkAnalyses([]), null);
    });

    it('should merge entities and deduplicate', () => {
      const analyses = [
        {
          success: true,
          changeType: 'feature',
          impactLevel: 'minor',
          entities: [{ type: 'function', name: 'init', file: 'a.js' }],
          semanticTags: ['api', 'auth'],
          technicalSummary: 'Added init',
          suggestedSections: [{ sectionId: 'intro', confidence: 0.8 }]
        },
        {
          success: true,
          changeType: 'bugfix',
          impactLevel: 'major',
          entities: [
            { type: 'function', name: 'init', file: 'a.js' }, // duplicate
            { type: 'class', name: 'User', file: 'b.js' }
          ],
          semanticTags: ['db'],
          technicalSummary: 'Fixed init',
          suggestedSections: [{ sectionId: 'intro', confidence: 0.9 }]
        }
      ];

      const merged = mergeChunkAnalyses(analyses);
      assert.strictEqual(merged.entities.length, 2); // deduped
      assert.strictEqual(merged.changeType, 'feature'); // most frequent
      assert.strictEqual(merged.impactLevel, 'major'); // max impact
      assert.ok(Array.isArray(merged.semanticTags));
      assert.ok(merged.semanticTags.includes('api'));
      assert.ok(merged.semanticTags.includes('db'));
    });
  });
});
