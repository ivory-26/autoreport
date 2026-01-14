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
const { ANALYZER_SYSTEM_PROMPT, createAnalyzerUserPrompt } = require('../prompts/analyzerPrompt');

// Model configuration
const MODEL_NAME = 'openai/gpt-oss-120b'; // GPT-OSS 120B for superior code analysis

// Initialize Groq client
let groqClient = null;

/**
 * Initialize the Groq client
 * @throws {Error} If GROQ_API_KEY is not set
 */
function initializeClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY environment variable is not set. Get a free key at https://console.groq.com');
  }

  if (!groqClient) {
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }

  return groqClient;
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
  templateSections
}) {
  const timeoutMs = getTimeoutFromEnv(30000);

  try {
    // Initialize client if needed
    const client = initializeClient();

    // Create the prompt
    const userPrompt = createAnalyzerUserPrompt({
      commitHash,
      commitMessage,
      author,
      diff,
      filesChanged,
      projectContext,
      templateSections
    });

    // Call Groq with timeout
    const result = await withTimeout(
      (async () => {
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
          model: MODEL_NAME,
          temperature: 0.3,
          max_tokens: 2048,
          response_format: { type: 'json_object' }
        });

        return chatCompletion.choices[0]?.message?.content || '{}';
      })(),
      timeoutMs,
      'Analyzer Agent'
    );

    // Parse and validate the response
    const parsed = parseAIResponse(result);
    const validated = validateAnalysisResult(parsed);

    console.log(`[Analyzer] Analyzed commit ${commitHash?.substring(0, 7)}: ${validated.changeType} (${validated.impactLevel})`);

    return {
      success: true,
      ...validated,
      metadata: {
        analyzedAt: new Date(),
        model: MODEL_NAME,
        commitHash
      }
    };

  } catch (error) {
    console.error(`[Analyzer] Error analyzing commit ${commitHash?.substring(0, 7)}:`, error.message);

    // Return a minimal analysis for timeout or other errors
    if (error instanceof TimeoutError) {
      return {
        success: false,
        error: 'Analysis timed out',
        errorCode: 'TIMEOUT',
        ...DEFAULT_ANALYSIS,
        technicalSummary: `Commit ${commitHash?.substring(0, 7)}: ${commitMessage}`,
        metadata: {
          analyzedAt: new Date(),
          error: error.message
        }
      };
    }

    // For other errors, try to provide some basic analysis
    return {
      success: false,
      error: error.message,
      errorCode: 'AI_ERROR',
      ...DEFAULT_ANALYSIS,
      // Use commit message as fallback summary
      technicalSummary: `Commit: ${commitMessage || 'No message'}`,
      // Try to infer change type from commit message
      changeType: inferChangeTypeFromMessage(commitMessage),
      metadata: {
        analyzedAt: new Date(),
        error: error.message
      }
    };
  }
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
  quickAnalyze,
  parseAIResponse,
  validateAnalysisResult,
  inferChangeTypeFromMessage,
  DEFAULT_ANALYSIS
};
