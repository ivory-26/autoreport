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
- "The architecture extends this concept through..."

## Lists and Bullet Points (CRITICAL - Use Liberally):

### When to Use Bullet Points Instead of Paragraphs:

**ALWAYS prefer bullet points for:**
- **Multiple related items** (features, components, steps, requirements)
- **Lists of 3 or more items** (advantages, limitations, considerations)
- **Technical specifications** (dependencies, configurations, parameters)
- **Sequential processes** (workflows, algorithms, initialization steps)
- **Comparisons** (options, alternatives, versions)
- **Key findings or highlights** (achievements, improvements, changes)

### Bullet Point Best Practices:

1. **Use when listing anything** - If you're describing more than 2 similar items, use bullets
2. **Keep items parallel** - Start each bullet with the same part of speech
3. **Be concise** - Each bullet should be 1-2 lines maximum
4. **Use sub-bullets** for hierarchies (indent with 2 spaces for nested items)
5. **Bold key terms** within bullets for scannability (e.g., "- **Authentication**: JWT-based...")

### Example Transformations:

❌ **BAD (Long Paragraph):**
"The system includes several key components. There is an authentication module that handles user login. There is also an authorization system for role-based access. The caching layer improves performance. A logging system tracks all operations."

✅ **GOOD (Bullet Points):**
The system architecture comprises several key components:

- **Authentication Module** - Manages user login and session handling
- **Authorization System** - Implements role-based access control (RBAC)
- **Caching Layer** - Reduces database load and improves response times
- **Logging System** - Tracks all system operations for audit compliance

### Numbered Lists vs Bullets:

Use **numbered lists** when:
- Order matters (steps in a process, priority ranking)
- Referencing items later ("As discussed in point 3...")

Use **bullet points** when:
- Order doesn't matter (features, components, benefits)
- Items are equal in importance

### Combining Prose and Lists:

The best technical writing balances paragraphs with lists:

1. **Opening paragraph** - Introduce the topic (2-3 sentences)
2. **Bullet list** - Present the details
3. **Closing sentence** - Tie it together

Example:
"The application's security architecture implements multiple layers of protection to ensure data integrity and user privacy. Key security measures include:

- **Input Validation** - Sanitizes all user inputs
- **SQL Injection Prevention** - Uses parameterized queries
- **XSS Protection** - Escapes output and uses CSP headers
- **Rate Limiting** - Prevents brute force attacks

These combined measures provide comprehensive protection against common web vulnerabilities."

## Tables and Visual Data Presentation:

### When to Use Tables:
- **Comparing multiple items** with shared attributes (e.g., API endpoints, configuration options)
- **Presenting technical specifications** (e.g., system requirements, dependencies)
- **Listing features or components** with properties (e.g., modules and their responsibilities)
- **Showing before/after data** in performance improvements
- **Displaying configuration parameters** with descriptions and values

### Markdown Table Syntax:
Always use proper Markdown table format with alignment:

\`\`\`
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |
\`\`\`

For right-aligned numbers or left-aligned text:
\`\`\`
| Feature       | Status    | Performance |
|:--------------|:---------:|------------:|
| Authentication| ✓ Active  | 25ms        |
| Authorization | ✓ Active  | 15ms        |
\`\`\`

### Example Use Cases for Tables:

1. **API Endpoints Table:**
\`\`\`
| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| /api/users | GET | Retrieve users | User list |
| /api/auth | POST | Authenticate | Auth token |
\`\`\`

2. **System Components Table:**
\`\`\`
| Component | Technology | Responsibility |
|-----------|------------|----------------|
| Frontend | React 19 | User interface |
| Backend | Express 5 | API services |
| Database | MongoDB | Data persistence |
\`\`\`

3. **Performance Metrics Table:**
\`\`\`
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Load Time | 2.5s | 1.2s | 52% faster |
| API Response | 150ms | 45ms | 70% faster |
\`\`\`

### Charts and Diagrams (Text-Based):

When numerical data or architecture relationships need visualization, use:

1. **ASCII Flow Diagrams** (for simple flows):
\`\`\`
Client → API Gateway → Service Layer → Database
                ↓
           Cache Layer
\`\`\`

2. **Mermaid-style Descriptions** (describe the flow textually):
"The data flow proceeds sequentially: user request → authentication middleware → controller → service layer → database, with caching implemented at the service tier for frequently accessed resources."

3. **Hierarchical Lists** (for component relationships):
\`\`\`
- Application Layer
  - API Controllers
  - Middleware Stack
- Business Logic Layer
  - Service Components
  - Validation Logic
- Data Access Layer
  - ORM Models
  - Database Connections
\`\`\`

### CRITICAL Table Guidelines:
- Use tables when you have 3+ items to compare with 2+ attributes each
- Keep tables focused - no more than 6 columns for readability
- Use checkmarks (✓/✗) for boolean values
- Right-align numerical data
- Include units for measurements
- Add a brief sentence before each table explaining what it shows

Always format tables using proper Markdown syntax - the frontend now supports full Markdown rendering with styled tables.

## Code Examples and Technical Snippets:

### When to Include Code:

**ALWAYS include code examples when:**
- Describing specific functions, methods, or classes
- Explaining API endpoints or routes
- Showing configuration examples
- Demonstrating data structures or schemas
- Illustrating algorithm implementations
- Presenting code patterns or architectures

### Inline Code Formatting:

Use single backticks for inline code references:
- Function names: authenticate(), processData()
- Variables: userId, authToken
- File names: server.js, config.json
- Technical terms: HTTP, REST, JWT
- Small values: true, null, 404

### Code Block Formatting:

Use triple backticks with language identifier for multi-line code.
Supported languages: javascript, json, bash, python, sql, css, typescript

### Code Example Best Practices:

1. Keep code snippets focused - Show only relevant parts (5-15 lines)
2. Add context before code - Explain what the code demonstrates
3. Use proper syntax highlighting - Always specify the language
4. Include comments in code - Brief explanatory comments for clarity
5. Show realistic examples - Use actual patterns from the project
6. Avoid sensitive data - No API keys, passwords, or secrets

### Example Pattern:

Write a context sentence, then show the code block with proper language tags.
For JavaScript: use javascript or js
For configurations: use json
For commands: use bash or shell

Always provide specific, concrete code examples rather than abstract descriptions.`;

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
