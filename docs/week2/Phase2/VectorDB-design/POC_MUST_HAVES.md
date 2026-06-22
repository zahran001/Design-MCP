# Vector DB POC - Must-Have Steps Only

**Goal:** Minimal viable POC to validate vector search approach
**Timeline:** 3-4 days (aggressive but achievable)
**Success:** Search 387 chunks, get 80%+ relevant results

---

## Phase 1: Setup (Day 1 - 1-2 hours)

### Must-Have #1: Docker + Dependencies
```bash
# 1. Create docker-compose.yml (copy from VECTOR_DB_POC_GUIDE.md)
# 2. Start: docker-compose up -d qdrant
# 3. Verify: curl http://localhost:6333/health

# 4. Add to package.json:
npm install openai @qdrant/js-client
```

**That's it. No extras needed.**

---

## Phase 2: Embedding (Day 1-2 - 3-4 hours)

### Must-Have #2: EmbeddingService (Minimal)

**File:** `src/services/EmbeddingService.ts`

**Absolute minimum code:**
```typescript
import { OpenAI } from 'openai';

export class EmbeddingService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async embedText(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });
    return response.data.map(item => item.embedding);
  }
}
```

**That's it. No retry logic, no batching strategy, no cost tracking yet.**

---

### Must-Have #3: VectorStoreService (Minimal)

**File:** `src/services/VectorStoreService.ts`

**Absolute minimum code:**
```typescript
import { QdrantClient } from '@qdrant/js-client';

export interface VectorPoint {
  id: number;
  vector: number[];
  payload: Record<string, unknown>;
}

export class VectorStoreService {
  private client: QdrantClient;

  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
    });
  }

  async createCollection(name: string, vectorSize: number): Promise<void> {
    try {
      await this.client.recreateCollection(name, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      });
    } catch (error) {
      console.error('Collection creation failed:', error);
      throw error;
    }
  }

  async upsertPoints(collectionName: string, points: VectorPoint[]): Promise<void> {
    await this.client.upsert(collectionName, {
      points: points.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    });
  }

  async search(
    collectionName: string,
    queryVector: number[],
    limit: number = 5
  ): Promise<Array<{ id: number; score: number; payload: Record<string, unknown> }>> {
    const results = await this.client.search(collectionName, {
      vector: queryVector,
      limit,
    });
    return results.map(r => ({
      id: r.id,
      score: r.score,
      payload: r.payload,
    }));
  }
}
```

**That's it. No filtering, no collection management, no error recovery.**

---

## Phase 3: Load & Embed (Day 2 - 3-4 hours)

### Must-Have #4: Embedder Script

**File:** `src/steps/2-embed/embedder.ts`

**Absolute minimum code:**
```typescript
import fs from 'fs';
import path from 'path';
import { EmbeddingService } from '../../services/EmbeddingService.js';
import { VectorStoreService } from '../../services/VectorStoreService.js';

const NORMALIZED_DIR = path.join(process.cwd(), 'artifacts', 'normalized');
const COLLECTION_NAME = 'chakra-ui-docs';
const VECTOR_SIZE = 1536;

async function main() {
  const embedding = new EmbeddingService();
  const vectorStore = new VectorStoreService();

  console.log('Creating collection...');
  await vectorStore.createCollection(COLLECTION_NAME, VECTOR_SIZE);

  console.log('Loading normalized chunks...');
  const files = fs.readdirSync(NORMALIZED_DIR).filter(f => f.endsWith('.json'));

  let pointId = 1;
  const allPoints: Array<{ id: number; vector: number[]; payload: Record<string, unknown> }> = [];

  for (const file of files) {
    const filePath = path.join(NORMALIZED_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const chunks = Array.isArray(data) ? data : [data];

    for (const chunk of chunks) {
      // Extract text to embed
      const text = `${chunk.content?.explanation || ''} ${chunk.content?.demonstrates?.join(' ') || ''}`;

      if (text.trim().length === 0) continue;

      console.log(`  Embedding ${pointId}/${chunks.length * files.length}: ${chunk.metadata?.chunkId}`);

      const vector = await embedding.embedText(text);

      allPoints.push({
        id: pointId,
        vector,
        payload: {
          chunkId: chunk.metadata?.chunkId,
          componentName: chunk.metadata?.componentName,
          sourceUrl: chunk.metadata?.sourceUrl,
          explanation: chunk.content?.explanation,
          code: chunk.content?.code,
        },
      });

      pointId++;
    }
  }

  console.log(`Upserting ${allPoints.length} points to Qdrant...`);
  await vectorStore.upsertPoints(COLLECTION_NAME, allPoints);

  console.log(`✅ Done! Embedded ${allPoints.length} chunks.`);
}

main().catch(console.error);
```

**That's it. Single-threaded, no batching, no progress tracking, no error recovery.**

---

## Phase 4: Search CLI (Day 3 - 2-3 hours)

### Must-Have #5: Retrieval Service (Minimal)

**File:** `src/services/RetrievalService.ts`

**Absolute minimum code:**
```typescript
import { EmbeddingService } from './EmbeddingService.js';
import { VectorStoreService } from './VectorStoreService.js';

const COLLECTION_NAME = 'chakra-ui-docs';

export class RetrievalService {
  private embedding: EmbeddingService;
  private vectorStore: VectorStoreService;

  constructor() {
    this.embedding = new EmbeddingService();
    this.vectorStore = new VectorStoreService();
  }

  async search(query: string, limit: number = 5) {
    const queryVector = await this.embedding.embedText(query);
    const results = await this.vectorStore.search(COLLECTION_NAME, queryVector, limit);

    return results.map((result, index) => ({
      rank: index + 1,
      score: result.score,
      ...result.payload,
    }));
  }
}
```

**That's it. No filtering, no formatting, no interactive mode.**

---

### Must-Have #6: CLI Command (Minimal)

**File:** `src/steps/3-search/retriever.ts`

**Absolute minimum code:**
```typescript
import { RetrievalService } from '../../services/RetrievalService.js';

async function main() {
  const query = process.argv[2];

  if (!query) {
    console.error('Usage: ts-node retriever.ts "<query>"');
    process.exit(1);
  }

  const retrieval = new RetrievalService();
  const results = await retrieval.search(query, 5);

  console.log(`\n📌 Query: "${query}"\n`);

  for (const result of results) {
    console.log(`\n[${result.rank}] Score: ${(result.score as number).toFixed(3)}`);
    console.log(`Component: ${result.componentName}`);
    console.log(`Chunk: ${result.chunkId}`);
    console.log(`\n${(result.explanation as string)?.substring(0, 200)}...`);
    console.log(`\nCode:\n${(result.code as string)?.substring(0, 150)}...\n`);
  }
}

main().catch(console.error);
```

**That's it. No pretty printing, no interactive mode, no export.**

---

## Phase 5: Quick Validation (Day 3-4 - 1-2 hours)

### Must-Have #7: Manual Testing

**Just run these 5 queries manually:**

```bash
npm run build

# Test 1: Basic sizing
node dist/steps/3-search/retriever.js "How do I size a button?"

# Test 2: Variants
node dist/steps/3-search/retriever.js "button variants"

# Test 3: Loading state
node dist/steps/3-search/retriever.js "loading state button"

# Test 4: Icons
node dist/steps/3-search/retriever.js "button with icons"

# Test 5: Colors
node dist/steps/3-search/retriever.js "button color"
```

**Record results:**
- Is top result relevant? (yes/no)
- What's the score?
- Does it make sense?

**That's it. No formal test suite, no metrics.**

---

## What You'll Have After 3-4 Days

✅ **Working Vector Search**
- 387 chunks in Qdrant
- Can search any query
- Get 5 results with scores

✅ **Proof of Concept**
- Manual validation on 5 queries
- Evidence that approach works (or doesn't)
- Clear next steps

❌ **What You WON'T Have**
- Pretty CLI interface
- Interactive mode
- Batching/retry logic
- Cost tracking
- Formal test suite
- Detailed metrics/reporting

---

## Implementation Order (Fastest Path)

### Day 1 (4 hours)
```
1. docker-compose up -d qdrant          (30 min)
2. Create EmbeddingService.ts           (1.5 hours)
3. Create VectorStoreService.ts         (1.5 hours)
4. Test both with dummy data            (1 hour)
```

### Day 2 (4 hours)
```
1. Create embedder.ts                   (1 hour)
2. Run: npm run build && node embedder  (2 hours - mostly waiting for OpenAI)
3. Verify Qdrant collection populated   (30 min)
4. Troubleshoot any issues              (30 min)
```

### Day 3 (3 hours)
```
1. Create RetrievalService.ts           (1 hour)
2. Create retriever.ts CLI              (1 hour)
3. Test with 5 manual queries           (1 hour)
```

### Day 4 (1-2 hours) - Optional
```
1. Run 10-20 more test queries
2. Calculate P@1, P@3 scores
3. Write 1-page findings
```

---

## Testing Checklist (Minimal)

- [ ] Docker running: `curl http://localhost:6333/health`
- [ ] EmbeddingService works: Single embedding succeeds
- [ ] VectorStoreService works: Can create collection
- [ ] Embedder runs: 387 chunks uploaded
- [ ] CLI works: Gets results for "How do I size a button?"
- [ ] Results make sense: Top result is relevant

**If all ✅ = POC SUCCESS**

---

## Decision Point After POC

**Just answer these questions:**

1. Do search results make sense? (Yes/No)
2. Are most top results relevant? (Yes/No)
3. Is latency acceptable (<1 second)? (Yes/No)

**If YES to all → Build 6 more chunk transformers**
**If NO to any → Fix the issue, then decide**

---

## Git Commits (Minimal)

Just 3 commits:

```bash
# Commit 1
git add src/services/{EmbeddingService,VectorStoreService}.ts docker-compose.yml
git commit -m "Add embedding and vector store services"

# Commit 2
git add src/steps/2-embed/embedder.ts
git commit -m "Add embedder pipeline - 387 chunks uploaded to Qdrant"

# Commit 3
git add src/services/RetrievalService.ts src/steps/3-search/retriever.ts
git commit -m "Add retrieval service and CLI - POC complete"
```

---

## Environment Variables (Only What You Need)

```bash
OPENAI_API_KEY=sk-...
QDRANT_URL=http://localhost:6333
```

**That's it. No other config needed.**

---

## Success = This Output

```
📌 Query: "How do I size a button?"

[1] Score: 0.921
Component: Button
Chunk: button-example-sizing-v1

This example demonstrates how to control Button dimensions
using the size prop, showing 5 available size options...

Code:
import { Button, HStack } from "@chakra-ui/react"

const Demo = () => {
  return (
    <HStack wrap="wrap" gap="6">
      <Button size="xs">Button (xs)</Button>
...
```

If you get output like this for 5 test queries → **POC IS DONE** ✅

---

## No Scope Creep Rules

**DON'T do these yet:**
- ❌ Pretty printing / colors
- ❌ Interactive mode
- ❌ Metadata filtering
- ❌ Retry logic / error recovery
- ❌ Batch optimization
- ❌ Cost tracking
- ❌ Token counting
- ❌ Formal test suite
- ❌ Progress bars / spinners
- ❌ JSON export
- ❌ Configuration options

**Just make it work.**

---

## Files to Create (7 total)

```
✅ docker-compose.yml
✅ src/services/EmbeddingService.ts
✅ src/services/VectorStoreService.ts
✅ src/services/RetrievalService.ts
✅ src/steps/2-embed/embedder.ts
✅ src/steps/3-search/retriever.ts
✅ .env (copy from .env.example, add API key)
```

**No other files needed for POC.**

---

## Lines of Code Estimate

- EmbeddingService: ~40 lines
- VectorStoreService: ~60 lines
- RetrievalService: ~30 lines
- Embedder: ~80 lines
- Retriever CLI: ~40 lines
- docker-compose.yml: ~30 lines

**Total: ~280 lines of code**

---

## Ready to Start?

You've got everything you need. No excuses, no over-engineering. Just:

1. Start Docker
2. Write 3 services (170 lines)
3. Embed chunks (80 lines)
4. Search CLI (40 lines)
5. Test 5 queries

**3-4 days. That's it.**

Let's go! 🚀
