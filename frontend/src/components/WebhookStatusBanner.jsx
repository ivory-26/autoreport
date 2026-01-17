'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Loader2, Info, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  useWebhookVerification,
  getVerificationMessage,
  getStatusVariant
} from '@/lib/hooks/useWebhookVerification';

/**
 * WebhookStatusBanner Component
 * 
 * Displays the webhook delivery status for a project and allows
 * users to verify/request redelivery if content wasn't generated.
 * 
 * @param {string} projectId - The project ID
 * @param {boolean} autoVerifyOnMount - Whether to verify on component mount
 * @param {string} commitHash - Optional specific commit to check
 * @param {Function} onStatusChange - Callback when status changes
 * @param {boolean} showDetails - Whether to show detailed info
 * @param {string} className - Additional CSS classes
 */
export function WebhookStatusBanner({
  projectId,
  autoVerifyOnMount = false,
  commitHash,
  onStatusChange,
  showDetails = true,
  className = ''
}) {
  const {
    verify,
    checkStatus,
    pollForCompletion,
    reset,
    isVerifying,
    error,
    lastResult,
    status
  } = useWebhookVerification(projectId);

  const [hasMounted, setHasMounted] = useState(false);

  // Auto-verify on mount if enabled
  useEffect(() => {
    if (autoVerifyOnMount && projectId && !hasMounted) {
      setHasMounted(true);
      checkStatus(commitHash);
    }
  }, [autoVerifyOnMount, projectId, commitHash, checkStatus, hasMounted]);

  // Notify parent of status changes
  useEffect(() => {
    if (onStatusChange && lastResult) {
      onStatusChange(lastResult);
    }
  }, [lastResult, onStatusChange]);

  // Handle verify and auto-redeliver button click
  const handleVerifyAndRedeliver = async () => {
    const result = await verify({ commitHash, autoRedeliver: true });

    // If redelivery was requested, poll for completion
    if (result.action === 'redelivered') {
      await pollForCompletion({
        commitHash: result.commitHash,
        maxAttempts: 15,
        interval: 2000
      });
    }
  };

  // Handle check-only button click
  const handleCheckOnly = async () => {
    await checkStatus(commitHash);
  };

  // Get icon based on status
  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'checking':
      case 'waiting':
      case 'redelivering':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  // Get alert variant based on status
  const getAlertVariant = () => {
    const variant = getStatusVariant(status);
    if (variant === 'success') return 'default';
    return variant;
  };

  // Don't render if idle and no result
  if (status === 'idle' && !lastResult && !autoVerifyOnMount) {
    return null;
  }

  return (
    <Alert
      variant={getAlertVariant()}
      className={`relative ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {getStatusIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <AlertTitle className="flex items-center gap-2">
            {status === 'success' && 'Webhook Delivery Confirmed'}
            {status === 'checking' && 'Checking Webhook Status...'}
            {status === 'waiting' && 'Waiting for Processing...'}
            {status === 'redelivering' && 'Redelivery Requested'}
            {status === 'failed' && 'Webhook Delivery Issue'}
            {status === 'idle' && 'Webhook Status'}
          </AlertTitle>

          <AlertDescription className="mt-1">
            {error ? (
              <span className="text-destructive">{error.message}</span>
            ) : lastResult ? (
              <div className="space-y-2">
                <p>{getVerificationMessage(lastResult)}</p>

                {showDetails && lastResult.commitInfo && (
                  <div className="text-xs text-muted-foreground mt-2 space-y-1">
                    <p>
                      <span className="font-medium">Commit:</span>{' '}
                      <code className="bg-muted px-1 rounded">
                        {lastResult.commitInfo.shortHash}
                      </code>
                      {lastResult.commitInfo.message && (
                        <span className="ml-2 truncate">
                          — {lastResult.commitInfo.message.split('\n')[0].substring(0, 50)}
                          {lastResult.commitInfo.message.length > 50 ? '…' : ''}
                        </span>
                      )}
                    </p>
                    {lastResult.processingStatus?.sectionUpdated && (
                      <p>
                        <span className="font-medium">Updated:</span>{' '}
                        {lastResult.processingStatus.sectionUpdated}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">
                Click to check if your latest commit was processed.
              </span>
            )}
          </AlertDescription>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Check Status Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckOnly}
            disabled={isVerifying}
          >
            {isVerifying && status === 'checking' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Check</span>
          </Button>

          {/* Verify and Redeliver Button */}
          {(status === 'failed' || status === 'idle' || lastResult?.needsRedelivery) && (
            <Button
              size="sm"
              onClick={handleVerifyAndRedeliver}
              disabled={isVerifying}
            >
              {isVerifying && ['waiting', 'redelivering'].includes(status) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <span className="ml-2">Request Redelivery</span>
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
}

/**
 * WebhookStatusButton Component
 * 
 * A compact button for verifying webhook status.
 * 
 * @param {string} projectId - The project ID
 * @param {string} commitHash - Optional specific commit to check
 * @param {Function} onComplete - Callback when verification completes
 */
export function WebhookStatusButton({
  projectId,
  commitHash,
  onComplete,
  children
}) {
  const { verify, isVerifying, lastResult, status } = useWebhookVerification(projectId);

  const handleClick = async () => {
    const result = await verify({ commitHash, autoRedeliver: true });
    if (onComplete) {
      onComplete(result);
    }
  };

  // Show result status as button variant
  const getVariant = () => {
    switch (status) {
      case 'success':
        return 'outline';
      case 'failed':
        return 'destructive';
      default:
        return 'default';
    }
  };

  return (
    <Button
      variant={getVariant()}
      onClick={handleClick}
      disabled={isVerifying}
    >
      {isVerifying ? (
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
      ) : status === 'success' ? (
        <CheckCircle2 className="h-4 w-4 mr-2" />
      ) : status === 'failed' ? (
        <AlertCircle className="h-4 w-4 mr-2" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-2" />
      )}
      {children || 'Verify Webhook'}
    </Button>
  );
}

export default WebhookStatusBanner;
