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

// Model configuration  
const MODEL_NAME = 'qwen/qwen3-32b'; // Qwen3-32B for creative technical writing

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
    return JSON.parse(cleaned);
  } catch (error) {
    // Try to extract JSON from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
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
 * @returns {Promise<Object>} - Generated content
 */
async function generate({
  analysisResult,
  targetSection,
  projectMetadata,
  commitInfo
}) {
  const timeoutMs = getTimeoutFromEnv(30000);

  try {
    const client = initializeClient();

    // Create the prompt
    const userPrompt = createWriterUserPrompt({
      analysisResult,
      targetSection,
      projectMetadata,
      commitInfo
    });

    // Call Groq with timeout
    const result = await withTimeout(
      (async () => {
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
          model: MODEL_NAME,
          temperature: 0.7,
          max_tokens: 4096,
          response_format: { type: 'json_object' }
        });

        return chatCompletion.choices[0]?.message?.content || '{}';
      })(),
      timeoutMs,
      'Writer Agent'
    );

    // Parse and validate the response
    const parsed = parseWriterResponse(result);
    const validated = validateWriterResult(parsed, targetSection);

    console.log(`[Writer] Generated ${validated.wordCount} words for section "${targetSection.title}"`);

    return {
      success: true,
      ...validated,
      metadata: {
        generatedAt: new Date(),
        model: MODEL_NAME,
        sourceCommit: commitInfo.hash
      }
    };

  } catch (error) {
    console.error(`[Writer] Error generating content for "${targetSection.title}":`, error.message);

    if (error instanceof TimeoutError) {
      return {
        success: false,
        error: 'Content generation timed out',
        errorCode: 'TIMEOUT',
        sectionId: targetSection.id,
        sectionTitle: targetSection.title,
        content: null,
        metadata: {
          generatedAt: new Date(),
          error: error.message
        }
      };
    }

    return {
      success: false,
      error: error.message,
      errorCode: 'AI_ERROR',
      sectionId: targetSection.id,
      sectionTitle: targetSection.title,
      content: null,
      metadata: {
        generatedAt: new Date(),
        error: error.message
      }
    };
  }
}

/**
 * Generate introduction for a new section
 * @param {Object} section - Section configuration
 * @param {Object} projectMetadata - Project information
 * @returns {Promise<string>} - Introduction text
 */
async function generateSectionIntro(section, projectMetadata) {
  const timeoutMs = getTimeoutFromEnv(15000); // Shorter timeout for intros

  try {
    const client = initializeClient();

    const prompt = createSectionIntroPrompt(section, projectMetadata);

    const result = await withTimeout(
      (async () => {
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
          model: MODEL_NAME,
          temperature: 0.6,
          max_tokens: 500
        });

        return chatCompletion.choices[0]?.message?.content || '';
      })(),
      timeoutMs,
      'Section Intro Generator'
    );

    // Clean up the response (remove any JSON wrapping)
    let intro = result.trim();
    
    // Remove code fences
    if (intro.startsWith('```')) {
      intro = intro.replace(/```[^\n]*\n?/g, '').trim();
    }

    console.log(`[Writer] Generated intro for section "${section.title}"`);
    return intro;

  } catch (error) {
    console.error(`[Writer] Error generating intro for "${section.title}":`, error.message);
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
 * @returns {Promise<Array>} - Array of generated content results
 */
async function generateForAllSections({
  analysisResult,
  templateSections,
  report,
  projectMetadata,
  commitInfo
}) {
  const results = [];

  // Get suggested sections (up to 3)
  const sectionsToUpdate = [];
  
  console.log('[Writer] Template sections available:', templateSections.map(s => s.id));
  console.log('[Writer] Analyzer suggested sections:', analysisResult.suggestedSections?.map(s => s.sectionId));
  
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
        confidence: match.confidence
      });
      console.log(`[Writer] Fallback section selected: ${match.section.id}`);
    }
  }

  // Generate content for each section
  for (const targetSection of sectionsToUpdate) {
    if (!targetSection.id || !targetSection.title) {
      console.error('[Writer] Invalid section - missing id or title:', targetSection);
      continue;
    }
    
    const result = await generate({
      analysisResult,
      targetSection,
      projectMetadata,
      commitInfo
    });
    results.push(result);
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
