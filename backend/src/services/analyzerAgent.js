/**
 * Analyzer Agent
 * 
 * Stage 1 of the AI pipeline. Analyzes code diffs and extracts
 * structured information for routing to report sections.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { withTimeout, getTimeoutFromEnv, TimeoutError } = require('./timeout');
const { ANALYZER_SYSTEM_PROMPT, createAnalyzerUserPrompt } = require('../prompts/analyzerPrompt');

// Initialize Gemini client
let genAI = null;
let model = null;

/**
 * Initialize the Gemini client
 * @throws {Error} If GEMINI_API_KEY is not set
 */
function initializeClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.3, // Lower temperature for more consistent analysis
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048
      }
    });
  }

  return model;
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
    const geminiModel = initializeClient();

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

    // Call Gemini with timeout
    const result = await withTimeout(
      (async () => {
        const chat = geminiModel.startChat({
          history: [
            {
              role: 'user',
              parts: [{ text: 'You are a code analyzer. Respond only with valid JSON.' }]
            },
            {
              role: 'model',
              parts: [{ text: 'Understood. I will analyze code and respond with valid JSON only.' }]
            }
          ]
        });

        const response = await chat.sendMessage([
          { text: ANALYZER_SYSTEM_PROMPT },
          { text: userPrompt }
        ]);

        return response.response.text();
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
        model: 'gemini-1.5-flash',
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
