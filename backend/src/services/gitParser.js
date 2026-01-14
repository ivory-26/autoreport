/**
 * Git Parser Service
 * 
 * Parses GitHub webhook payloads and extracts meaningful diff information.
 * Filters out noise files like lockfiles, assets, and node_modules.
 */

// Files and patterns to ignore (noise that doesn't belong in reports)
const IGNORED_PATTERNS = [
  // Lock files
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /Gemfile\.lock$/,
  /Cargo\.lock$/,
  /poetry\.lock$/,
  /composer\.lock$/,
  /Pipfile\.lock$/,
  
  // Dependencies
  /^node_modules\//,
  /^vendor\//,
  /^\.venv\//,
  /^venv\//,
  /^__pycache__\//,
  
  // Build outputs
  /^dist\//,
  /^build\//,
  /^out\//,
  /^\.next\//,
  /^\.nuxt\//,
  /^\.output\//,
  /^target\//,
  /^bin\//,
  /^obj\//,
  
  // Assets (binary files that aren't meaningful in diffs)
  /\.(png|jpg|jpeg|gif|ico|svg|webp|bmp|tiff)$/i,
  /\.(mp3|mp4|wav|avi|mov|webm)$/i,
  /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i,
  /\.(woff|woff2|ttf|eot|otf)$/i,
  /\.(zip|tar|gz|rar|7z)$/i,
  
  // IDE and editor files
  /^\.idea\//,
  /^\.vscode\/(?!settings\.json|extensions\.json)/,
  /^\.vs\//,
  /\.swp$/,
  /\.swo$/,
  /~$/,
  
  // OS files
  /\.DS_Store$/,
  /Thumbs\.db$/,
  /desktop\.ini$/,
  
  // Generated files
  /\.min\.js$/,
  /\.min\.css$/,
  /\.map$/,
  /\.d\.ts$/, // TypeScript declaration files (usually auto-generated)
  
  // Coverage and reports
  /^coverage\//,
  /^\.nyc_output\//,
  /lcov\.info$/,
  
  // Logs
  /\.log$/,
  /^logs\//
];

// Patterns that might be noise but could be significant
const MAYBE_SIGNIFICANT = [
  /^\.env\.example$/,
  /^\.gitignore$/,
  /^Dockerfile$/,
  /^docker-compose\.yml$/,
  /^\.github\//
];

/**
 * Check if a file path should be ignored
 * @param {string} filePath - The file path to check
 * @returns {boolean} - True if the file should be ignored
 */
function shouldIgnoreFile(filePath) {
  return IGNORED_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Check if a file might be significant (config/infra files)
 * @param {string} filePath - The file path to check
 * @returns {boolean} - True if the file might be significant
 */
function mightBeSignificant(filePath) {
  return MAYBE_SIGNIFICANT.some(pattern => pattern.test(filePath));
}

/**
 * Extract file extension category
 * @param {string} filePath - The file path
 * @returns {string} - Category of the file
 */
function getFileCategory(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  const categories = {
    code: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'go', 'rs', 'rb', 'php', 'cs', 'cpp', 'c', 'h'],
    config: ['json', 'yaml', 'yml', 'toml', 'ini', 'env', 'properties'],
    docs: ['md', 'mdx', 'txt', 'rst'],
    styles: ['css', 'scss', 'sass', 'less', 'styl'],
    templates: ['html', 'htm', 'ejs', 'pug', 'hbs', 'handlebars', 'jinja', 'j2'],
    data: ['sql', 'graphql', 'gql', 'prisma'],
    test: ['test', 'spec'], // Usually combined with .js, .ts, etc.
    shell: ['sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd']
  };

  for (const [category, extensions] of Object.entries(categories)) {
    if (extensions.includes(ext)) {
      return category;
    }
  }

  // Check if it's a test file by path or naming
  if (filePath.includes('test') || filePath.includes('spec') || filePath.includes('__tests__')) {
    return 'test';
  }

  return 'other';
}

/**
 * Parse a GitHub push webhook payload
 * @param {Object} payload - The GitHub webhook payload
 * @returns {Object} - Parsed commit information
 */
function parseGitHubPushPayload(payload) {
  const { repository, commits, head_commit, pusher, ref, before, after } = payload;

  // Extract branch name from ref (e.g., "refs/heads/main" -> "main")
  const branch = ref?.replace('refs/heads/', '') || 'unknown';

  // Get the head commit (most recent)
  const mainCommit = head_commit || commits?.[0];

  if (!mainCommit) {
    return {
      valid: false,
      reason: 'No commits in payload'
    };
  }

  return {
    valid: true,
    repository: {
      fullName: repository?.full_name,
      name: repository?.name,
      url: repository?.html_url,
      defaultBranch: repository?.default_branch
    },
    branch,
    pusher: pusher?.name || pusher?.email,
    beforeSha: before,
    afterSha: after,
    commit: {
      hash: mainCommit.id,
      shortHash: mainCommit.id?.substring(0, 7),
      message: mainCommit.message,
      author: mainCommit.author?.name || mainCommit.author?.username,
      authorEmail: mainCommit.author?.email,
      timestamp: mainCommit.timestamp,
      url: mainCommit.url
    },
    files: {
      added: mainCommit.added || [],
      modified: mainCommit.modified || [],
      removed: mainCommit.removed || []
    },
    allCommits: commits?.map(c => ({
      hash: c.id,
      message: c.message,
      author: c.author?.name
    })) || []
  };
}

/**
 * Filter files and categorize them
 * @param {Object} files - Object with added, modified, removed arrays
 * @returns {Object} - Filtered and categorized files
 */
function filterAndCategorizeFiles(files) {
  const result = {
    relevant: [],
    ignored: [],
    maybeSignificant: [],
    byCategory: {}
  };

  const allFiles = [
    ...files.added.map(f => ({ path: f, action: 'added' })),
    ...files.modified.map(f => ({ path: f, action: 'modified' })),
    ...files.removed.map(f => ({ path: f, action: 'removed' }))
  ];

  for (const file of allFiles) {
    if (shouldIgnoreFile(file.path)) {
      result.ignored.push(file);
    } else if (mightBeSignificant(file.path)) {
      result.maybeSignificant.push(file);
      result.relevant.push(file);
    } else {
      result.relevant.push(file);
    }

    // Categorize
    const category = getFileCategory(file.path);
    if (!result.byCategory[category]) {
      result.byCategory[category] = [];
    }
    result.byCategory[category].push(file);
  }

  return result;
}

/**
 * Clean and truncate diff content for AI processing
 * @param {string} diff - Raw diff content
 * @param {number} maxLength - Maximum length in characters
 * @returns {string} - Cleaned diff
 */
function cleanDiff(diff, maxLength = 15000) {
  if (!diff) return '';

  let cleaned = diff;

  // Remove binary file indicators
  cleaned = cleaned.replace(/Binary files .+ differ\n/g, '[Binary file changed]\n');

  // Remove long lines of repeated characters (often in minified files)
  cleaned = cleaned.replace(/^.{500,}$/gm, '[Long line truncated]');

  // Truncate if too long
  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength) + '\n\n[Diff truncated for processing]';
  }

  return cleaned;
}

/**
 * Build a summary of changes for AI context
 * @param {Object} parsedPayload - Output from parseGitHubPushPayload
 * @param {Object} filteredFiles - Output from filterAndCategorizeFiles
 * @returns {Object} - Change summary
 */
function buildChangeSummary(parsedPayload, filteredFiles) {
  const { commit, allCommits } = parsedPayload;
  const { relevant, ignored, byCategory } = filteredFiles;

  return {
    commitCount: allCommits.length,
    primaryCommit: {
      message: commit.message,
      author: commit.author,
      hash: commit.shortHash
    },
    fileStats: {
      total: relevant.length + ignored.length,
      relevant: relevant.length,
      ignored: ignored.length
    },
    categorySummary: Object.entries(byCategory).map(([category, files]) => ({
      category,
      count: files.length,
      actions: {
        added: files.filter(f => f.action === 'added').length,
        modified: files.filter(f => f.action === 'modified').length,
        removed: files.filter(f => f.action === 'removed').length
      }
    })),
    relevantFiles: relevant.map(f => f.path)
  };
}

/**
 * Main function to process a GitHub webhook payload
 * @param {Object} payload - Raw GitHub webhook payload
 * @param {string} diff - Git diff content (if available)
 * @returns {Object} - Processed payload ready for AI
 */
function processWebhookPayload(payload, diff = '') {
  const parsed = parseGitHubPushPayload(payload);
  
  if (!parsed.valid) {
    return { valid: false, reason: parsed.reason };
  }

  const filteredFiles = filterAndCategorizeFiles(parsed.files);
  const summary = buildChangeSummary(parsed, filteredFiles);
  const cleanedDiff = cleanDiff(diff);

  // Skip if no relevant files
  if (filteredFiles.relevant.length === 0) {
    return {
      valid: false,
      reason: 'All files are ignored (lockfiles, assets, etc.)',
      skipped: true,
      ignoredFiles: filteredFiles.ignored.map(f => f.path)
    };
  }

  return {
    valid: true,
    repository: parsed.repository,
    branch: parsed.branch,
    commit: parsed.commit,
    pusher: parsed.pusher,
    files: filteredFiles,
    summary,
    diff: cleanedDiff,
    metadata: {
      receivedAt: new Date().toISOString(),
      webhookType: 'push'
    }
  };
}

module.exports = {
  parseGitHubPushPayload,
  filterAndCategorizeFiles,
  cleanDiff,
  buildChangeSummary,
  processWebhookPayload,
  shouldIgnoreFile,
  getFileCategory,
  IGNORED_PATTERNS
};
