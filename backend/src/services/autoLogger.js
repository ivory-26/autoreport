/**
 * AutoLogger Service
 * 
 * Handles logging of webhook processing results to the AutoLog collection.
 * Provides methods for success, error, and skip logging with error classification.
 */

const AutoLog = require('../models/AutoLog');

/**
 * Error codes for classification
 */
const ERROR_CODES = {
  RATE_LIMIT: 'RATE_LIMIT',
  AUTH_ERROR: 'AUTH_ERROR',
  DB_ERROR: 'DB_ERROR',
  TIMEOUT: 'TIMEOUT',
  VALIDATION: 'VALIDATION',
  AI_ERROR: 'AI_ERROR',
  FILTERED: 'FILTERED',
  UNKNOWN: 'UNKNOWN'
};

/**
 * Stages in the processing pipeline
 */
const STAGES = {
  WEBHOOK: 'webhook',
  QUEUE: 'queue',
  ANALYZER: 'analyzer',
  WRITER: 'writer',
  DATABASE: 'database',
  FILTER: 'filter'
};

class AutoLogger {
  /**
   * Log a successful processing result
   * @param {Object} params
   * @param {ObjectId} params.projectId - Project ID
   * @param {ObjectId} params.reportId - Report ID
   * @param {string} params.commitHash - Commit hash
   * @param {string} params.commitMessage - Commit message
   * @param {string} params.author - Commit author
   * @param {Object} params.authorInfo - Extended author information
   * @param {Object} params.result - Processing result
   * @param {Object} params.pipelineTrace - Timing information
   * @param {Object} params.analysisResult - Analysis summary
   * @returns {Promise<Object>} - Created AutoLog entry
   */
  async logSuccess({
    projectId,
    reportId,
    commitHash,
    commitMessage,
    author,
    authorInfo,
    result,
    pipelineTrace,
    analysisResult,
    deliveryId
  }) {
    try {
      const processingTime = this.calculateProcessingTime(pipelineTrace);

      const logEntry = await AutoLog.create({
        projectId,
        reportId,
        commitHash,
        commitMessage,
        author,
        authorInfo: authorInfo || undefined,
        deliveryId,
        addedToSection: result.sectionTitle,
        sectionId: result.sectionId,
        contentPreview: result.content?.substring(0, 200),
        wordCount: result.wordCount || this.countWords(result.content),
        processingTime,
        status: 'success',
        pipelineTrace: {
          ...pipelineTrace,
          savedAt: new Date()
        },
        analysisResult: analysisResult ? {
          changeType: analysisResult.changeType,
          impactLevel: analysisResult.impactLevel,
          semanticTags: analysisResult.semanticTags,
          entitiesCount: analysisResult.entities?.length || 0
        } : undefined
      });

      return logEntry;
    } catch (error) {
      console.error('Failed to log success:', error);
      // Don't throw - logging failure shouldn't break the main flow
      return null;
    }
  }

  /**
   * Log an error during processing
   * @param {Object} params
   * @param {ObjectId} params.projectId - Project ID
   * @param {string} params.commitHash - Commit hash
   * @param {string} params.commitMessage - Commit message
   * @param {string} params.author - Commit author
   * @param {Object} params.authorInfo - Extended author information
   * @param {string} params.stage - Pipeline stage where error occurred
   * @param {Error} params.error - The error object
   * @param {Object} params.pipelineTrace - Timing information
   * @returns {Promise<Object>} - Created AutoLog entry
   */
  async logError({
    projectId,
    commitHash,
    commitMessage,
    author,
    authorInfo,
    stage,
    error,
    pipelineTrace,
    deliveryId
  }) {
    try {
      const errorCode = this.classifyError(error);
      const processingTime = this.calculateProcessingTime(pipelineTrace);

      const logEntry = await AutoLog.create({
        projectId,
        commitHash,
        commitMessage,
        author,
        authorInfo: authorInfo || undefined,
        deliveryId,
        processingTime,
        status: 'failed',
        error: {
          stage,
          code: errorCode,
          message: error.message || String(error),
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          retryable: this.isRetryable(errorCode)
        },
        pipelineTrace
      });

      console.error(`[AutoLog] Error logged for ${commitHash?.substring(0, 7)}:`, {
        stage,
        code: errorCode,
        message: error.message
      });

      return logEntry;
    } catch (logError) {
      console.error('Failed to log error:', logError);
      return null;
    }
  }

  /**
   * Log a skipped commit (filtered out)
   * @param {Object} params
   * @param {ObjectId} params.projectId - Project ID
   * @param {string} params.commitHash - Commit hash
   * @param {string} params.commitMessage - Commit message
   * @param {string} params.author - Commit author
   * @param {string} params.reason - Reason for skipping
   * @param {Array} params.ignoredFiles - List of ignored files
   * @returns {Promise<Object>} - Created AutoLog entry
   */
  async logSkipped({
    projectId,
    commitHash,
    commitMessage,
    author,
    reason,
    ignoredFiles,
    deliveryId
  }) {
    try {
      const logEntry = await AutoLog.create({
        projectId,
        commitHash,
        commitMessage,
        author,
        deliveryId,
        status: 'skipped',
        error: {
          stage: STAGES.FILTER,
          code: ERROR_CODES.FILTERED,
          message: reason,
          retryable: false
        },
        pipelineTrace: {
          webhookReceived: new Date()
        }
      });

      console.log(`[AutoLog] Skipped ${commitHash?.substring(0, 7)}: ${reason}`);
      return logEntry;
    } catch (error) {
      console.error('Failed to log skip:', error);
      return null;
    }
  }

  /**
   * Log a partial success (some sections updated, some failed)
   * @param {Object} params
   * @param {ObjectId} params.projectId - Project ID
   * @param {ObjectId} params.reportId - Report ID
   * @param {string} params.commitHash - Commit hash
   * @param {string} params.commitMessage - Commit message
   * @param {string} params.author - Commit author
   * @param {Object} params.authorInfo - Extended author information
   * @param {Array} params.successes - Successfully updated sections
   * @param {Array} params.failures - Failed sections with errors
   * @param {Object} params.pipelineTrace - Timing information
   * @returns {Promise<Object>} - Created AutoLog entry
   */
  async logPartial({
    projectId,
    reportId,
    commitHash,
    commitMessage,
    author,
    authorInfo,
    successes,
    failures,
    pipelineTrace,
    deliveryId
  }) {
    try {
      const processingTime = this.calculateProcessingTime(pipelineTrace);

      const logEntry = await AutoLog.create({
        projectId,
        reportId,
        commitHash,
        commitMessage,
        author,
        authorInfo: authorInfo || undefined,
        deliveryId,
        addedToSection: successes.map(s => s.sectionTitle).join(', '),
        contentPreview: `${successes.length} sections updated, ${failures.length} failed`,
        processingTime,
        status: 'partial',
        error: {
          stage: STAGES.WRITER,
          code: ERROR_CODES.AI_ERROR,
          message: `Partial success: ${failures.length} section(s) failed`,
          retryable: true
        },
        pipelineTrace: {
          ...pipelineTrace,
          savedAt: new Date()
        }
      });

      return logEntry;
    } catch (error) {
      console.error('Failed to log partial:', error);
      return null;
    }
  }

  /**
   * Create a pending log entry (for tracking in-progress processing)
   * @param {Object} params
   * @param {ObjectId} params.projectId - Project ID
   * @param {string} params.commitHash - Commit hash
   * @param {string} params.commitMessage - Commit message
   * @param {string} params.author - Commit author
   * @returns {Promise<Object>} - Created AutoLog entry
   */
  async logPending({
    projectId,
    commitHash,
    commitMessage,
    author,
    deliveryId
  }) {
    try {
      const logEntry = await AutoLog.create({
        projectId,
        commitHash,
        commitMessage,
        author,
        deliveryId,
        status: 'pending',
        pipelineTrace: {
          webhookReceived: new Date()
        }
      });

      return logEntry;
    } catch (error) {
      console.error('Failed to log pending:', error);
      return null;
    }
  }

  /**
   * Update an existing log entry
   * @param {ObjectId} logId - AutoLog ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} - Updated AutoLog entry
   */
  async updateLog(logId, updates) {
    try {
      return await AutoLog.findByIdAndUpdate(logId, updates, { new: true });
    } catch (error) {
      console.error('Failed to update log:', error);
      return null;
    }
  }

  /**
   * Classify an error into a known error code
   * @param {Error} error - The error to classify
   * @returns {string} - Error code
   */
  classifyError(error) {
    const message = (error.message || String(error)).toLowerCase();

    if (message.includes('rate limit') || message.includes('quota') || message.includes('429')) {
      return ERROR_CODES.RATE_LIMIT;
    }
    if (message.includes('api key') || message.includes('unauthorized') || message.includes('401') || message.includes('403')) {
      return ERROR_CODES.AUTH_ERROR;
    }
    if (message.includes('timeout') || error.code === 'TIMEOUT') {
      return ERROR_CODES.TIMEOUT;
    }
    if (message.includes('mongo') || message.includes('database') || message.includes('connection')) {
      return ERROR_CODES.DB_ERROR;
    }
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return ERROR_CODES.VALIDATION;
    }
    if (message.includes('gemini') || message.includes('ai') || message.includes('generation')) {
      return ERROR_CODES.AI_ERROR;
    }

    return ERROR_CODES.UNKNOWN;
  }

  /**
   * Check if an error code is retryable
   * @param {string} errorCode - The error code
   * @returns {boolean} - True if retryable
   */
  isRetryable(errorCode) {
    const retryableCodes = [
      ERROR_CODES.RATE_LIMIT,
      ERROR_CODES.TIMEOUT,
      ERROR_CODES.DB_ERROR
    ];
    return retryableCodes.includes(errorCode);
  }

  /**
   * Calculate processing time from pipeline trace
   * @param {Object} pipelineTrace - Timing information
   * @returns {number} - Processing time in milliseconds
   */
  calculateProcessingTime(pipelineTrace) {
    if (!pipelineTrace?.webhookReceived) return 0;

    const start = new Date(pipelineTrace.webhookReceived).getTime();
    const end = pipelineTrace.savedAt 
      ? new Date(pipelineTrace.savedAt).getTime()
      : Date.now();

    return end - start;
  }

  /**
   * Count words in content
   * @param {string} content - Text content
   * @returns {number} - Word count
   */
  countWords(content) {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Get recent logs for a project
   * @param {ObjectId} projectId - Project ID
   * @param {number} limit - Maximum number of logs
   * @returns {Promise<Array>} - Recent log entries
   */
  async getRecentLogs(projectId, limit = 20) {
    return AutoLog.getRecentLogs(projectId, limit);
  }

  /**
   * Get error summary for a project
   * @param {ObjectId} projectId - Project ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} - Error summary by code
   */
  async getErrorSummary(projectId, days = 7) {
    return AutoLog.getErrorSummary(projectId, days);
  }
}

// Export singleton instance
const autoLogger = new AutoLogger();

module.exports = {
  autoLogger,
  AutoLogger,
  ERROR_CODES,
  STAGES
};
