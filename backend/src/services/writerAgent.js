/**
 * Writer Agent
 *
 * Stage 2 of the AI pipeline. Generates academic-style prose
 * for report sections based on analysis results.
 *
 * Uses NVIDIA NIM API (moonshotai/kimi-k2.6).
 */

const { withTimeout, getTimeoutFromEnv, TimeoutError } = require('./timeout');
const { WRITER_SYSTEM_PROMPT, createWriterUserPrompt, createSectionIntroPrompt } = require('../prompts/writerPrompt');
const { MODELS, getNimKeyPool } = require('../utils/aiConfig');
const { callNimChatCompletion, extractNimContent } = require('../utils/nimClient');
const { webhookQueue } = require('./queue');

const PRIMARY_MODEL = MODELS.WRITER.PRIMARY;
const FALLBACK_MODEL = MODELS.WRITER.FALLBACK;

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

async function callNimWithKey({ messages, model, timeoutMs, jobId, keyInfo, maxTokens = 4096, temperature = 0.7 }) {
  const pool = getNimKeyPool();
  try {
    const responseData = await callNimChatCompletion({
      apiKey: keyInfo.key,
      model,
      messages,
      maxTokens,
      temperature,
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

function parseWriterResponse(text) {
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
    const parsed = JSON.parse(cleaned);

    if (parsed.content && typeof parsed.content === 'object') {
      console.warn('[Writer] AI returned nested content object, flattening...');

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
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const extracted = JSON.parse(jsonMatch[0]);
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

    return {
      content: cleaned,
      insertPosition: 'append',
      highlights: [],
      suggestedFollowUp: null
    };
  }
}

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

  validated.wordCount = validated.content.trim().split(/\s+/).filter(Boolean).length;

  const style = targetSection.style || {};
  const maxLength = style.maxLength || 500;

  if (validated.wordCount > maxLength * 1.5) {
    const words = validated.content.split(/\s+/);
    validated.content = words.slice(0, maxLength).join(' ') + '...';
    validated.wordCount = maxLength;
  }

  return validated;
}

async function generate({
  analysisResult, targetSection, projectMetadata, commitInfo, authorInfo,
  repoContext, allSections, jobId
}) {
  const timeoutMs = Math.max(getTimeoutFromEnv(120000), 120000);
  const sectionTitle = targetSection.title || targetSection.name || "Report Section";

  const userPrompt = createWriterUserPrompt({
    analysisResult, targetSection, projectMetadata, commitInfo, authorInfo, repoContext, allSections
  });

  const messages = [
    { role: 'system', content: WRITER_SYSTEM_PROMPT + '\n\nRespond only with valid JSON. No markdown code fences.' },
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
        const isTimeout = error instanceof TimeoutError;
        if ((isRateLimitError(error) || isTimeout) && attempt < poolSize - 1) {
          const reason = isTimeout ? 'timeout' : 'rate limit';
          console.warn(`[Writer] ${reason} on Key ${attempt + 1}/${poolSize} for ${modelName}. Rotating key...`);
          if (jobId && pool) pool.rotateKeyForJob(jobId);
          await new Promise(resolve => setTimeout(resolve, isTimeout ? 500 : 200));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  try {
    const result = await callWithKeyRotation(PRIMARY_MODEL, 'Writer Agent');
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
    if (isRateLimitError(primaryError)) {
      console.log(`[Writer] All keys rate limited on ${PRIMARY_MODEL}, trying fallback model ${FALLBACK_MODEL}...`);

      try {
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
        throw fallbackError;
      }
    }

    console.error(`[Writer] Error generating content for "${targetSection.title}":`, primaryError.message);

    if (primaryError instanceof TimeoutError) {
      return {
        success: false,
        error: 'Content generation timed out',
        errorCode: 'TIMEOUT',
        sectionId: targetSection.id,
        sectionTitle: targetSection.title,
        content: null,
        metadata: { generatedAt: new Date(), error: primaryError.message }
      };
    }

    return {
      success: false,
      error: primaryError.message,
      errorCode: 'AI_ERROR',
      sectionId: targetSection.id,
      sectionTitle: targetSection.title,
      content: null,
      metadata: { generatedAt: new Date(), error: primaryError.message }
    };
  }
}

async function generateSectionIntro(section, projectMetadata, jobId = null) {
  const timeoutMs = getTimeoutFromEnv(15000);

  if (jobId && await webhookQueue.isJobAborted(jobId)) {
    console.log(`[Writer] Job ${jobId.substring(0, 8)} was aborted. Stopping intro generation.`);
    throw new Error('JOB_ABORTED');
  }

  const prompt = createSectionIntroPrompt(section, projectMetadata);
  const messages = [
    { role: 'system', content: 'You are a technical writer. Generate a brief, professional introduction paragraph.' },
    { role: 'user', content: prompt }
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
          callNimWithKey({ messages, model: modelName, timeoutMs, jobId, keyInfo, maxTokens: 500, temperature: 0.6 }),
          timeoutMs,
          `${stageLabel} (Key ${attempt + 1}/${poolSize})`
        );
        return result.content;
      } catch (error) {
        lastError = error;
        if (isRateLimitError(error) && attempt < poolSize - 1) {
          console.warn(`[Writer] Rate limit hit on Key ${attempt + 1}/${poolSize} for intro. Rotating key...`);
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
    const result = await callWithKeyRotation(PRIMARY_MODEL, 'Section Intro Generator');
    let intro = result.trim();
    if (intro.startsWith('```')) {
      intro = intro.replace(/```[^\n]*\n?/g, '').trim();
    }

    console.log(`[Writer] Generated intro for section "${section.title}" using ${PRIMARY_MODEL}`);
    return intro;

  } catch (primaryError) {
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
    return '';
  }
}

function selectBestSection(analysisResult, templateSections) {
  if (analysisResult.suggestedSections && analysisResult.suggestedSections.length > 0) {
    const sorted = [...analysisResult.suggestedSections].sort((a, b) => b.confidence - a.confidence);
    for (const suggestion of sorted) {
      const section = templateSections.find(s => s.id === suggestion.sectionId);
      if (section) {
        return { section, confidence: suggestion.confidence, reason: suggestion.reason };
      }
    }
  }

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

    if (analysisResult.changeType === 'feature' && section.id.includes('feature')) score += 0.5;
    if (analysisResult.changeType === 'bugfix' && section.id.includes('bug')) score += 0.5;
    if (analysisResult.changeType === 'test' && section.id.includes('test')) score += 0.5;
    if (analysisResult.changeType === 'docs' && section.id.includes('doc')) score += 0.5;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = section;
    }
  }

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

async function generateForAllSections({
  analysisResult, templateSections, report, projectMetadata, commitInfo, authorInfo, jobId
}) {
  const results = [];
  console.log('[Writer] Template sections available:', templateSections.map(s => s.id));
  console.log('[Writer] Analyzer suggested sections:', analysisResult.suggestedSections?.map(s => s.sectionId));
  console.log(`[Writer] Generating content for ${authorInfo?.role || 'editor'} role (${commitInfo.author})`);

  const sectionsToUpdate = [];

  if (analysisResult.suggestedSections && analysisResult.suggestedSections.length > 0) {
    for (const suggestion of analysisResult.suggestedSections.slice(0, 3)) {
      let templateSection = templateSections.find(s => s.id === suggestion.sectionId);
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
          id: templateSection.id,
          title: templateSection.title,
          existingContent: existingSection?.content || '',
          contentHistory: existingSection?.contributions || [],
          confidence: suggestion.confidence
        });
        console.log(`[Writer] Matched section: ${suggestion.sectionId} -> ${templateSection.id}`);
      } else {
        console.log(`[Writer] No match found for suggested section: ${suggestion.sectionId}`);
      }
    }
  }

  if (sectionsToUpdate.length === 0) {
    const match = selectBestSection(analysisResult, templateSections);
    if (match) {
      const existingSection = report.sections.find(s => s.templateSectionId === match.section.id);
      sectionsToUpdate.push({
        ...match.section,
        id: match.section.id,
        title: match.section.title,
        existingContent: existingSection?.content || '',
        contentHistory: existingSection?.contributions || [],
        confidence: match.confidence
      });
      console.log(`[Writer] Fallback section selected: ${match.section.id}`);
    }
  }

  for (const targetSection of sectionsToUpdate) {
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
        analysisResult, targetSection, projectMetadata, commitInfo, authorInfo,
        repoContext: null, allSections: templateSections, jobId
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
