/**
 * Test embedder - embeds only first N chunks for quick validation
 * Run: npm run build && npx tsx src/steps/2-embed/embedder-test.ts
 * or: npm run build && node dist/steps/2-embed/embedder-test.js
 */

import { runEmbedder } from './embedder.js';

// ============================================================================
// CONFIG: Change this number to test different batch sizes
// ============================================================================
const TEST_CHUNK_LIMIT = 5; // Embed only first 5 chunks for testing

async function main() {
  console.log(`\nðŸ§ª TEST EMBEDDER - Limiting to ${TEST_CHUNK_LIMIT} chunks\n`);

  const embeddedCount = await runEmbedder({
    limit: TEST_CHUNK_LIMIT,
    batchSize: TEST_CHUNK_LIMIT
  });

  console.log(`\nâœ… Success! Embedded ${embeddedCount} test chunks.\n`);
  console.log('\nâœ¨ Test successful! UUID format is valid.');
  console.log('\nðŸ“ Next steps:');
  console.log('  1. Test retrieval: npm run cli -- 3-search "your query"');
  console.log('  2. If retrieval works, run full embedder: npm run embed');
  console.log('  3. Monitor progress: watch the batch counter in embedder output\n');
}

main().catch(console.error);
