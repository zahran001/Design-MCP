import fs from 'fs';
import path from 'path';
import { v5 as uuidv5 } from 'uuid';
import { EmbeddingService } from '../../services/EmbeddingService.js';
import { VectorStoreService } from '../../services/VectorStoreService.js';

const NORMALIZED_DIR = path.join(process.cwd(), 'artifacts', 'normalized');
const COLLECTION_NAME = 'chakra-ui-docs';
const VECTOR_SIZE = 1536;

// Deterministic namespace UUID for generating consistent IDs from chunk strings
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

async function main() {
  const embedding = new EmbeddingService();
  const vectorStore = new VectorStoreService();

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
      const text = `${chunk.content?.explanation || ''} ${chunk.content?.demonstrates?.join(' ') || ''}`;
      if (text.trim().length === 0) continue;

      count++;
      const chunkId = chunk.metadata?.chunkId;
      console.log(`  [${count}] Embedding ${chunkId}...`);

      const vector = await embedding.embedText(text);

      // Generate deterministic UUID from chunkId
      // Same chunkId always produces the same UUID (idempotent)
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
  }

  console.log(`\nUpserting ${allPoints.length} points to Qdrant...`);

  // Batch upsert in chunks of 100 to avoid oversized requests
  const BATCH_SIZE = 100;
  for (let i = 0; i < allPoints.length; i += BATCH_SIZE) {
    const batch = allPoints.slice(i, i + BATCH_SIZE);
    console.log(`  Upserting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allPoints.length / BATCH_SIZE)} (${batch.length} points)...`);
    await vectorStore.upsertPoints(COLLECTION_NAME, batch);
  }

  console.log(`✅ Success! Embedded ${allPoints.length} chunks.`);
}

main().catch(console.error);
