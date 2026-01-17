/**
 * System prompt for the Writer Agent
 * 
 * This agent generates academic-style prose for report sections
 * based on the analysis results from the Analyzer Agent.
 */

const WRITER_SYSTEM_PROMPT = `You are an expert technical writer specializing in academic software documentation. Your task is to generate professional, academic-style prose for technical project reports that follows IEEE and scholarly writing conventions.

## CRITICAL: Academic Documentation Standards

### 1. NEVER Include Raw Development Data
Do NOT mention any of the following in your writing:
- Commit hashes, SHA identifiers, or version control references
- Developer usernames, author names, or contributor credits
- Specific dates, timestamps, or sprint numbers from development
- Raw commit messages or pull request titles verbatim
- GitHub/GitLab/version control terminology

### 2. Academic Writing Style Requirements
- **Use passive voice** for formal technical sections ("The system was designed to..." not "We designed...")
- **Third person perspective** throughout ("The application implements..." not "I implemented...")
- **Formal vocabulary** - avoid colloquialisms, contractions, and casual language
- **Present tense** for describing current system functionality
- **Past tense** for describing design decisions and implementation process

### 3. Paragraph Structure and Flow
Each paragraph should:
- Open with a clear topic sentence stating the main idea
- Develop the idea with supporting technical details
- Conclude with implications or connections to other components
- Transition smoothly to the next topic

### 4. Context Awareness and Flow Continuity
**CRITICAL**: You will receive the PREVIOUS PARAGRAPHS from the section.
- Read the previous content carefully before writing
- Your new content must flow naturally from what already exists
- Use transitional phrases like "Furthermore," "In addition," "Building upon this,"
- DO NOT repeat information that already exists in the section
- Reference concepts mentioned previously when expanding on them
- If previous content discusses Topic A, and you're adding related Topic B, explicitly connect them

### 5. Content Synthesis
Transform technical changes into scholarly descriptions:
- BAD: "Added handleAuth() function to manage login"
- GOOD: "The authentication subsystem incorporates a dedicated handler function that manages the complete user login lifecycle, including session initialization and credential verification."

## Output Format:
You MUST respond with valid JSON only. No markdown code fences.

{
  "content": "The generated academic content for the section",
  "insertPosition": "append",
  "highlights": ["Key technical contribution 1", "Key contribution 2"],
  "suggestedFollowUp": "Optional: related topic that could be expanded"
}

## Writing Style Guidelines:

### Formal/Academic Tone:
- Use third person exclusively
- Employ precise, technical vocabulary
- Include domain-specific terminology appropriately
- Structure sentences for clarity, not brevity
- Avoid first person ("we", "our", "I")

### Technical Depth:
- Reference specific components, functions, and modules
- Explain architectural decisions and their rationale
- Describe data flows and system interactions
- Include relevant technical details without oversimplification

### IEEE-Style Conventions:
- Use standardized technical terminology
- Structure content hierarchically
- Present information objectively
- Support assertions with technical specifics

## Content Integration Rules (MOST IMPORTANT):

1. **READ EXISTING CONTENT FIRST** - Understand what's already written
2. **APPEND ONLY** - Never rewrite existing paragraphs
3. **ENSURE CONTINUITY** - Your first sentence must connect to the last paragraph
4. **AVOID REDUNDANCY** - If a topic is already covered, don't repeat it
5. **BUILD INCREMENTALLY** - Add new information that extends existing content
6. **MAINTAIN CONSISTENCY** - Use the same terminology as existing content

## Transition Phrases to Use:
- "Furthermore, the system incorporates..."
- "In addition to the aforementioned functionality..."
- "Building upon this foundation..."
- "This capability is complemented by..."
- "To support this feature, the implementation includes..."
- "The architecture extends this concept through..."`;

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
 * @param {Object} params.commitInfo - Commit information
 * @param {Object} [params.repoContext] - Full repository context (for initial generation)
 * @param {Array} [params.allSections] - All sections in the template (for context)
 * @returns {string} The formatted user prompt
 */
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
 * @param {Object} params.commitInfo - Commit information
 * @param {Object} params.authorInfo - Author/Collaborator information
 * @param {Object} [params.repoContext] - Full repository context (for initial generation)
 * @param {Array} [params.allSections] - All sections in the template (for context)
 * @returns {string} The formatted user prompt
 */
function createWriterUserPrompt({
  analysisResult,
  targetSection,
  projectMetadata,
  commitInfo,
  authorInfo,
  repoContext,
  allSections
}) {
  const style = targetSection.style || {};
  const sectionTitle = targetSection.title || targetSection.name || "Report Section";
  
  // Build template context
  const templateContext = allSections && allSections.length > 0
    ? `The overall report template includes the following sections: ${allSections.map(s => s.title || s.name || s.id).join(', ')}.`
    : '';

  // Build content history context (last 3 contributions)
  const contentHistory = targetSection.contentHistory || [];
  const historyContext = contentHistory.length > 0
    ? contentHistory.slice(-3).map((h, i) => `${i + 1}. ${h.contentPreview || 'Previous content update'}`).join('\n')
    : 'No previous content history.';
  
  // Extract last 2-3 paragraphs from existing content for flow context
  const existingContent = targetSection.existingContent || '';
  const paragraphs = existingContent.split(/\n\n+/).filter(p => p.trim().length > 0);
  const previousParagraphs = paragraphs.slice(-3).join('\n\n');
  const hasPreviousContent = previousParagraphs.length > 0;
  
  // Calculate approximate existing word count
  const existingWordCount = existingContent.split(/\s+/).filter(Boolean).length;
  
  // Determine role-based focus
  const role = authorInfo?.role || 'editor';
  const roleFocus = (role === 'owner' || role === 'admin') 
    ? "ARCHITECTURAL AUTHORITY: Focus on high-level system design, decision rationale, and strategic implications."
    : "TECHNICAL IMPLEMENTATION: Focus on specific code mechanics, function behavior, and direct system outputs.";

  // INITIAL GENERATION MODE (Full Repo Context)
  if (repoContext) {
    return `## Task
Generate COMPREHENSIVE initial content for the "${sectionTitle}" section of a technical academic report.
${templateContext}
This is the FIRST generation for this project. Use the provided repository data to write deep, specific content.

## Project Context
- Name: ${repoContext.name}
- Technical Stack: ${repoContext.techStack?.join(', ') || 'N/A'}
- Description: ${repoContext.description}
- Languages: ${repoContext.language}

## Repository Analysis
### README Summary
${repoContext.readme || 'No README available'}

### Key Source Files (Reference these for technical details)
${repoContext.keyFiles?.map(f => `
#### File: ${f.path}
${f.content ? f.content.substring(0, 1500) + '...' : 'Content not available'}
`).join('\n') || 'No key files analyzed.'}

## Target Section: "${sectionTitle}"
- Role of this section: ${targetSection.aiHints?.description || 'standard technical documentation'}
- Existing Content: None (Start fresh)

## Writing Requirements
- Tone: ${style.tone || 'formal'} (Academic/IEEE style)
- Format: ${style.format || 'prose'}
- Length: Detailed and comprehensive (300-600 words) for initial population.
- Focus: Analyze the PROVIDED FILES and connect them to this specific section's topic.
- Avoid generic filler. Use specific class names, architecture patterns, and technologies found in the code.

## CRITICAL INSTRUCTIONS
1. Write EXCLUSIVELY about the "${sectionTitle}". Do not stray into other topics.
2. If this is "System Architecture", describe the structure based on the file tree and key files.
3. If this is "Implementation", describe the specific code patterns found in the source.
4. If this is "Introduction", summarize the project's purpose based on the README.
5. Use PASSIVE VOICE and THIRD PERSON (e.g., "The system utilizes..." not "We use...").
6. NO placeholders, NO commit hashes.
7. Write as if you are the lead architect documenting the completed system.

Generate the JSON response now.`;
  }

  // STANDARD UPDATE MODE (Commit Analysis)
  return `## Task
Generate NEW content to APPEND to the "${sectionTitle}" section of a technical academic report.
${templateContext}

## Project Information
- Project Name: ${projectMetadata.name || 'Software Project'}
- Description: ${projectMetadata.description || 'No description provided'}

## Collaborative Context
- Change Author Role: ${role}
- **GENERATION STRATEGY**: ${roleFocus}

## Analysis Results (Transform into academic prose)
- Change Type: ${analysisResult.changeType}
- Impact Level: ${analysisResult.impactLevel}
- Semantic Tags: ${analysisResult.semanticTags?.join(', ') || 'None'}

### Technical Summary
${analysisResult.technicalSummary}

### Entities Changed (Describe professionally WITHOUT mentioning authors or commits)
${analysisResult.entities?.map(e => `- ${e.action} ${e.type}: ${e.name} (${e.file}) - ${e.description}`).join('\n') || 'No entities extracted'}

## Target Section
- Section: ${targetSection.number || ''} ${sectionTitle}
- Existing Word Count: ~${existingWordCount} words

## Writing Requirements
- Tone: ${style.tone || 'formal'} (Academic/IEEE style)
- Format: ${style.format || 'prose'}
- Target Length: ${style.minLength || 80}-${style.maxLength || 250} words for NEW content

${hasPreviousContent ? `## PREVIOUS PARAGRAPHS (Your content MUST flow from these - READ CAREFULLY)
The following are the last few paragraphs of existing content. Your NEW content must:
1. Connect smoothly to this existing text
2. NOT repeat any information already stated
3. Use transition phrases to link ideas

\`\`\`
${previousParagraphs}
\`\`\`
` : `## NO EXISTING CONTENT
This section is empty. Write an introductory paragraph that:
1. Establishes the purpose of this section
2. Provides context for the topic
3. Sets up for future content additions
`}
## Content History (Recent updates for context)
${historyContext}

## CRITICAL INSTRUCTIONS
1. Generate ONLY NEW content to append - DO NOT rewrite existing paragraphs
2. Start with a TRANSITION that connects to the previous paragraph${hasPreviousContent ? ' shown above' : ''}
3. Use PASSIVE VOICE and THIRD PERSON (e.g., "The system implements..." not "We implemented...")
4. NO commit hashes, NO author names, NO timestamps, NO version control terms
5. Write in academic style suitable for IEEE or university project reports
6. Focus on WHAT the functionality does and WHY it matters to the system
7. **ADOPT THE ROLE STRATEGY**: ${role === 'owner' || role === 'admin' ? 'Use authoritative language defining system boundaries.' : 'Use descriptive language detailing implementation specifics.'}

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
