/**
 * Unit tests for KeyPoolManager
 * Run with: node --test tests/unit/keyPoolManager.test.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const KeyPoolManager = require('../../backend/src/utils/keyPoolManager');

describe('KeyPoolManager', () => {
  const rawKeys = 'key-alpha,key-beta,key-gamma';

  describe('constructor', () => {
    it('should throw when no keys provided', () => {
      assert.throws(() => new KeyPoolManager('', 'Test'), /No API keys/);
    });

    it('should parse comma-separated keys', () => {
      const pool = new KeyPoolManager(rawKeys, 'Test');
      assert.strictEqual(pool.getPoolSize(), 3);
    });
  });

  describe('assignKeyForJob()', () => {
    it('should assign keys round-robin', () => {
      const pool = new KeyPoolManager(rawKeys, 'Test');

      const a = pool.assignKeyForJob('job-1');
      const b = pool.assignKeyForJob('job-2');
      const c = pool.assignKeyForJob('job-3');

      assert.strictEqual(a.key, 'key-alpha');
      assert.strictEqual(b.key, 'key-beta');
      assert.strictEqual(c.key, 'key-gamma');
    });

    it('should return existing assignment for same jobId', () => {
      const pool = new KeyPoolManager(rawKeys, 'Test');
      pool.assignKeyForJob('job-1');
      const second = pool.assignKeyForJob('job-1');
      assert.strictEqual(second.key, 'key-alpha');
    });
  });

  describe('rotateKeyForJob()', () => {
    it('should pick a different key after rotation', () => {
      const pool = new KeyPoolManager(rawKeys, 'Test');
      const first = pool.assignKeyForJob('job-1');
      pool.rotateKeyForJob('job-1');
      const rotated = pool.assignKeyForJob('job-1');
      assert.notStrictEqual(first.key, rotated.key);
    });
  });

  describe('recordFailure() + markUnhealthy', () => {
    it('should skip unhealthy keys on next assignment', () => {
      const pool = new KeyPoolManager(rawKeys, 'Test');
      pool.assignKeyForJob('job-1');
      pool.recordFailure(0, true); // mark key 0 unhealthy

      // job-2 should skip index-0 because it's unhealthy
      const next = pool.assignKeyForJob('job-2');
      assert.notStrictEqual(next.keyIndex, 0);
    });
  });

  describe('releaseJobKey()', () => {
    it('should allow re-assignment after release', () => {
      const pool = new KeyPoolManager(rawKeys, 'Test');
      pool.assignKeyForJob('job-1');
      pool.releaseJobKey('job-1');
      // After release, next new job can reuse this slot round-robin
      const next = pool.assignKeyForJob('job-99');
      assert.ok(next.key);
    });
  });
});
