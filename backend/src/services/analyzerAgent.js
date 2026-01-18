/**
 * Analyzer Agent
 * 
 * Stage 1 of the AI pipeline. Analyzes code diffs and extracts
 * structured information for routing to report sections.
 * 
 * Uses Groq API with Llama 3 for generous rate limits (30 req/min free tier)
 */

const Groq = require('groq-sdk');
const { withTimeout, getTimeoutFromEnv, TimeoutError } = require('./timeout');
const { ANALYZER_SYSTEM_PROMPT, createAnalyzerUserPrompt, createChunkedAnalyzerPrompt } = require('../prompts/analyzerPrompt');
const { chunkDiff, mergeChunkAnalyses, DEFAULT_CHUNK_SIZE } = require('./chunkingService');
const { MODELS, getGroqKeyPool } = require('../utils/aiConfig');

// Model configuration - primary and fallback models from shared config
const PRIMARY_MODEL = MODELS.ANALYZER.PRIMARY;
const FALLBACK_MODEL = MODELS.ANALYZER.FALLBACK;

// Maximum tokens to use for diff (leaving room for prompt and response)
const MAX_DIFF_TOKENS = 4000; // ~16000 chars assuming 4 chars per token
const CHUNKING_THRESHOLD = DEFAULT_CHUNK_SIZE; // Use chunking for diffs larger than this

/**
 * Get a Groq client with the next available API key from the shared pool
 * @returns {Promise<Object>} - { client: Groq, keyInfo: { keyIndex, masked, poolSize } }
 */
async function getClientWithKey() {
  const pool = getGroqKeyPool();
  if (!pool) {
    throw new Error('GROQ_API_KEYS environment variable is not set.');
  }
  
  const keyInfo = await pool.getNextKey();
  
  const client = new Groq({
    apiKey: keyInfo.key
  });
  
  return { client, keyInfo };
}

/**
 * Default analysis result for fallback scenarios
 */
const DEFAULT_ANALYSIS = {
  changeType: 'unknown',
  impactLevel: 'patch',
  entities: [],
  semanticTags: ['general'],
  technicalSummary: 'Unable to analyze commit changes.',
  suggestedSections: []
};

/**
 * Parse JSON from AI response, handling common issues
 * @param {string} text - Raw response text
 * @returns {Object} - Parsed JSON object
 */
function parseAIResponse(text) {
  // Remove markdown code fences if present
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
    // Try to extract JSON from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
  }
}

/**
 * Validate analysis result structure
 * @param {Object} result - Analysis result to validate
 * @returns {Object} - Validated and normalized result
 */
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

  // Validate entities
  validated.entities = validated.entities.map(entity => ({
    type: entity.type || 'unknown',
    name: String(entity.name || 'unnamed').substring(0, 100),
    action: ['created', 'modified', 'deleted'].includes(entity.action) ? entity.action : 'modified',
    file: String(entity.file || 'unknown').substring(0, 200),
    description: String(entity.description || '').substring(0, 300)
  }));

  // Validate suggested sections
  validated.suggestedSections = validated.suggestedSections.map(section => ({
    sectionId: String(section.sectionId || ''),
    confidence: Math.min(1, Math.max(0, Number(section.confidence) || 0)),
    reason: String(section.reason || '').substring(0, 200)
  })).filter(s => s.sectionId);

  return validated;
}

/**
 * Analyze a code diff and extract structured information
 * @param {Object} params
 * @param {string} params.commitHash - Commit hash
 * @param {string} params.commitMessage - Commit message
 * @param {string} params.author - Commit author
 * @param {string} params.diff - Git diff content
 * @param {Array} params.filesChanged - List of changed files
 * @param {Object} params.projectContext - Project context
 * @param {Array} params.templateSections - Template sections for routing
 * @returns {Promise<Object>} - Analysis result
 */
async function analyze({
  commitHash,
  commitMessage,
  author,
  diff,
  filesChanged,
  projectContext,
  templateSections,
  onProgress // Optional progress callback for heartbeat
}) {
  const timeoutMs = Math.max(getTimeoutFromEnv(60000), 60000);

  // Check if diff needs chunking
  if (diff && diff.length > CHUNKING_THRESHOLD) {
    console.log(`[Analyzer] Large diff detected (${diff.length} chars), using chunked analysis`);
    return analyzeChunked({
      commitHash,
      commitMessage,
      author,
      diff,
      filesChanged,
      projectContext,
      templateSections,
      onProgress
    });
  }

  // Helper function to call the API with a specific model
  async function callWithModel(modelName, diffContent) {
    const { client, keyInfo } = await getClientWithKey();
    const pool = getGroqKeyPool();

    try {
      const userPrompt = createAnalyzerUserPrompt({
        commitHash,
        commitMessage,
        author,
        diff: diffContent,
        filesChanged,
        projectContext,
        templateSections
      });

      const chatCompletion = await client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: ANALYZER_SYSTEM_PROMPT + '\n\nRespond only with valid JSON. No markdown code fences.'
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        model: modelName,
        temperature: 0.3,
        max_tokens: 2048,
        response_format: { type: 'json_object' }
      });

      // Record success
      pool.recordSuccess(keyInfo.keyIndex);
      
      return {
        content: chatCompletion.choices[0]?.message?.content || '{}',
        keyInfo
      };
    } catch (error) {
      // Check if it's a rate limit error
      const isRateLimit = error?.status === 429 || error?.message?.toLowerCase().includes('rate limit');
      pool.recordFailure(keyInfo.keyIndex, isRateLimit);
      throw error;
    }
  }

  // Check if error is a rate limit / token limit error
  function isRateLimitError(error) {
    const message = error?.message?.toLowerCase() || '';
    const status = error?.status || error?.statusCode;
    return (
      status === 413 ||
      status === 429 ||
      message.includes('rate limit') ||
      message.includes('token') ||
      message.includes('too large') ||
      message.includes('request too large')
    );
  }

  let usedModel = PRIMARY_MODEL;

  try {
    // Try with primary model first
    const result = await withTimeout(
      callWithModel(PRIMARY_MODEL, diff),
      timeoutMs,
      'Analyzer Agent'
    );

    // Parse and validate the response
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
    // If it's a rate limit error, try fallback model
    if (isRateLimitError(primaryError)) {
      console.log(`[Analyzer] Rate limit hit on ${PRIMARY_MODEL}, trying fallback model ${FALLBACK_MODEL}...`);
      usedModel = FALLBACK_MODEL;

      try {
        const result = await withTimeout(
          callWithModel(FALLBACK_MODEL, diff),
          timeoutMs,
          'Analyzer Agent (Fallback)'
        );

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
        console.error(`[Analyzer] Fallback model also failed:`, fallbackError.message);
        // Continue to error handling below
        throw fallbackError;
      }
    }

    // Handle non-rate-limit errors
    console.error(`[Analyzer] Error analyzing commit ${commitHash?.substring(0, 7)}:`, primaryError.message);

    // Return a minimal analysis for timeout or other errors
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

    // For other errors, try to provide some basic analysis
    return {
      success: false,
      error: primaryError.message,
      errorCode: 'AI_ERROR',
      ...DEFAULT_ANALYSIS,
      // Use commit message as fallback summary
      technicalSummary: `Commit: ${commitMessage || 'No message'}`,
      // Try to infer change type from commit message
      changeType: inferChangeTypeFromMessage(commitMessage),
      metadata: {
        analyzedAt: new Date(),
        error: primaryError.message
      }
    };
  }
}

/**
 * Analyze a large diff using chunking
 * @param {Object} params - Same as analyze params
 * @returns {Promise<Object>} - Merged analysis result
 */
async function analyzeChunked({
  commitHash,
  commitMessage,
  author,
  diff,
  filesChanged,
  projectContext,
  templateSections,
  onProgress
}) {
  const timeoutMs = getTimeoutFromEnv(45000); // Longer timeout for chunks

  // Chunk the diff
  const chunks = chunkDiff(diff);
  console.log(`[Analyzer] Processing ${chunks.length} chunks for commit ${commitHash?.substring(0, 7)}`);

  const analyses = [];
  let successfulChunks = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    
    // Send progress update
    if (onProgress) {
      onProgress({
        stage: 'analyzing',
        current: i + 1,
        total: chunks.length,
        chunkFiles: chunk.files
      });
    }

    console.log(`[Analyzer] Processing chunk ${i + 1}/${chunks.length} (${chunk.content.length} chars, files: ${chunk.files?.join(', ') || 'N/A'})`);

    try {
      const userPrompt = createChunkedAnalyzerPrompt({
        commitHash,
        commitMessage,
        author,
        chunkContent: chunk.content,
        chunkIndex: chunk.index,
        totalChunks: chunk.total,
        chunkFiles: chunk.files,
        filesChanged,
        projectContext,
        templateSections
      });

      const { client, keyInfo } = await getClientWithKey();
      const pool = getGroqKeyPool();

      const chatCompletion = await withTimeout(
        (async () => {
          try {
            const completion = await client.chat.completions.create({
              messages: [
                {
                  role: 'system',
                  content: ANALYZER_SYSTEM_PROMPT + '\n\nThis is a CHUNKED analysis. Focus on the content provided in this chunk. Respond only with valid JSON. No markdown code fences.'
                },
                {
                  role: 'user',
                  content: userPrompt
                }
              ],
              model: PRIMARY_MODEL,
              temperature: 0.3,
              max_tokens: 2048,
              response_format: { type: 'json_object' }
            });
            
            pool.recordSuccess(keyInfo.keyIndex);
            return completion;
          } catch (error) {
            const isRateLimit = error?.status === 429 || error?.message?.toLowerCase().includes('rate limit');
            pool.recordFailure(keyInfo.keyIndex, isRateLimit);
            throw error;
          }
        })(),
        timeoutMs,
        `Analyzer Agent (Chunk ${i + 1})`
      );

      const content = chatCompletion.choices[0]?.message?.content || '{}';
      const parsed = parseAIResponse(content);
      const validated = validateAnalysisResult(parsed);

      analyses.push({
        success: true,
        ...validated
      });
      successfulChunks++;

    } catch (chunkError) {
      console.error(`[Analyzer] Error processing chunk ${i + 1}:`, chunkError.message);
      // Continue with other chunks even if one fails
      analyses.push({
        success: false,
        error: chunkError.message
      });
    }

    // Small delay between chunks to avoid rate limiting
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Merge all successful analyses
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

/**
 * Infer change type from commit message (fallback)
 * @param {string} message - Commit message
 * @returns {string} - Inferred change type
 */
function inferChangeTypeFromMessage(message) {
  if (!message) return 'unknown';
  
  const msg = message.toLowerCase();
  
  if (msg.includes('fix') || msg.includes('bug') || msg.includes('patch')) {
    return 'bugfix';
  }
  if (msg.includes('feat') || msg.includes('add') || msg.includes('new')) {
    return 'feature';
  }
  if (msg.includes('refactor') || msg.includes('clean') || msg.includes('improve')) {
    return 'refactor';
  }
  if (msg.includes('doc') || msg.includes('readme') || msg.includes('comment')) {
    return 'docs';
  }
  if (msg.includes('test') || msg.includes('spec')) {
    return 'test';
  }
  if (msg.includes('config') || msg.includes('env') || msg.includes('setup')) {
    return 'config';
  }
  
  return 'unknown';
}

/**
 * Quick analysis for simple commits (faster, less detailed)
 * @param {string} commitMessage - Commit message
 * @param {Array} filesChanged - List of changed files
 * @returns {Object} - Quick analysis result
 */
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
