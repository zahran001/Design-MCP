import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { v5 as uuidv5 } from 'uuid';
import { EmbeddingService } from '../../services/EmbeddingService.js';
import { VectorStoreService } from '../../services/VectorStoreService.js';
import { getCollectionName, getEmbeddingDimensions } from '../../config/vectorConfig.js';
import { extractEmbeddingText } from './utils/extractEmbeddingText.js';

const NORMALIZED_DIR = path.join(process.cwd(), 'artifacts', 'normalized');

// Deterministic namespace UUID for generating consistent IDs from chunk strings
const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

export interface EmbedderRunOptions {
  normalizedDir?: string;
  collectionName?: string;
  vectorSize?: number;
  batchSize?: number;
  limit?: number;
}

export async function runEmbedder(options: EmbedderRunOptions = {}): Promise<number> {
  const embedding = new EmbeddingService();
  const vectorStore = new VectorStoreService();
  const normalizedDir = options.normalizedDir || NORMALIZED_DIR;
  const collectionName = options.collectionName || getCollectionName();
  const vectorSize = options.vectorSize || getEmbeddingDimensions();
  const batchSize = options.batchSize || 100;
  const limit = options.limit;

  console.log('Creating collection...');
  await vectorStore.createCollection(collectionName, vectorSize);

  // Reserved-slot retrieval filters on componentName + chunkType. Qdrant Cloud
  // requires a payload index to filter (local Qdrant full-scans without one), so
  // create them here — else grounded generation 400s against a fresh cloud cluster.
  await vectorStore.ensurePayloadIndexes(collectionName, ['componentName', 'chunkType']);

  console.log('Loading normalized chunks...');
  const files = fs.readdirSync(normalizedDir).filter(f => f.endsWith('.json'));

  let count = 0;
  const allPoints: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }> = [];
  let reachedLimit = false;

  for (const file of files) {
    const filePath = path.join(normalizedDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const chunks = Array.isArray(data) ? data : [data];

    for (const chunk of chunks) {
      if (typeof limit === 'number' && count >= limit) {
        reachedLimit = true;
        break;
      }

      let text: string;
      try {
        text = extractEmbeddingText(chunk);
      } catch (error) {
        console.warn(`  âš ï¸  Skipping chunk (extraction failed): ${chunk.metadata?.chunkId}`);
        console.warn(`     Error: ${(error as Error).message}`);
        continue;
      }

      if (text.trim().length === 0) {
        continue;
      }

      count++;
      const chunkId = chunk.metadata?.chunkId;
      console.log(`  [${count}] Embedding ${chunkId}...`);

      const vector = await embedding.embedText(text);

      // Same chunkId always produces the same UUID (idempotent)
      const pointId = uuidv5(chunkId, NAMESPACE);

      allPoints.push({
        id: pointId,
        vector,
        payload: {
          chunkType: chunk.metadata?.chunkType || 'unknown',
          chunkId: chunk.metadata?.chunkId,
          componentName: chunk.metadata?.componentName,
          category: chunk.metadata?.category,
          tags: chunk.metadata?.tags || [],
          sourceUrl: chunk.metadata?.sourceUrl,
          version: chunk.metadata?.version,
          complexity: chunk.metadata?.complexity,
          // explanation falls back to description so overview/capability chunks
          // expose readable text in the payload (used by the LLM judge).
          explanation: chunk.content?.explanation ?? chunk.content?.description,
          code: chunk.content?.code,
          demonstrates: chunk.content?.demonstrates,
          propName: (chunk as any).prop?.name,
          propCategory: (chunk as any).prop?.category,
          propDescription: (chunk.content as any)?.description,
          propType: (chunk.content as any)?.typeExplanation,
          fullChunk: JSON.stringify(chunk),
        },
      });
    }

    if (reachedLimit) {
      break;
    }
  }

  console.log(`\nUpserting ${allPoints.length} points to Qdrant...`);

  for (let i = 0; i < allPoints.length; i += batchSize) {
    const batch = allPoints.slice(i, i + batchSize);
    console.log(`  Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allPoints.length / batchSize)} (${batch.length} points)...`);
    await vectorStore.upsertPoints(collectionName, batch);
  }

  console.log(`âœ… Success! Embedded ${allPoints.length} chunks.`);
  return allPoints.length;
}

async function main() {
  await runEmbedder();
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
