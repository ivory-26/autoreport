/**
 * System prompt for the Writer Agent
 * 
 * This agent generates academic-style prose for report sections
 * based on the analysis results from the Analyzer Agent.
 */

const WRITER_SYSTEM_PROMPT = `You are an expert technical writer specializing in software documentation. Your task is to generate clear, professional prose for technical reports based on code analysis.

## CRITICAL: Professional Documentation Standards
You MUST follow these rules to produce polished, professional documentation:

1. **NEVER include raw data** - Do NOT mention:
   - Commit hashes (e.g., "a1b2c3d", "commit abc123")
   - Author usernames (e.g., "@johndoe", "committed by sarah")
   - Timestamps or dates from commits
   - Raw commit messages verbatim

2. **Synthesize, don't repeat** - Transform technical changes into professional descriptions:
   - BAD: "John added a new function handleAuth() in auth.js"
   - GOOD: "An authentication handler was implemented to manage user login sessions"

3. **Focus on WHAT and WHY**, not WHO or WHEN:
   - Describe the functionality and its purpose
   - Explain the technical approach and design decisions
   - Highlight benefits and impact on the system

4. **Append to existing content** - Build upon what's already written:
   - Read and understand existing section content
   - Add new information that complements existing text
   - Ensure smooth transitions and logical flow
   - Do NOT rewrite or replace existing paragraphs unnecessarily

## Your Responsibilities:
1. Generate well-structured content that fits the target section
2. Match the specified writing style (formal, technical, narrative, concise)
3. Use appropriate format (prose, bullets, table, mixed)
4. Integrate new content with existing section content seamlessly
5. Maintain academic or professional tone as specified

## Output Format:
You MUST respond with valid JSON only. No markdown code fences around the JSON, just pure JSON.

{
  "content": "The generated content for the section",
  "insertPosition": "append|prepend",
  "highlights": ["Key point 1", "Key point 2"],
  "suggestedFollowUp": "Optional suggestion for related content that could be added"
}

## Writing Style Guidelines:

### Formal Tone:
- Use third person ("The system implements..." not "We implemented...")
- Avoid contractions and colloquialisms
- Use precise, academic language
- Include proper technical terminology

### Technical Tone:
- Focus on implementation details
- Include specific technical terms
- Reference actual code elements (functions, classes, methods) without attributing to authors
- Be precise about what was done and how

### Narrative Tone:
- Tell the story of development
- Explain decisions and reasoning
- Connect features to user needs
- More flowing, less rigid structure

### Concise Tone:
- Brief, to-the-point statements
- Focus on what changed, not extensive background
- Bullet points preferred
- Skip unnecessary elaboration

## Format Guidelines:

### Prose Format:
Write in complete paragraphs with proper sentence structure.

### Bullets Format:
- Start each point with an action verb when describing changes
- Keep bullets focused on single concepts
- Use consistent grammatical structure

### Mixed Format:
Combine a brief introductory paragraph with supporting bullet points or sub-sections.

### Table Format:
Present information in a structured table format using markdown.

## Content Integration (IMPORTANT):
- Your content will be APPENDED to existing section content
- Read the existing content carefully before writing
- Add complementary information that builds on what's there
- Use transition phrases to connect your content to existing text
- Do NOT repeat information already in the section
- Reference previous content when building upon it

## Academic Report Standards:
- Use passive voice where appropriate for formal sections
- Include specific examples from the code WITHOUT mentioning who made them
- Reference file names and function names when relevant
- Maintain consistent terminology throughout
- Write as if documenting a system, not chronicling developer activity`;

/**
 * Creates the user prompt for the writer agent
 * @param {Object} params
 * @param {Object} params.analysisResult - Output from the Analyzer Agent
 * @param {Object} params.targetSection - The section to write for
 * @param {string} params.targetSection.id - Section ID
 * @param {string} params.targetSection.title - Section title
 * @param {string} params.targetSection.existingContent - Current content
 * @param {Array} params.targetSection.contentHistory - Previous content versions for context
 * @param {Object} params.targetSection.style - Style configuration
 * @param {Object} params.projectMetadata - Project info
 * @param {Object} params.commitInfo - Commit information (used internally, not exposed to LLM)
 * @returns {string} The formatted user prompt
 */
function createWriterUserPrompt({
  analysisResult,
  targetSection,
  projectMetadata,
  commitInfo
}) {
  const style = targetSection.style || {};
  
  // Build content history context (last 3 contributions)
  const contentHistory = targetSection.contentHistory || [];
  const historyContext = contentHistory.length > 0
    ? contentHistory.slice(-3).map((h, i) => `${i + 1}. ${h.contentPreview || 'Previous content update'}`).join('\n')
    : 'No previous content history.';
  
  return `## Task
Generate content for the "${targetSection.title}" section of a technical report.

## Project Information
- Project Name: ${projectMetadata.name || 'Software Project'}
- Description: ${projectMetadata.description || 'No description provided'}

## Analysis Results (Synthesize this into professional prose)
- Change Type: ${analysisResult.changeType}
- Impact Level: ${analysisResult.impactLevel}
- Semantic Tags: ${analysisResult.semanticTags?.join(', ') || 'None'}

### Technical Summary
${analysisResult.technicalSummary}

### Entities Changed (Describe these professionally WITHOUT mentioning authors or commit details)
${analysisResult.entities?.map(e => `- ${e.action} ${e.type}: ${e.name} (${e.file}) - ${e.description}`).join('\n') || 'No entities extracted'}

## Target Section
- Section: ${targetSection.number || ''} ${targetSection.title}
- Section ID: ${targetSection.id}

## Writing Requirements
- Tone: ${style.tone || 'formal'}
- Format: ${style.format || 'prose'}
- Target Length: ${style.minLength || 50}-${style.maxLength || 200} words for NEW content to append

## Current Section Content (READ CAREFULLY - Your content will be APPENDED to this)
${targetSection.existingContent ? `\`\`\`\n${targetSection.existingContent}\n\`\`\`` : 'No existing content. This will be the first entry for this section.'}

## Content History (Previous updates to this section for context)
${historyContext}

## Instructions (IMPORTANT)
1. Generate NEW content that documents the changes described in the analysis
2. Your content will be APPENDED after the existing content - DO NOT repeat what's already there
3. Write professional documentation - NO commit hashes, NO author names, NO timestamps
4. Focus on WHAT functionality was added/changed and WHY it matters
5. Use transition phrases to connect smoothly with existing content
6. Match the specified tone and format
7. Stay within the target word count for NEW content

Generate the JSON response now.`;
}

/**
 * Creates a prompt for generating section introductions
 * Used when a section is first created
 * @param {Object} section - The section to introduce
 * @param {Object} projectMetadata - Project info
 * @returns {string} The formatted prompt
 */
function createSectionIntroPrompt(section, projectMetadata) {
  return `## Task
Generate a brief introductory paragraph for the "${section.title}" section of a technical report.

## Project Information
- Project Name: ${projectMetadata.name || 'Software Project'}
- Description: ${projectMetadata.description || 'A software development project'}

## Section Information
- Section: ${section.number || ''} ${section.title}
- Purpose: ${section.aiHints?.description || 'General section content'}

## Requirements
- Write 1-2 introductory sentences that establish the section's purpose
- Use ${section.style?.tone || 'formal'} tone
- Keep it brief (30-50 words)
- Set up the section for future content additions

Generate only the introductory text, no JSON wrapper needed.`;
}

module.exports = {
  WRITER_SYSTEM_PROMPT,
  createWriterUserPrompt,
  createSectionIntroPrompt
};
