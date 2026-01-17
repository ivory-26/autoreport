'use client';

import { useState, useCallback } from 'react';

/**
 * useWebhookVerification Hook
 * 
 * A hook for verifying webhook delivery status and automatically
 * requesting redelivery if a commit wasn't processed after push.
 * 
 * Usage:
 * ```jsx
 * const { 
 *   verify, 
 *   status, 
 *   isVerifying, 
 *   error,
 *   lastResult 
 * } = useWebhookVerification(projectId);
 * 
 * // Verify latest commit
 * await verify();
 * 
 * // Verify specific commit
 * await verify({ commitHash: 'abc123' });
 * 
 * // Verify without auto-redelivery
 * await verify({ autoRedeliver: false });
 * ```
 */
export function useWebhookVerification(projectId) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, checking, waiting, redelivering, success, failed

  /**
   * Verify webhook delivery for a commit
   * @param {Object} options
   * @param {string} options.commitHash - Specific commit to check (optional)
   * @param {boolean} options.autoRedeliver - Auto-request redelivery if needed (default: true)
   * @param {number} options.maxWaitTime - Max time to wait for pending processing (default: 30000)
   * @returns {Promise<Object>} Verification result
   */
  const verify = useCallback(async (options = {}) => {
    const { 
      commitHash, 
      autoRedeliver = true, 
      maxWaitTime = 30000 
    } = options;

    if (!projectId) {
      const err = new Error('Project ID is required');
      setError(err);
      return { success: false, error: err.message };
    }

    setIsVerifying(true);
    setError(null);
    setStatus('checking');

    try {
      const response = await fetch(`/api/projects/${projectId}/verify-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          commitHash,
          autoRedeliver,
          maxWaitTime
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify webhook delivery');
      }

      setLastResult(data);

      // Determine status from action
      switch (data.action) {
        case 'none':
        case 'waited':
          setStatus('success');
          break;
        case 'redelivered':
          setStatus('redelivering');
          break;
        case 'redelivery_failed':
        case 'no_webhook':
        case 'no_deliveries':
          setStatus('failed');
          break;
        default:
          setStatus(data.processingStatus?.processed ? 'success' : 'failed');
      }

      return data;
    } catch (err) {
      setError(err);
      setStatus('failed');
      return { success: false, error: err.message };
    } finally {
      setIsVerifying(false);
    }
  }, [projectId]);

  /**
   * Check status without auto-redelivery
   * @param {string} commitHash - Specific commit to check (optional)
   * @returns {Promise<Object>} Status result
   */
  const checkStatus = useCallback(async (commitHash) => {
    if (!projectId) {
      const err = new Error('Project ID is required');
      setError(err);
      return { success: false, error: err.message };
    }

    setIsVerifying(true);
    setError(null);
    setStatus('checking');

    try {
      const url = new URL(`/api/projects/${projectId}/verify-webhook`, window.location.origin);
      if (commitHash) {
        url.searchParams.set('commitHash', commitHash);
      }

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check webhook status');
      }

      setLastResult(data);
      setStatus(data.processingStatus?.processed ? 'success' : 'failed');

      return data;
    } catch (err) {
      setError(err);
      setStatus('failed');
      return { success: false, error: err.message };
    } finally {
      setIsVerifying(false);
    }
  }, [projectId]);

  /**
   * Poll for processing completion
   * Useful after redelivery to wait for processing
   * @param {Object} options
   * @param {string} options.commitHash - Commit to poll for
   * @param {number} options.maxAttempts - Max polling attempts (default: 10)
   * @param {number} options.interval - Polling interval in ms (default: 3000)
   * @returns {Promise<Object>} Final status
   */
  const pollForCompletion = useCallback(async (options = {}) => {
    const { 
      commitHash,
      maxAttempts = 10, 
      interval = 3000 
    } = options;

    setStatus('waiting');

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await checkStatus(commitHash);
      
      if (result.processingStatus?.processed) {
        return result;
      }

      if (result.processingStatus?.status !== 'pending') {
        // Not pending and not processed = failed
        return result;
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    // Max attempts reached
    setStatus('failed');
    return lastResult;
  }, [checkStatus, lastResult]);

  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    setIsVerifying(false);
    setError(null);
    setLastResult(null);
    setStatus('idle');
  }, []);

  return {
    verify,
    checkStatus,
    pollForCompletion,
    reset,
    isVerifying,
    error,
    lastResult,
    status
  };
}

/**
 * Helper function to get a user-friendly message from verification result
 * @param {Object} result - Verification result from the API
 * @returns {string} User-friendly message
 */
export function getVerificationMessage(result) {
  if (!result) return 'No verification result';

  switch (result.action) {
    case 'none':
      return `Commit ${result.commitInfo?.shortHash || result.commitHash?.substring(0, 7)} was processed successfully.`;
    case 'waited':
      return `Commit processing completed after ${Math.round(result.waitedMs / 1000)}s.`;
    case 'redelivered':
      return 'Webhook redelivery requested. Content will be generated shortly.';
    case 'redelivery_failed':
      return `Failed to request redelivery: ${result.message}`;
    case 'no_webhook':
      return 'AutoReport webhook not found. Please check your repository settings.';
    case 'no_deliveries':
      return 'No webhook deliveries found. Try pushing a new commit.';
    case 'check_only':
      return result.processingStatus?.message || 'Status checked';
    default:
      return result.message || 'Unknown status';
  }
}

/**
 * Helper function to get status color/variant
 * @param {string} status - Verification status
 * @returns {string} Color variant
 */
export function getStatusVariant(status) {
  switch (status) {
    case 'success':
      return 'success';
    case 'checking':
    case 'waiting':
    case 'redelivering':
      return 'warning';
    case 'failed':
      return 'destructive';
    default:
      return 'secondary';
  }
}

export default useWebhookVerification;
