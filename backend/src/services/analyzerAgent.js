/**
 * Analyzer Agent
 *
 * Stage 1 of the AI pipeline. Analyzes code diffs and extracts
 * structured information for routing to report sections.
 *
 * Uses NVIDIA NIM API (moonshotai/kimi-k2.6) with token-aware chunking.
 */

const { withTimeout, getTimeoutFromEnv, TimeoutError } = require('./timeout');
const { ANALYZER_SYSTEM_PROMPT, createAnalyzerUserPrompt, createChunkedAnalyzerPrompt } = require('../prompts/analyzerPrompt');
const { chunkDiff, mergeChunkAnalyses, DEFAULT_CHUNK_SIZE } = require('./chunkingService');
const { MODELS, getNimKeyPool } = require('../utils/aiConfig');
const { callNimChatCompletion, extractNimContent } = require('../utils/nimClient');
const { webhookQueue } = require('./queue');

// Model configuration
const PRIMARY_MODEL = MODELS.ANALYZER.PRIMARY;
const FALLBACK_MODEL = MODELS.ANALYZER.FALLBACK;

// Token-aware limits (approx 4 chars/token)
const MAX_DIFF_TOKENS = 4000;
const CHUNKING_THRESHOLD = DEFAULT_CHUNK_SIZE;

/**
 * Get key info from the pool for a given job
 */
function getKeyInfo(jobId) {
  const pool = getNimKeyPool();
  if (!pool) {
    throw new Error('NVIDIA_API_KEYS environment variable is not set.');
  }
  return jobId
    ? pool.getKeyForJob(jobId) || pool.assignKeyForJob(jobId)
    : pool.getNextKey();
}

const DEFAULT_ANALYSIS = {
  changeType: 'unknown',
  impactLevel: 'patch',
  entities: [],
  semanticTags: ['general'],
  technicalSummary: 'Unable to analyze commit changes.',
  suggestedSections: []
};

function parseAIResponse(text) {
  let cleaned = text.trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
  }
}

function validateAnalysisResult(result) {
  const validated = {
    changeType: ['feature', 'bugfix', 'refactor', 'config', 'docs', 'test'].includes(result.changeType)
      ? result.changeType
      : 'unknown',
    impactLevel: ['major', 'minor', 'patch'].includes(result.impactLevel)
      ? result.impactLevel
      : 'patch',
    entities: Array.isArray(result.entities) ? result.entities.slice(0, 20) : [],
    semanticTags: Array.isArray(result.semanticTags) ? result.semanticTags.slice(0, 10) : ['general'],
    technicalSummary: typeof result.technicalSummary === 'string'
      ? result.technicalSummary.substring(0, 1000)
      : 'No summary available.',
    suggestedSections: Array.isArray(result.suggestedSections)
      ? result.suggestedSections.slice(0, 5)
      : []
  };

  validated.entities = validated.entities.map(entity => ({
    type: entity.type || 'unknown',
    name: String(entity.name || 'unnamed').substring(0, 100),
    action: ['created', 'modified', 'deleted'].includes(entity.action) ? entity.action : 'modified',
    file: String(entity.file || 'unknown').substring(0, 200),
    description: String(entity.description || '').substring(0, 300)
  }));

  validated.suggestedSections = validated.suggestedSections.map(section => ({
    sectionId: String(section.sectionId || ''),
    confidence: Math.min(1, Math.max(0, Number(section.confidence) || 0)),
    reason: String(section.reason || '').substring(0, 200)
  })).filter(s => s.sectionId);

  return validated;
}

function isRateLimitError(error) {
  const message = error?.message?.toLowerCase() || '';
  const status = error?.status || error?.statusCode || error?.response?.status;
  return (
    status === 413 ||
    status === 429 ||
    message.includes('rate limit') ||
    message.includes('token') ||
    message.includes('too large') ||
    message.includes('request too large')
  );
}

async function callNimWithKey({ messages, model, timeoutMs, jobId, keyInfo }) {
  const pool = getNimKeyPool();

  try {
    const responseData = await callNimChatCompletion({
      apiKey: keyInfo.key,
      model,
      messages,
      maxTokens: 2048,
      temperature: 0.3,
      timeoutMs
    });

    const content = extractNimContent(responseData);

    if (pool) pool.recordSuccess(keyInfo.keyIndex);

    return { content, keyInfo };
  } catch (error) {
    const isRateLimit = isRateLimitError(error);
    if (pool) pool.recordFailure(keyInfo.keyIndex, isRateLimit);
    throw error;
  }
}

async function analyze({
  commitHash,
  commitMessage,
  author,
  diff,
  filesChanged,
  projectContext,
  templateSections,
  onProgress,
  jobId
}) {
  const timeoutMs = Math.max(getTimeoutFromEnv(60000), 60000);

  // Token-aware chunking
  if (diff && diff.length > CHUNKING_THRESHOLD) {
    console.log(`[Analyzer] Large diff detected (${diff.length} chars), using chunked analysis`);
    return analyzeChunked({
      commitHash, commitMessage, author, diff,
      filesChanged, projectContext, templateSections, onProgress, jobId
    });
  }

  const userPrompt = createAnalyzerUserPrompt({
    commitHash, commitMessage, author, diff, filesChanged, projectContext, templateSections
  });

  const messages = [
    { role: 'system', content: ANALYZER_SYSTEM_PROMPT + '\n\nRespond only with valid JSON. No markdown code fences.' },
    { role: 'user', content: userPrompt }
  ];

  async function callWithKeyRotation(modelName, stageLabel) {
    const pool = getNimKeyPool();
    const poolSize = pool ? pool.getPoolSize() : 1;
    let lastError;

    for (let attempt = 0; attempt < poolSize; attempt++) {
      let keyInfo;
      if (jobId) {
        keyInfo = pool.getKeyForJob(jobId) || pool.assignKeyForJob(jobId);
      } else {
        keyInfo = await pool.getNextKey();
      }
      try {
        const result = await withTimeout(
          callNimWithKey({ messages, model: modelName, timeoutMs, jobId, keyInfo }),
          timeoutMs,
          `${stageLabel} (Key ${attempt + 1}/${poolSize})`
        );
        return result;
      } catch (error) {
        lastError = error;
        if (isRateLimitError(error) && attempt < poolSize - 1) {
          console.warn(`[Analyzer] Rate limit hit on Key ${attempt + 1}/${poolSize} for ${modelName}. Rotating key...`);
          if (jobId && pool) pool.rotateKeyForJob(jobId);
          await new Promise(resolve => setTimeout(resolve, 200));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  try {
    const result = await callWithKeyRotation(PRIMARY_MODEL, 'Analyzer Agent');
    const parsed = parseAIResponse(result.content);
    const validated = validateAnalysisResult(parsed);

    console.log(`[Analyzer] Analyzed commit ${commitHash?.substring(0, 7)}: ${validated.changeType} (${validated.impactLevel}) using ${PRIMARY_MODEL}`);

    return {
      success: true,
      ...validated,
      metadata: {
        analyzedAt: new Date(),
        model: PRIMARY_MODEL,
        commitHash,
        apiKeyUsed: result.keyInfo.masked,
        keyPoolSize: result.keyInfo.poolSize
      }
    };
  } catch (primaryError) {
    if (isRateLimitError(primaryError)) {
      console.log(`[Analyzer] All keys rate limited on ${PRIMARY_MODEL}, trying fallback model ${FALLBACK_MODEL}...`);
      try {
        const result = await callWithKeyRotation(FALLBACK_MODEL, 'Analyzer Agent (Fallback)');
        const parsed = parseAIResponse(result.content);
        const validated = validateAnalysisResult(parsed);

        console.log(`[Analyzer] Analyzed commit ${commitHash?.substring(0, 7)}: ${validated.changeType} (${validated.impactLevel}) using fallback ${FALLBACK_MODEL}`);

        return {
          success: true,
          ...validated,
          metadata: {
            analyzedAt: new Date(),
            model: FALLBACK_MODEL,
            usedFallback: true,
            commitHash,
            apiKeyUsed: result.keyInfo.masked,
            keyPoolSize: result.keyInfo.poolSize
          }
        };
      } catch (fallbackError) {
        console.error(`[Analyzer] Fallback model also failed across all keys:`, fallbackError.message);
        throw fallbackError;
      }
    }

    console.error(`[Analyzer] Error analyzing commit ${commitHash?.substring(0, 7)}:`, primaryError.message);

    if (primaryError instanceof TimeoutError) {
      return {
        success: false,
        error: 'Analysis timed out',
        errorCode: 'TIMEOUT',
        ...DEFAULT_ANALYSIS,
        technicalSummary: `Commit ${commitHash?.substring(0, 7)}: ${commitMessage}`,
        metadata: {
          analyzedAt: new Date(),
          error: primaryError.message
        }
      };
    }

    return {
      success: false,
      error: primaryError.message,
      errorCode: 'AI_ERROR',
      ...DEFAULT_ANALYSIS,
      technicalSummary: `Commit: ${commitMessage || 'No message'}`,
      changeType: inferChangeTypeFromMessage(commitMessage),
      metadata: {
        analyzedAt: new Date(),
        error: primaryError.message
      }
    };
  }
}

async function analyzeChunked({
  commitHash,
  commitMessage,
  author,
  diff,
  filesChanged,
  projectContext,
  templateSections,
  onProgress,
  jobId
}) {
  const timeoutMs = getTimeoutFromEnv(45000);
  const chunks = chunkDiff(diff);
  console.log(`[Analyzer] Processing ${chunks.length} chunks for commit ${commitHash?.substring(0, 7)}${jobId ? ` (job: ${jobId.substring(0, 8)})` : ''}`);

  const analyses = [];
  let successfulChunks = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    if (jobId && await webhookQueue.isJobAborted(jobId)) {
      console.log(`[Analyzer] Job ${jobId.substring(0, 8)} was aborted. Stopping chunked analysis.`);
      throw new Error('JOB_ABORTED');
    }

    if (onProgress) {
      onProgress({ stage: 'analyzing', current: i + 1, total: chunks.length, chunkFiles: chunk.files });
    }

    console.log(`[Analyzer] Processing chunk ${i + 1}/${chunks.length} (${chunk.content.length} chars, files: ${chunk.files?.join(', ') || 'N/A'})`);

    try {
      const userPrompt = createChunkedAnalyzerPrompt({
        commitHash, commitMessage, author,
        chunkContent: chunk.content,
        chunkIndex: chunk.index,
        totalChunks: chunk.total,
        chunkFiles: chunk.files,
        filesChanged, projectContext, templateSections
      });

      const messages = [
        { role: 'system', content: ANALYZER_SYSTEM_PROMPT + '\n\nThis is a CHUNKED analysis. Focus on the content provided in this chunk. Respond only with valid JSON. No markdown code fences.' },
        { role: 'user', content: userPrompt }
      ];

      let chatCompletion;
      const pool = getNimKeyPool();
      const poolSize = pool ? pool.getPoolSize() : 1;
      let lastError;

      for (let attempt = 0; attempt < poolSize; attempt++) {
        let keyInfo;
        if (jobId) {
          keyInfo = pool.getKeyForJob(jobId) || pool.assignKeyForJob(jobId);
        } else {
          keyInfo = await pool.getNextKey();
        }
        try {
          const result = await withTimeout(
            callNimWithKey({ messages, model: PRIMARY_MODEL, timeoutMs, jobId, keyInfo }),
            timeoutMs,
            `Analyzer Agent (Chunk ${i + 1}, Key ${attempt + 1}/${poolSize})`
          );
          chatCompletion = result;
          break;
        } catch (error) {
          lastError = error;
          if (isRateLimitError(error) && attempt < poolSize - 1) {
            console.warn(`[Analyzer] Rate limit hit on Chunk ${i + 1}, Key ${attempt + 1}/${poolSize}. Rotating key...`);
            if (jobId && pool) pool.rotateKeyForJob(jobId);
            await new Promise(resolve => setTimeout(resolve, 200));
            continue;
          }
          throw error;
        }
      }

      const content = chatCompletion.content || '{}';
      const parsed = parseAIResponse(content);
      const validated = validateAnalysisResult(parsed);

      analyses.push({ success: true, ...validated });
      successfulChunks++;

    } catch (chunkError) {
      console.error(`[Analyzer] Error processing chunk ${i + 1}:`, chunkError.message);
      analyses.push({ success: false, error: chunkError.message });
    }

    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const successfulAnalyses = analyses.filter(a => a.success);

  if (successfulAnalyses.length === 0) {
    console.error('[Analyzer] All chunks failed');
    return {
      success: false,
      error: 'All chunk analyses failed',
      errorCode: 'CHUNKING_FAILED',
      ...DEFAULT_ANALYSIS,
      technicalSummary: `Commit ${commitHash?.substring(0, 7)}: ${commitMessage}`,
      metadata: {
        analyzedAt: new Date(),
        chunksAttempted: chunks.length,
        chunksSuccessful: 0
      }
    };
  }

  const mergedResult = mergeChunkAnalyses(successfulAnalyses);
  console.log(`[Analyzer] Merged ${successfulChunks}/${chunks.length} chunk analyses`);

  return {
    ...mergedResult,
    metadata: {
      ...mergedResult.metadata,
      commitHash,
      chunksProcessed: successfulChunks,
      totalChunks: chunks.length,
      usedChunking: true
    }
  };
}

function inferChangeTypeFromMessage(message) {
  if (!message) return 'unknown';
  const msg = message.toLowerCase();
  if (msg.includes('fix') || msg.includes('bug') || msg.includes('patch')) return 'bugfix';
  if (msg.includes('feat') || msg.includes('add') || msg.includes('new')) return 'feature';
  if (msg.includes('refactor') || msg.includes('clean') || msg.includes('improve')) return 'refactor';
  if (msg.includes('doc') || msg.includes('readme') || msg.includes('comment')) return 'docs';
  if (msg.includes('test') || msg.includes('spec')) return 'test';
  if (msg.includes('config') || msg.includes('env') || msg.includes('setup')) return 'config';
  return 'unknown';
}

function quickAnalyze(commitMessage, filesChanged) {
  return {
    success: true,
    changeType: inferChangeTypeFromMessage(commitMessage),
    impactLevel: 'patch',
    entities: filesChanged.slice(0, 5).map(f => ({
      type: 'file',
      name: f.split('/').pop(),
      action: 'modified',
      file: f,
      description: ''
    })),
    semanticTags: ['general'],
    technicalSummary: commitMessage || 'No description',
    suggestedSections: [],
    metadata: {
      analyzedAt: new Date(),
      model: 'quick-inference',
      isQuickAnalysis: true
    }
  };
}

module.exports = {
  analyze,
  analyzeChunked,
  quickAnalyze,
  parseAIResponse,
  validateAnalysisResult,
  inferChangeTypeFromMessage,
  DEFAULT_ANALYSIS
};
