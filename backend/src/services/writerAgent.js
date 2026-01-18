/**
 * Writer Agent
 * 
 * Stage 2 of the AI pipeline. Generates academic-style prose
 * for report sections based on analysis results.
 * 
 * Uses Groq API with Llama 3 for generous rate limits (30 req/min free tier)
 */

const Groq = require('groq-sdk');
const { withTimeout, getTimeoutFromEnv, TimeoutError } = require('./timeout');
const { WRITER_SYSTEM_PROMPT, createWriterUserPrompt, createSectionIntroPrompt } = require('../prompts/writerPrompt');
const { MODELS, getGroqKeyPool } = require('../utils/aiConfig');
const { webhookQueue, JOB_STATUS } = require('./queue');

// Model configuration - primary and fallback models from shared config
const PRIMARY_MODEL = MODELS.WRITER.PRIMARY;
const FALLBACK_MODEL = MODELS.WRITER.FALLBACK;

/**
 * Get a Groq client with an API key.
 * If jobId is provided, uses job-level key assignment (same key for entire job).
 * Otherwise falls back to random key selection.
 * @param {string} [jobId] - Optional job ID for consistent key usage within a job
 * @returns {Promise<Object>} - { client: Groq, keyInfo: { keyIndex, masked, poolSize } }
 */
async function getClientWithKey(jobId = null) {
  const pool = getGroqKeyPool();
  if (!pool) {
    throw new Error('GROQ_API_KEYS environment variable is not set.');
  }
  
  let keyInfo;
  if (jobId) {
    // Use job-level key assignment - same key for all calls in this job
    keyInfo = pool.getKeyForJob(jobId) || pool.assignKeyForJob(jobId);
  } else {
    // Fallback to random selection for standalone calls
    keyInfo = await pool.getNextKey();
  }
  
  const client = new Groq({
    apiKey: keyInfo.key
  });
  
  return { client, keyInfo };
}

/**
 * Parse JSON from AI response, handling common issues
 * @param {string} text - Raw response text
 * @returns {Object} - Parsed JSON object
 */
function parseWriterResponse(text) {
  let cleaned = text.trim();
  
  // Remove markdown code fences if present
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
    const parsed = JSON.parse(cleaned);
    
    // Handle nested 'content' objects (some models do this despite instructions)
    if (parsed.content && typeof parsed.content === 'object') {
      console.warn('[Writer] AI returned nested content object, flattening...');
      
      // If it's something like { "Database Design": { "intro": "..." } }
      function flattenObject(obj, depth = 0) {
        let text = '';
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object' && value !== null) {
            text += `${'#'.repeat(depth + 1)} ${key}\n\n${flattenObject(value, depth + 1)}\n\n`;
          } else {
            text += `${'#'.repeat(depth + 1)} ${key}\n\n${value}\n\n`;
          }
        }
        return text.trim();
      }
      
      parsed.content = flattenObject(parsed.content);
    }
    
    return parsed;
  } catch (error) {
    // Try to extract JSON from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const extracted = JSON.parse(jsonMatch[0]);
        // Apply same flattening logic to extracted JSON
        if (extracted.content && typeof extracted.content === 'object') {
          console.warn('[Writer] AI returned nested content object in extracted JSON, flattening...');
          
          function flattenObject(obj, depth = 0) {
            let text = '';
            for (const [key, value] of Object.entries(obj)) {
              if (typeof value === 'object' && value !== null) {
                text += `${'#'.repeat(depth + 1)} ${key}\n${flattenObject(value, depth + 1)}\n\n`;
              } else {
                text += `${'#'.repeat(depth + 1)} ${key}\n${value}\n\n`;
              }
            }
            return text.trim();
          }
          extracted.content = flattenObject(extracted.content);
        }
        return extracted;
      } catch (e) { /* ignore and fallback */ }
    }
    
    // If no JSON found, treat the whole response as content
    return {
      content: cleaned,
      insertPosition: 'append',
      highlights: [],
      suggestedFollowUp: null
    };
  }
}

/**
 * Validate and normalize writer result
 * @param {Object} result - Writer result to validate
 * @param {Object} targetSection - Target section info
 * @returns {Object} - Validated result
 */
function validateWriterResult(result, targetSection) {
  const validated = {
    content: typeof result.content === 'string' ? result.content : '',
    insertPosition: ['append', 'prepend'].includes(result.insertPosition) 
      ? result.insertPosition 
      : 'append',
    highlights: Array.isArray(result.highlights) 
      ? result.highlights.slice(0, 5).map(h => String(h).substring(0, 200))
      : [],
    suggestedFollowUp: typeof result.suggestedFollowUp === 'string'
      ? result.suggestedFollowUp.substring(0, 300)
      : null,
    sectionId: targetSection.id,
    sectionTitle: targetSection.title,
    wordCount: 0
  };

  // Calculate word count
  validated.wordCount = validated.content.trim().split(/\s+/).filter(Boolean).length;

  // Enforce length limits from style config
  const style = targetSection.style || {};
  const maxLength = style.maxLength || 500;
  
  if (validated.wordCount > maxLength * 1.5) {
    // Truncate to approximate max length
    const words = validated.content.split(/\s+/);
    validated.content = words.slice(0, maxLength).join(' ') + '...';
    validated.wordCount = maxLength;
  }

  return validated;
}

/**
 * Generate content for a report section
 * @param {Object} params
 * @param {Object} params.analysisResult - Output from Analyzer Agent
 * @param {Object} params.targetSection - Target section configuration
 * @param {Object} params.projectMetadata - Project information
 * @param {Object} params.commitInfo - Commit information
 * @param {string} [params.jobId] - Optional job ID for consistent key usage
 * @returns {Promise<Object>} - Generated content
 */
async function generate({
  analysisResult,
  targetSection,
  projectMetadata,
  commitInfo,
  authorInfo,
  repoContext, // Optional: for initial generation
  allSections,  // Optional: template sections for context
  jobId        // Optional job ID for key assignment
}) {
  // Force a higher timeout for writer agent regardless of global env settings if they are too low
  const timeoutMs = Math.max(getTimeoutFromEnv(120000), 120000); 

  const sectionTitle = targetSection.title || targetSection.name || "Report Section";

  // Helper function to call the API with a specific model
  async function callWithModel(modelName) {
    const { client, keyInfo } = await getClientWithKey(jobId);
    const pool = getGroqKeyPool();

    try {
      const userPrompt = createWriterUserPrompt({
        analysisResult,
        targetSection,
        projectMetadata,
        commitInfo,
        authorInfo,
        repoContext,
        allSections
      });

      const chatCompletion = await client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: WRITER_SYSTEM_PROMPT + '\n\nRespond only with valid JSON. No markdown code fences.'
          },
          {
            role: 'user',
            content: userPrompt
          }
        ],
        model: modelName,
        temperature: 0.7,
        max_tokens: 4096,
        response_format: { type: 'json_object' }
      });

      if (pool) pool.recordSuccess(keyInfo.keyIndex);
      
      return {
        content: chatCompletion.choices[0]?.message?.content || '{}',
        keyInfo
      };
    } catch (error) {
      const isRateLimit = error?.status === 429 || error?.message?.toLowerCase().includes('rate limit');
      if (pool) pool.recordFailure(keyInfo.keyIndex, isRateLimit);
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

  // Helper function to call the API with retries across different keys
  async function callWithKeyRotation(modelName, stageLabel) {
    const pool = getGroqKeyPool();
    const poolSize = pool ? pool.getPoolSize() : 1;
    let lastError;

    for (let attempt = 0; attempt < poolSize; attempt++) {
      try {
        return await withTimeout(
          callWithModel(modelName),
          timeoutMs,
          `${stageLabel} (Key ${attempt + 1}/${poolSize})`
        );
      } catch (error) {
        lastError = error;
        // If it's a rate limit error and we have more keys to try, rotate and continue
        if (isRateLimitError(error) && attempt < poolSize - 1) {
          console.warn(`[Writer] Rate limit hit on Key ${attempt + 1}/${poolSize} for ${modelName}. Rotating key...`);
          if (jobId && pool) {
            pool.rotateKeyForJob(jobId);
          }
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 200));
          continue;
        }
        // For other errors or if we've exhausted all keys, throw the error
        throw error;
      }
    }
    throw lastError;
  }

  try {
    // Try with primary model first (across all keys)
    const result = await callWithKeyRotation(PRIMARY_MODEL, 'Writer Agent');

    // Parse and validate the response
    const parsed = parseWriterResponse(result.content);
    const validated = validateWriterResult(parsed, targetSection);

    console.log(`[Writer] Generated ${validated.wordCount} words for section "${sectionTitle}" using ${PRIMARY_MODEL}`);

    return {
      success: true,
      ...validated,
      metadata: {
        generatedAt: new Date(),
        model: PRIMARY_MODEL,
        sourceCommit: commitInfo.hash,
        apiKeyUsed: result.keyInfo.masked,
        keyPoolSize: result.keyInfo.poolSize
      }
    };

  } catch (primaryError) {
    // If it's a rate limit error (meaning ALL keys failed for primary), try fallback model
    if (isRateLimitError(primaryError)) {
      console.log(`[Writer] All keys rate limited on ${PRIMARY_MODEL}, trying fallback model ${FALLBACK_MODEL}...`);

      try {
        // Try with fallback model (across all keys)
        const result = await callWithKeyRotation(FALLBACK_MODEL, 'Writer Agent (Fallback)');

        const parsed = parseWriterResponse(result.content);
        const validated = validateWriterResult(parsed, targetSection);

        console.log(`[Writer] Generated ${validated.wordCount} words for section "${targetSection.title}" using fallback ${FALLBACK_MODEL}`);

        return {
          success: true,
          ...validated,
          metadata: {
            generatedAt: new Date(),
            model: FALLBACK_MODEL,
            usedFallback: true,
            sourceCommit: commitInfo.hash,
            apiKeyUsed: result.keyInfo.masked,
            keyPoolSize: result.keyInfo.poolSize
          }
        };

      } catch (fallbackError) {
        console.error(`[Writer] Fallback model also failed across all keys:`, fallbackError.message);
        // Continue to error handling below
        throw fallbackError;
      }
    }

    // Handle non-rate-limit errors
    console.error(`[Writer] Error generating content for "${targetSection.title}":`, primaryError.message);

    if (primaryError instanceof TimeoutError) {
      return {
        success: false,
        error: 'Content generation timed out',
        errorCode: 'TIMEOUT',
        sectionId: targetSection.id,
        sectionTitle: targetSection.title,
        content: null,
        metadata: {
          generatedAt: new Date(),
          error: primaryError.message
        }
      };
    }

    return {
      success: false,
      error: primaryError.message,
      errorCode: 'AI_ERROR',
      sectionId: targetSection.id,
      sectionTitle: targetSection.title,
      content: null,
      metadata: {
        generatedAt: new Date(),
        error: primaryError.message
      }
    };
  }
}

/**
 * Generate introduction for a new section
 * @param {Object} section - Section configuration
 * @param {Object} projectMetadata - Project information
 * @param {string} [jobId] - Optional job ID for consistent key usage
 * @returns {Promise<string>} - Introduction text
 */
async function generateSectionIntro(section, projectMetadata, jobId = null) {
  const timeoutMs = getTimeoutFromEnv(15000); // Shorter timeout for intros

  // Check for abortion
  if (jobId && await webhookQueue.isJobAborted(jobId)) {
    console.log(`[Writer] Job ${jobId.substring(0, 8)} was aborted. Stopping intro generation.`);
    throw new Error('JOB_ABORTED');
  }

  // Helper function to call the API with a specific model
  async function callWithModel(modelName) {
    const { client, keyInfo } = await getClientWithKey(jobId);
    const pool = getGroqKeyPool();
    const prompt = createSectionIntroPrompt(section, projectMetadata);

    try {
      const chatCompletion = await client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a technical writer. Generate a brief, professional introduction paragraph.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        model: modelName,
        temperature: 0.6,
        max_tokens: 500
      });

      if (pool) pool.recordSuccess(keyInfo.keyIndex);
      return chatCompletion.choices[0]?.message?.content || '';
    } catch (error) {
      const isRateLimit = error?.status === 429 || error?.message?.toLowerCase().includes('rate limit');
      if (pool) pool.recordFailure(keyInfo.keyIndex, isRateLimit);
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

  // Helper function to call the API with retries across different keys
  async function callWithKeyRotation(modelName, stageLabel) {
    const pool = getGroqKeyPool();
    const poolSize = pool ? pool.getPoolSize() : 1;
    let lastError;

    for (let attempt = 0; attempt < poolSize; attempt++) {
      try {
        return await withTimeout(
          callWithModel(modelName),
          timeoutMs,
          `${stageLabel} (Key ${attempt + 1}/${poolSize})`
        );
      } catch (error) {
        lastError = error;
        // If it's a rate limit error and we have more keys to try, rotate and continue
        if (isRateLimitError(error) && attempt < poolSize - 1) {
          console.warn(`[Writer] Rate limit hit on Key ${attempt + 1}/${poolSize} for intro. Rotating key...`);
          if (jobId && pool) {
            pool.rotateKeyForJob(jobId);
          }
          await new Promise(resolve => setTimeout(resolve, 200));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  try {
    const result = await callWithKeyRotation(PRIMARY_MODEL, 'Section Intro Generator');

    // Clean up the response (remove any JSON wrapping)
    let intro = result.trim();
    
    // Remove code fences
    if (intro.startsWith('```')) {
      intro = intro.replace(/```[^\n]*\n?/g, '').trim();
    }

    console.log(`[Writer] Generated intro for section "${section.title}" using ${PRIMARY_MODEL}`);
    return intro;

  } catch (primaryError) {
    // If it's a rate limit error, try fallback model
    if (isRateLimitError(primaryError)) {
      console.log(`[Writer] All keys rate limited on ${PRIMARY_MODEL} for intro, trying fallback model ${FALLBACK_MODEL}...`);

      try {
        const result = await callWithKeyRotation(FALLBACK_MODEL, 'Section Intro Generator (Fallback)');

        let intro = result.trim();
        if (intro.startsWith('```')) {
          intro = intro.replace(/```[^\n]*\n?/g, '').trim();
        }

        console.log(`[Writer] Generated intro for section "${section.title}" using fallback ${FALLBACK_MODEL}`);
        return intro;

      } catch (fallbackError) {
        console.error(`[Writer] Fallback model also failed for intro across all keys:`, fallbackError.message);
        return '';
      }
    }

    console.error(`[Writer] Error generating intro for "${section.title}":`, primaryError.message);
    return ''; // Return empty string on error, section can still be used
  }
}

/**
 * Select the best section for a commit based on analysis
 * @param {Object} analysisResult - Analysis result
 * @param {Array} templateSections - Available sections
 * @returns {Object|null} - Best matching section or null
 */
function selectBestSection(analysisResult, templateSections) {
  // Check if analysis has suggested sections
  if (analysisResult.suggestedSections && analysisResult.suggestedSections.length > 0) {
    // Find the highest confidence suggestion that exists in template
    const sorted = [...analysisResult.suggestedSections].sort((a, b) => b.confidence - a.confidence);
    
    for (const suggestion of sorted) {
      const section = templateSections.find(s => s.id === suggestion.sectionId);
      if (section) {
        return {
          section,
          confidence: suggestion.confidence,
          reason: suggestion.reason
        };
      }
    }
  }

  // Fallback: Match based on semantic tags and section keywords
  const tags = analysisResult.semanticTags || [];
  
  let bestMatch = null;
  let bestScore = 0;

  for (const section of templateSections) {
    const keywords = section.aiHints?.keywords || [];
    let score = 0;

    for (const tag of tags) {
      if (keywords.some(k => k.toLowerCase().includes(tag.toLowerCase()) || tag.toLowerCase().includes(k.toLowerCase()))) {
        score += 1;
      }
    }

    // Boost for change type matching
    if (analysisResult.changeType === 'feature' && section.id.includes('feature')) score += 0.5;
    if (analysisResult.changeType === 'bugfix' && section.id.includes('bug')) score += 0.5;
    if (analysisResult.changeType === 'test' && section.id.includes('test')) score += 0.5;
    if (analysisResult.changeType === 'docs' && section.id.includes('doc')) score += 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = section;
    }
  }

  // If no good match, default to implementation section
  if (!bestMatch || bestScore < 0.3) {
    bestMatch = templateSections.find(s => 
      s.id.includes('implementation') || 
      s.id.includes('feature') ||
      s.id.includes('overview')
    ) || templateSections[0];
  }

  return bestMatch ? {
    section: bestMatch,
    confidence: Math.min(1, bestScore / 2),
    reason: 'Matched by semantic tags'
  } : null;
}

/**
 * Generate content for multiple sections based on analysis
 * @param {Object} params
 * @param {Object} params.analysisResult - Analysis result
 * @param {Array} params.templateSections - Template sections
 * @param {Object} params.report - Existing report with sections
 * @param {Object} params.projectMetadata - Project metadata
 * @param {Object} params.commitInfo - Commit information
 * @param {string} [params.jobId] - Optional job ID for consistent key usage
 * @returns {Promise<Array>} - Array of generated content results
 */
async function generateForAllSections({
  analysisResult,
  templateSections,
  report,
  projectMetadata,
  commitInfo,
  authorInfo, // Add authorInfo param
  jobId       // Optional job ID for key assignment
}) {
  const results = [];

  // Get suggested sections (up to 3)
  const sectionsToUpdate = [];
  
  console.log('[Writer] Template sections available:', templateSections.map(s => s.id));
  console.log('[Writer] Analyzer suggested sections:', analysisResult.suggestedSections?.map(s => s.sectionId));
  console.log(`[Writer] Generating content for ${authorInfo?.role || 'editor'} role (${commitInfo.author})`);
  
  if (analysisResult.suggestedSections && analysisResult.suggestedSections.length > 0) {
    for (const suggestion of analysisResult.suggestedSections.slice(0, 3)) {
      // Try exact match first, then partial match
      let templateSection = templateSections.find(s => s.id === suggestion.sectionId);
      
      // If no exact match, try partial match (analyzer might return 'feature' instead of 'features')
      if (!templateSection && suggestion.sectionId) {
        templateSection = templateSections.find(s => 
          s.id.toLowerCase().includes(suggestion.sectionId.toLowerCase()) ||
          suggestion.sectionId.toLowerCase().includes(s.id.toLowerCase())
        );
      }
      
      if (templateSection) {
        const existingSection = report.sections.find(s => s.templateSectionId === templateSection.id);
        sectionsToUpdate.push({
          ...templateSection,
          id: templateSection.id, // Ensure id is preserved
          title: templateSection.title, // Ensure title is preserved
          existingContent: existingSection?.content || '',
          contentHistory: existingSection?.contributions || [], // Pass content history for context
          confidence: suggestion.confidence
        });
        console.log(`[Writer] Matched section: ${suggestion.sectionId} -> ${templateSection.id}`);
      } else {
        console.log(`[Writer] No match found for suggested section: ${suggestion.sectionId}`);
      }
    }
  }

  // If no sections from analysis, use best match
  if (sectionsToUpdate.length === 0) {
    const match = selectBestSection(analysisResult, templateSections);
    if (match) {
      const existingSection = report.sections.find(s => s.templateSectionId === match.section.id);
      sectionsToUpdate.push({
        ...match.section,
        id: match.section.id, // Ensure id is preserved
        title: match.section.title, // Ensure title is preserved
        existingContent: existingSection?.content || '',
        contentHistory: existingSection?.contributions || [], // Pass content history for context
        confidence: match.confidence
      });
      console.log(`[Writer] Fallback section selected: ${match.section.id}`);
    }
  }

  // Generate content for each section
  for (const targetSection of sectionsToUpdate) {
    // Check for abortion
    if (jobId && await webhookQueue.isJobAborted(jobId)) {
      console.log(`[Writer] Job ${jobId.substring(0, 8)} was aborted. Stopping generation.`);
      throw new Error('JOB_ABORTED');
    }

    if (!targetSection.id || !targetSection.title) {
      console.error('[Writer] Invalid section - missing id or title:', targetSection);
      continue;
    }
    
    try {
      const result = await generate({
        analysisResult,
        targetSection,
        projectMetadata,
        commitInfo,
        authorInfo, // Pass authorInfo
        allSections: templateSections, // Pass all sections for context
        jobId // Pass job ID for key assignment
      });
      
      if (result.success) {
        results.push(result);
      }
    } catch (error) {
      console.error(`[Writer] Failed to generate for section "${targetSection.title}":`, error.message);
      results.push({
        sectionId: targetSection.id,
        sectionTitle: targetSection.title,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

module.exports = {
  generate,
  generateSectionIntro,
  selectBestSection,
  generateForAllSections,
  parseWriterResponse,
  validateWriterResult
};
