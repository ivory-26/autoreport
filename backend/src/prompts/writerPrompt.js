/**
 * System prompt for the Writer Agent
 * 
 * This agent generates academic-style prose for report sections
 * based on the analysis results from the Analyzer Agent.
 */

const WRITER_SYSTEM_PROMPT = `You are an expert technical writer specializing in software documentation. Your task is to generate clear, professional prose for technical reports based on code analysis.

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
- Reference actual code elements (functions, classes, methods)
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

## Content Integration:
- If existing content is provided, ensure new content flows naturally
- Avoid repeating information already in the section
- Reference but don't duplicate previous content
- Add new insights and details from the latest changes

## Academic Report Standards:
- Use passive voice where appropriate for formal sections
- Include specific examples from the code
- Reference file names and function names when relevant
- Maintain consistent terminology throughout`;

/**
 * Creates the user prompt for the writer agent
 * @param {Object} params
 * @param {Object} params.analysisResult - Output from the Analyzer Agent
 * @param {Object} params.targetSection - The section to write for
 * @param {string} params.targetSection.id - Section ID
 * @param {string} params.targetSection.title - Section title
 * @param {string} params.targetSection.existingContent - Current content
 * @param {Object} params.targetSection.style - Style configuration
 * @param {Object} params.projectMetadata - Project info
 * @param {Object} params.commitInfo - Commit information
 * @returns {string} The formatted user prompt
 */
function createWriterUserPrompt({
  analysisResult,
  targetSection,
  projectMetadata,
  commitInfo
}) {
  const style = targetSection.style || {};
  
  return `## Task
Generate content for the "${targetSection.title}" section of a technical report.

## Project Information
- Project Name: ${projectMetadata.name || 'Software Project'}
- Description: ${projectMetadata.description || 'No description provided'}

## Commit Information
- Message: ${commitInfo.message}
- Author: ${commitInfo.author}
- Hash: ${commitInfo.hash?.substring(0, 7) || 'N/A'}

## Analysis Results
- Change Type: ${analysisResult.changeType}
- Impact Level: ${analysisResult.impactLevel}
- Semantic Tags: ${analysisResult.semanticTags?.join(', ') || 'None'}

### Technical Summary
${analysisResult.technicalSummary}

### Entities Changed
${analysisResult.entities?.map(e => `- ${e.action} ${e.type}: ${e.name} (${e.file}) - ${e.description}`).join('\n') || 'No entities extracted'}

## Target Section
- Section: ${targetSection.number || ''} ${targetSection.title}
- Section ID: ${targetSection.id}

## Writing Requirements
- Tone: ${style.tone || 'formal'}
- Format: ${style.format || 'prose'}
- Target Length: ${style.minLength || 50}-${style.maxLength || 300} words

## Existing Section Content
${targetSection.existingContent ? `\`\`\`\n${targetSection.existingContent}\n\`\`\`` : 'No existing content. This will be the first entry.'}

## Instructions
1. Generate content that documents the changes described in the analysis
2. Match the specified tone and format
3. If existing content exists, write content that complements it without repetition
4. Focus on the technical aspects most relevant to this section
5. Stay within the target word count range
6. Use proper technical terminology and be specific

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
