/**
 * Test embedder - embeds only first N chunks for quick validation
 * Run: npm run build && npx tsx src/steps/2-embed/embedder-test.ts
 * or: npm run build && node dist/steps/2-embed/embedder-test.js
 */

import fs from 'fs';
import path from 'path';
import { v5 as uuidv5 } from 'uuid';
import { EmbeddingService } from '../../services/EmbeddingService.js';
import { VectorStoreService } from '../../services/VectorStoreService.js';

const NORMALIZED_DIR = path.join(process.cwd(), 'artifacts', 'normalized');
const COLLECTION_NAME = 'chakra-ui-docs';
const VECTOR_SIZE = 1536;
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// ============================================================================
// CONFIG: Change this number to test different batch sizes
// ============================================================================
const TEST_CHUNK_LIMIT = 5; // Embed only first 5 chunks for testing

async function main() {
  const embedding = new EmbeddingService();
  const vectorStore = new VectorStoreService();

  console.log(`\n🧪 TEST EMBEDDER - Limiting to ${TEST_CHUNK_LIMIT} chunks\n`);
  console.log('Creating collection...');
  await vectorStore.createCollection(COLLECTION_NAME, VECTOR_SIZE);

  console.log('Loading normalized chunks...');
  const files = fs.readdirSync(NORMALIZED_DIR).filter(f => f.endsWith('.json'));

  let count = 0;
  const allPoints: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }> = [];

  for (const file of files) {
    const filePath = path.join(NORMALIZED_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const chunks = Array.isArray(data) ? data : [data];

    for (const chunk of chunks) {
      // ========================================================================
      // STOP after TEST_CHUNK_LIMIT chunks
      // ========================================================================
      if (count >= TEST_CHUNK_LIMIT) {
        console.log(`\n⏹️  Stopping at ${TEST_CHUNK_LIMIT} chunks for testing`);
        console.log(`(${files.length} files available, ${chunks.length} chunks in current file)\n`);
        break;
      }

      const text = `${chunk.content?.explanation || ''} ${chunk.content?.demonstrates?.join(' ') || ''}`;
      if (text.trim().length === 0) continue;

      count++;
      const chunkId = chunk.metadata?.chunkId;
      console.log(`  [${count}] Embedding ${chunkId}...`);

      const vector = await embedding.embedText(text);

      // Generate deterministic UUID from chunkId
      const pointId = uuidv5(chunkId, NAMESPACE);

      allPoints.push({
        id: pointId,
        vector,
        payload: {
          chunkId,
          componentName: chunk.metadata?.componentName,
          sourceUrl: chunk.metadata?.sourceUrl,
          explanation: chunk.content?.explanation,
          code: chunk.content?.code,
        },
      });
    }

    if (count >= TEST_CHUNK_LIMIT) break;
  }

  console.log(`\nUpserting ${allPoints.length} test points to Qdrant...`);

  // Upsert all test points at once (since there are so few)
  try {
    await vectorStore.upsertPoints(COLLECTION_NAME, allPoints);
    console.log(`✅ Success! Embedded ${allPoints.length} test chunks.\n`);

    // Show what was inserted
    console.log('📋 Test chunks inserted:');
    allPoints.forEach((p, idx) => {
      console.log(`  [${idx + 1}] ${p.payload.chunkId} (UUID: ${p.id})`);
    });

    console.log('\n✨ Test successful! UUID format is valid.');
    console.log('\n📝 Next steps:');
    console.log('  1. Test retrieval: npm run search "your query"');
    console.log('  2. If retrieval works, run full embedder: npm run embed');
    console.log('  3. Monitor progress: watch the batch counter in embedder output\n');
  } catch (error) {
    console.error('❌ Upsert failed:', error);
    throw error;
  }
}

main().catch(console.error);
