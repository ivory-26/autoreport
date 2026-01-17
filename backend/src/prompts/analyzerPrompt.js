/**
 * System prompt for the Analyzer Agent
 * 
 * This agent analyzes code diffs and extracts structured information
 * about what changed, including entities, semantic tags, and section suggestions.
 */

// Maximum characters for diff (roughly 4 chars per token, targeting ~3500 tokens)
const MAX_DIFF_CHARS = 14000;

/**
 * Truncates a diff to fit within token limits while preserving useful content
 * @param {string} diff - The full diff content
 * @returns {string} - Truncated diff
 */
function truncateDiff(diff) {
  if (!diff || diff.length <= MAX_DIFF_CHARS) {
    return diff || '';
  }

  // Split by file changes
  const fileChunks = diff.split(/^diff --git/m);
  
  // Always include the first chunk (if it exists and isn't empty)
  let result = '';
  let currentLength = 0;
  
  for (const chunk of fileChunks) {
    if (!chunk.trim()) continue;
    
    const fullChunk = chunk.startsWith(' ') ? 'diff --git' + chunk : chunk;
    
    if (currentLength + fullChunk.length <= MAX_DIFF_CHARS) {
      result += (result ? '\ndiff --git' : '') + chunk;
      currentLength += fullChunk.length;
    } else {
      // Add truncation notice
      result += '\n\n[... DIFF TRUNCATED - Additional files changed but not shown due to size limits ...]';
      break;
    }
  }
  
  return result;
}

const ANALYZER_SYSTEM_PROMPT = `You are an expert code analyzer agent. Your task is to analyze git diffs and extract structured information about code changes.

## Your Responsibilities:
1. Identify what type of change this is (feature, bugfix, refactor, config, docs)
2. Extract entities (functions, classes, routes, models, components) that were modified
3. Determine the impact level (major, minor, patch)
4. Generate semantic tags for routing to report sections
5. Suggest which report sections this change belongs to

## Output Format:
You MUST respond with valid JSON only. No markdown, no explanations, just JSON.

{
  "changeType": "feature|bugfix|refactor|config|docs|test",
  "impactLevel": "major|minor|patch",
  "entities": [
    {
      "type": "function|class|route|component|model|config|middleware|hook|utility",
      "name": "entityName",
      "action": "created|modified|deleted",
      "file": "path/to/file.js",
      "description": "Brief description of what this entity does"
    }
  ],
  "semanticTags": ["tag1", "tag2"],
  "technicalSummary": "2-3 sentence technical summary of what changed and why it matters",
  "suggestedSections": [
    {
      "sectionId": "section-id-from-template",
      "confidence": 0.95,
      "reason": "Why this change belongs in this section"
    }
  ]
}

## Guidelines for Entity Extraction:
- Focus on meaningful code changes, not formatting
- Identify the primary purpose of each change
- Group related changes under a single entity when appropriate
- Include file paths relative to project root

## Guidelines for Semantic Tags:
Choose from these categories (pick 2-5 most relevant):
- Architecture: "architecture", "structure", "layer", "module"
- Features: "feature", "functionality", "capability", "api"
- Data: "database", "schema", "model", "data", "storage"
- Security: "security", "authentication", "authorization", "encryption"
- Performance: "performance", "optimization", "caching"
- UI/UX: "ui", "component", "frontend", "styling"
- Backend: "backend", "server", "api", "route", "controller"
- Testing: "test", "spec", "coverage", "quality"
- DevOps: "config", "deployment", "docker", "ci-cd"
- Documentation: "docs", "readme", "comments"

**Note: If the diff appears truncated, analyze based on the available content and file names.**

## Guidelines for Impact Level:
- major: Breaking changes, new major features, architectural changes
- minor: New features, significant improvements, new endpoints
- patch: Bug fixes, small improvements, refactoring, docs

## Guidelines for Section Suggestions:
Based on the template sections provided, suggest 1-3 most relevant sections.
**IMPORTANT: Use the EXACT section IDs from the template sections list provided.**
The section IDs are lowercase strings like "introduction", "purpose", "scope", "features", etc.
Do NOT invent new section IDs - only use IDs that appear in the Available Report Sections.
Provide confidence scores between 0 and 1.`;

/**
 * Creates the user prompt for the analyzer agent
 * @param {Object} params
 * @param {string} params.commitHash - The commit hash
 * @param {string} params.commitMessage - The commit message
 * @param {string} params.author - The commit author
 * @param {string} params.diff - The git diff content
 * @param {Array} params.filesChanged - List of changed files
 * @param {Object} params.projectContext - Project context (name, tech stack)
 * @param {Array} params.templateSections - Template sections for routing
 * @returns {string} The formatted user prompt
 */
function createAnalyzerUserPrompt({
  commitHash,
  commitMessage,
  author,
  diff,
  filesChanged,
  projectContext,
  templateSections
}) {
  // Format template sections for the prompt
  const sectionsInfo = templateSections.map(s => ({
    id: s.id,
    title: s.title,
    keywords: s.aiHints?.keywords || [],
    codePatterns: s.aiHints?.codePatterns || []
  }));

  return `## Commit Information
- Hash: ${commitHash}
- Message: ${commitMessage}
- Author: ${author}

## Project Context
- Name: ${projectContext.name || 'Unknown'}
- Tech Stack: ${projectContext.techStack?.join(', ') || 'Not specified'}

## Files Changed (${filesChanged.length} files)
${filesChanged.map(f => `- ${f}`).join('\n')}

## Available Report Sections
${JSON.stringify(sectionsInfo, null, 2)}

## Git Diff
\`\`\`diff
${truncateDiff(diff)}
\`\`\`

Analyze this commit and provide the structured JSON output. Focus on extracting meaningful information that will help generate accurate report content.`;
}

/**
 * Creates the user prompt for chunked analysis
 * @param {Object} params
 * @param {string} params.commitHash - The commit hash
 * @param {string} params.commitMessage - The commit message
 * @param {string} params.author - The commit author
 * @param {string} params.chunkContent - The chunk content to analyze
 * @param {number} params.chunkIndex - Current chunk index (0-based)
 * @param {number} params.totalChunks - Total number of chunks
 * @param {Array} params.chunkFiles - Files included in this chunk
 * @param {Array} params.filesChanged - All files changed in commit
 * @param {Object} params.projectContext - Project context
 * @param {Array} params.templateSections - Template sections for routing
 * @returns {string} The formatted user prompt
 */
function createChunkedAnalyzerPrompt({
  commitHash,
  commitMessage,
  author,
  chunkContent,
  chunkIndex,
  totalChunks,
  chunkFiles,
  filesChanged,
  projectContext,
  templateSections
}) {
  // Format template sections for the prompt
  const sectionsInfo = templateSections.map(s => ({
    id: s.id,
    title: s.title,
    keywords: s.aiHints?.keywords || [],
    codePatterns: s.aiHints?.codePatterns || []
  }));

  const chunkInfo = totalChunks > 1 
    ? `\n## CHUNK INFORMATION
**This is chunk ${chunkIndex + 1} of ${totalChunks}** - Analyze ONLY the code shown in this chunk.
Files in this chunk: ${chunkFiles?.join(', ') || 'Various'}
Note: Other chunks contain additional changes. Focus on what's visible here.`
    : '';

  return `## Commit Information
- Hash: ${commitHash}
- Message: ${commitMessage}
- Author: ${author}
${chunkInfo}

## Project Context
- Name: ${projectContext.name || 'Unknown'}
- Tech Stack: ${projectContext.techStack?.join(', ') || 'Not specified'}

## All Files Changed in Commit (${filesChanged.length} files total)
${filesChanged.slice(0, 20).map(f => `- ${f}`).join('\n')}${filesChanged.length > 20 ? `\n... and ${filesChanged.length - 20} more files` : ''}

## Available Report Sections
${JSON.stringify(sectionsInfo, null, 2)}

## Git Diff (Chunk ${chunkIndex + 1}/${totalChunks})
\`\`\`diff
${chunkContent}
\`\`\`

Analyze this chunk and provide the structured JSON output. Focus on extracting meaningful information from the code visible in THIS chunk. Your analysis will be merged with analyses from other chunks.`;
}

module.exports = {
  ANALYZER_SYSTEM_PROMPT,
  createAnalyzerUserPrompt,
  createChunkedAnalyzerPrompt
};
