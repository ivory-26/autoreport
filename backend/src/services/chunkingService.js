/**
 * Chunking Service
 * 
 * Provides recursive overlapping character chunking for large text content,
 * specifically optimized for git diffs. Preserves context between chunks
 * using configurable overlap.
 */

// Default configuration
const DEFAULT_CHUNK_SIZE = 12000;  // ~3000 tokens
const DEFAULT_OVERLAP = 1500;      // ~375 tokens overlap for context
const MIN_CHUNK_SIZE = 2000;       // Minimum size before stopping recursion

/**
 * Split text into overlapping chunks
 * @param {string} text - Text to chunk
 * @param {Object} options - Chunking options
 * @param {number} options.chunkSize - Target chunk size in characters
 * @param {number} options.overlap - Overlap between chunks in characters
 * @returns {Array<{content: string, index: number, total: number, startChar: number, endChar: number}>}
 */
function chunkText(text, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap || DEFAULT_OVERLAP;

  if (!text || text.length <= chunkSize) {
    return [{
      content: text || '',
      index: 0,
      total: 1,
      startChar: 0,
      endChar: text?.length || 0
    }];
  }

  const chunks = [];
  let startPos = 0;
  let chunkIndex = 0;

  while (startPos < text.length) {
    // Calculate end position
    let endPos = Math.min(startPos + chunkSize, text.length);
    
    // Try to break at a natural boundary (newline, space) if not at end
    if (endPos < text.length) {
      // Look for newline within last 500 chars
      const searchStart = Math.max(endPos - 500, startPos);
      const searchText = text.substring(searchStart, endPos);
      const lastNewline = searchText.lastIndexOf('\n');
      
      if (lastNewline > 0) {
        endPos = searchStart + lastNewline + 1;
      } else {
        // Fallback to last space
        const lastSpace = searchText.lastIndexOf(' ');
        if (lastSpace > 0) {
          endPos = searchStart + lastSpace + 1;
        }
      }
    }

    chunks.push({
      content: text.substring(startPos, endPos),
      index: chunkIndex,
      total: 0, // Will be updated after
      startChar: startPos,
      endChar: endPos
    });

    chunkIndex++;
    // Next chunk starts with overlap
    startPos = Math.max(startPos + 1, endPos - overlap);
    
    // Prevent infinite loop
    if (startPos >= text.length - 1) break;
  }

  // Update total count
  chunks.forEach(chunk => chunk.total = chunks.length);

  return chunks;
}

/**
 * Split a git diff into chunks while preserving file boundaries
 * @param {string} diff - Git diff content
 * @param {Object} options - Chunking options
 * @returns {Array<{content: string, index: number, total: number, files: string[]}>}
 */
function chunkDiff(diff, options = {}) {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap || DEFAULT_OVERLAP;

  if (!diff || diff.length <= chunkSize) {
    return [{
      content: diff || '',
      index: 0,
      total: 1,
      files: extractFilesFromDiff(diff || '')
    }];
  }

  // Split by file boundaries (diff --git)
  const fileDiffs = splitByFileBoundary(diff);
  
  const chunks = [];
  let currentChunk = {
    content: '',
    files: [],
    index: 0
  };

  for (const fileDiff of fileDiffs) {
    const fileName = extractFileName(fileDiff);
    
    // If adding this file would exceed chunk size
    if (currentChunk.content.length > 0 && 
        currentChunk.content.length + fileDiff.length > chunkSize) {
      
      // Save current chunk
      chunks.push({
        ...currentChunk,
        total: 0 // Updated later
      });
      
      // Start new chunk with overlap context
      const overlapContent = getOverlapContext(currentChunk.content, overlap);
      currentChunk = {
        content: overlapContent,
        files: [],
        index: chunks.length
      };
    }
    
    // If single file is too large, need to split it
    if (fileDiff.length > chunkSize) {
      // First, save any pending content
      if (currentChunk.content.length > 0) {
        chunks.push({
          ...currentChunk,
          total: 0
        });
        currentChunk = {
          content: '',
          files: [],
          index: chunks.length
        };
      }
      
      // Split large file diff using text chunking
      const subChunks = chunkLargeFileDiff(fileDiff, fileName, chunkSize, overlap);
      for (const subChunk of subChunks) {
        chunks.push({
          content: subChunk.content,
          files: [fileName],
          index: chunks.length,
          total: 0,
          isPartialFile: true,
          partIndex: subChunk.partIndex,
          partTotal: subChunk.partTotal
        });
      }
      
      currentChunk = {
        content: '',
        files: [],
        index: chunks.length
      };
    } else {
      // Add file to current chunk
      currentChunk.content += fileDiff;
      if (fileName) currentChunk.files.push(fileName);
    }
  }

  // Don't forget last chunk
  if (currentChunk.content.length > 0) {
    chunks.push({
      ...currentChunk,
      total: 0
    });
  }

  // Update total counts
  const totalChunks = chunks.length;
  chunks.forEach((chunk, i) => {
    chunk.total = totalChunks;
    chunk.index = i;
  });

  console.log(`[Chunking] Split diff into ${chunks.length} chunks`);

  return chunks;
}

/**
 * Split diff content by file boundaries
 */
function splitByFileBoundary(diff) {
  const parts = diff.split(/(?=diff --git)/);
  return parts.filter(p => p.trim().length > 0);
}

/**
 * Extract filename from a diff section
 */
function extractFileName(diffSection) {
  const match = diffSection.match(/diff --git a\/(.+?) b\//);
  return match ? match[1] : null;
}

/**
 * Extract all file names from a diff
 */
function extractFilesFromDiff(diff) {
  const matches = diff.matchAll(/diff --git a\/(.+?) b\//g);
  return [...matches].map(m => m[1]);
}

/**
 * Get overlap context from end of content
 */
function getOverlapContext(content, overlapSize) {
  if (content.length <= overlapSize) return content;
  
  // Find a good break point
  const startPos = content.length - overlapSize;
  const overlapText = content.substring(startPos);
  
  // Try to start at a line boundary
  const firstNewline = overlapText.indexOf('\n');
  if (firstNewline > 0 && firstNewline < 200) {
    return '...[context from previous chunk]\n' + overlapText.substring(firstNewline + 1);
  }
  
  return '...[context from previous chunk]\n' + overlapText;
}

/**
 * Split a large file diff into smaller chunks
 */
function chunkLargeFileDiff(fileDiff, fileName, chunkSize, overlap) {
  const chunks = [];
  
  // Extract header (file metadata)
  const headerMatch = fileDiff.match(/^(diff --git[\s\S]*?@@[^\n]*\n)/);
  const header = headerMatch ? headerMatch[1] : '';
  const body = headerMatch ? fileDiff.substring(header.length) : fileDiff;
  
  // Chunk the body
  const bodyChunks = chunkText(body, { chunkSize: chunkSize - header.length, overlap });
  
  for (let i = 0; i < bodyChunks.length; i++) {
    const isFirst = i === 0;
    const prefix = isFirst ? header : `[Continued: ${fileName} - Part ${i + 1}/${bodyChunks.length}]\n`;
    
    chunks.push({
      content: prefix + bodyChunks[i].content,
      partIndex: i,
      partTotal: bodyChunks.length
    });
  }
  
  return chunks;
}

/**
 * Merge analysis results from multiple chunks
 * @param {Array<Object>} analyses - Array of analysis results from each chunk
 * @returns {Object} - Merged analysis result
 */
function mergeChunkAnalyses(analyses) {
  if (!analyses || analyses.length === 0) {
    return null;
  }

  if (analyses.length === 1) {
    return analyses[0];
  }

  console.log(`[Chunking] Merging ${analyses.length} chunk analyses`);

  // Collect all entities, deduplicate by name+file
  const entitiesMap = new Map();
  const allSemanticTags = new Set();
  const allSuggestedSections = new Map();
  
  let primaryChangeType = 'unknown';
  let changeTypeCounts = {};
  let maxImpactLevel = 'patch';
  const impactOrder = { patch: 0, minor: 1, major: 2 };
  
  const technicalSummaries = [];

  for (const analysis of analyses) {
    if (!analysis || !analysis.success) continue;

    // Aggregate change types
    if (analysis.changeType) {
      changeTypeCounts[analysis.changeType] = (changeTypeCounts[analysis.changeType] || 0) + 1;
    }

    // Track max impact
    if (analysis.impactLevel && impactOrder[analysis.impactLevel] > impactOrder[maxImpactLevel]) {
      maxImpactLevel = analysis.impactLevel;
    }

    // Collect entities
    if (analysis.entities) {
      for (const entity of analysis.entities) {
        const key = `${entity.type}:${entity.name}:${entity.file}`;
        if (!entitiesMap.has(key)) {
          entitiesMap.set(key, entity);
        }
      }
    }

    // Collect semantic tags
    if (analysis.semanticTags) {
      analysis.semanticTags.forEach(tag => allSemanticTags.add(tag));
    }

    // Collect suggested sections (take highest confidence per section)
    if (analysis.suggestedSections) {
      for (const suggestion of analysis.suggestedSections) {
        const existing = allSuggestedSections.get(suggestion.sectionId);
        if (!existing || existing.confidence < suggestion.confidence) {
          allSuggestedSections.set(suggestion.sectionId, suggestion);
        }
      }
    }

    // Collect summaries
    if (analysis.technicalSummary) {
      technicalSummaries.push(analysis.technicalSummary);
    }
  }

  // Determine primary change type (most frequent)
  let maxCount = 0;
  for (const [type, count] of Object.entries(changeTypeCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primaryChangeType = type;
    }
  }

  // Combine technical summaries
  const combinedSummary = technicalSummaries.length === 1 
    ? technicalSummaries[0]
    : technicalSummaries.slice(0, 3).join(' Additionally, ');

  return {
    success: true,
    changeType: primaryChangeType,
    impactLevel: maxImpactLevel,
    entities: Array.from(entitiesMap.values()).slice(0, 20),
    semanticTags: Array.from(allSemanticTags).slice(0, 10),
    technicalSummary: combinedSummary.substring(0, 1000),
    suggestedSections: Array.from(allSuggestedSections.values())
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5),
    metadata: {
      analyzedAt: new Date(),
      chunksProcessed: analyses.length,
      mergedResult: true
    }
  };
}

module.exports = {
  chunkText,
  chunkDiff,
  mergeChunkAnalyses,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_OVERLAP,
  extractFilesFromDiff
};
