// Quick verification script for new modules
console.log('Testing module loading...');

try {
  const chunking = require('./src/services/chunkingService');
  console.log('✓ chunkingService loaded');
  console.log('  - chunkText:', typeof chunking.chunkText);
  console.log('  - chunkDiff:', typeof chunking.chunkDiff);
  console.log('  - mergeChunkAnalyses:', typeof chunking.mergeChunkAnalyses);
} catch (e) {
  console.error('✗ chunkingService failed:', e.message);
}

try {
  const repoAnalyzer = require('./src/services/repositoryAnalyzerService');
  console.log('✓ repositoryAnalyzerService loaded');
  console.log('  - analyzeRepositoryForInitialReport:', typeof repoAnalyzer.analyzeRepositoryForInitialReport);
} catch (e) {
  console.error('✗ repositoryAnalyzerService failed:', e.message);
}

try {
  const gitParser = require('./src/services/gitParser');
  console.log('✓ gitParser loaded');
  console.log('  - getFileImportance:', typeof gitParser.getFileImportance);
  console.log('  - PRIORITY_FILES:', Array.isArray(gitParser.PRIORITY_FILES));
} catch (e) {
  console.error('✗ gitParser failed:', e.message);
}

try {
  const analyzerPrompt = require('./src/prompts/analyzerPrompt');
  console.log('✓ analyzerPrompt loaded');
  console.log('  - createChunkedAnalyzerPrompt:', typeof analyzerPrompt.createChunkedAnalyzerPrompt);
} catch (e) {
  console.error('✗ analyzerPrompt failed:', e.message);
}

try {
  const writerPrompt = require('./src/prompts/writerPrompt');
  console.log('✓ writerPrompt loaded');
} catch (e) {
  console.error('✗ writerPrompt failed:', e.message);
}

console.log('\nVerification complete!');
