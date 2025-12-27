# Vector DB POC - START HERE

**You are here:** Ready to implement minimal POC
**Timeline:** 3-4 days
**Complexity:** Low - just 280 lines of straightforward code

---

## What You're Building

A system to:
1. Embed 387 code example chunks using OpenAI
2. Store them in Qdrant
3. Search by semantic similarity
4. Validate the approach works

**NOT building:** Production system, fancy UI, error recovery

---

## Before You Start

### 1. Read This File (5 min)
You're reading it now ✅

### 2. Read POC_MUST_HAVES.md (10 min)
It has all the minimal code you need

### 3. Get Your OpenAI API Key
- Go to https://platform.openai.com/api/keys
- Create new secret key
- Copy it (you'll need it in .env)

### 4. Verify Docker
```bash
docker --version
docker-compose --version
```

---

## The 7 Must-Do Items

| # | Task | Lines | Time | Status |
|---|------|-------|------|--------|
| 1 | docker-compose.yml | 30 | 15 min | ⬜ |
| 2 | EmbeddingService.ts | 40 | 45 min | ⬜ |
| 3 | VectorStoreService.ts | 60 | 45 min | ⬜ |
| 4 | embedder.ts | 80 | 60 min | ⬜ |
| 5 | RetrievalService.ts | 30 | 30 min | ⬜ |
| 6 | retriever.ts | 40 | 30 min | ⬜ |
| 7 | Manual testing | — | 60 min | ⬜ |

**Total: ~3.5 hours of actual coding**
*Plus 2-3 hours waiting for embeddings to generate*

---

## Step-by-Step Instructions

### Step 1: Setup (15 minutes)

**1.1 Create docker-compose.yml**

Copy this to root directory:

```yaml
version: '3.9'

services:
  qdrant:
    image: qdrant/qdrant:v1.7.0
    container_name: qdrant-chakra-ui
    ports:
      - "6333:6333"
    volumes:
      - qdrant_storage:/qdrant/storage:z
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  qdrant_storage:
```

**1.2 Start Qdrant**

```bash
docker-compose up -d qdrant
sleep 5
curl http://localhost:6333/health
# Should return: {"status":"ok"}
```

**1.3 Install dependencies**

```bash
npm install openai @qdrant/js-client
```

**1.4 Create .env**

Copy `.env.example` and add:
```bash
OPENAI_API_KEY=sk-...your-key-here...
QDRANT_URL=http://localhost:6333
```

---

### Step 2: EmbeddingService (45 minutes)

**2.1 Create file:** `src/services/EmbeddingService.ts`

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

**2.2 Test it**

```bash
npm run build
node -e "
const {EmbeddingService} = require('./dist/services/EmbeddingService');
const svc = new EmbeddingService();
svc.embedText('Hello world').then(emb => console.log('Embedding length:', emb.length));
"
# Should print: Embedding length: 1536
```

✅ **Checkpoint:** You can embed text

---

### Step 3: VectorStoreService (45 minutes)

**3.1 Create file:** `src/services/VectorStoreService.ts`

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
      console.log(`✅ Collection "${name}" created`);
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

**3.2 Test it**

```bash
npm run build
node -e "
const {VectorStoreService} = require('./dist/services/VectorStoreService');
const svc = new VectorStoreService();
svc.createCollection('test-collection', 1536).then(() => console.log('OK'));
"
```

✅ **Checkpoint:** You can create Qdrant collections

---

### Step 4: Embedder (60 minutes including wait)

**4.1 Create directory:** `src/steps/2-embed/`

```bash
mkdir -p src/steps/2-embed
```

**4.2 Create file:** `src/steps/2-embed/embedder.ts`

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
      const text = `${chunk.content?.explanation || ''} ${chunk.content?.demonstrates?.join(' ') || ''}`;
      if (text.trim().length === 0) continue;

      console.log(`  [${pointId}] Embedding ${chunk.metadata?.chunkId}...`);

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

  console.log(`\nUpserting ${allPoints.length} points to Qdrant...`);
  await vectorStore.upsertPoints(COLLECTION_NAME, allPoints);

  console.log(`✅ Success! Embedded ${allPoints.length} chunks.`);
}

main().catch(console.error);
```

**4.3 Run it**

```bash
npm run build
node dist/steps/2-embed/embedder.js
```

**This will take 2-3 minutes.** You'll see:
```
Creating collection...
✅ Collection "chakra-ui-docs" created
Loading normalized chunks...
  [1] Embedding button-example-usage-example-v1...
  [2] Embedding button-example-sizing-v1...
  ...
  [387] Embedding ...

Upserting 387 points to Qdrant...
✅ Success! Embedded 387 chunks.
```

✅ **Checkpoint:** All chunks are embedded and in Qdrant

---

### Step 5: RetrievalService (30 minutes)

**5.1 Create file:** `src/services/RetrievalService.ts`

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

✅ **Checkpoint:** You can search

---

### Step 6: Retriever CLI (30 minutes)

**6.1 Create directory:** `src/steps/3-search/`

```bash
mkdir -p src/steps/3-search
```

**6.2 Create file:** `src/steps/3-search/retriever.ts`

```typescript
import { RetrievalService } from '../../services/RetrievalService.js';

async function main() {
  const query = process.argv[2];

  if (!query) {
    console.error('Usage: node retriever.js "<query>"');
    process.exit(1);
  }

  console.log('Searching...\n');

  const retrieval = new RetrievalService();
  const results = await retrieval.search(query, 5);

  console.log(`📌 Query: "${query}"\n`);

  for (const result of results) {
    console.log(`\n[${result.rank}] Score: ${(result.score as number).toFixed(3)}`);
    console.log(`Component: ${result.componentName}`);
    console.log(`Chunk: ${result.chunkId}`);
    const explanation = (result.explanation as string || '').substring(0, 200);
    console.log(`\n${explanation}...`);
    const code = (result.code as string || '').substring(0, 150);
    console.log(`\nCode:\n${code}...\n`);
    console.log('─'.repeat(60));
  }
}

main().catch(console.error);
```

**6.3 Test it**

```bash
npm run build
node dist/steps/3-search/retriever.js "How do I size a button?"
```

**Expected output:**
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
...
```

✅ **Checkpoint:** You can search and get results

---

### Step 7: Validation (60 minutes)

**7.1 Test 5 queries manually**

```bash
node dist/steps/3-search/retriever.js "How do I size a button?"
node dist/steps/3-search/retriever.js "button variants"
node dist/steps/3-search/retriever.js "loading state"
node dist/steps/3-search/retriever.js "button with icons"
node dist/steps/3-search/retriever.js "button color"
```

**7.2 Record results**

For each query:
- [ ] Is top result relevant? (Yes/No)
- [ ] Score > 0.80? (Yes/No)
- [ ] Makes sense? (Yes/No)

**7.3 Make decision**

- If 4-5 queries work → **POC SUCCESS** ✅
- If <4 queries work → Debug and retry

---

## Expected Results

After 3-4 days, you should have:

✅ **docker-compose.yml running** - Qdrant available
✅ **387 chunks embedded** - All in Qdrant
✅ **Search working** - Gets 5 results per query
✅ **Most results relevant** - 80%+ make sense
✅ **Fast latency** - Results in <1 second

---

## Success Criteria

**POC is done when:**

1. [ ] `curl http://localhost:6333/health` returns 200
2. [ ] `npm run build` succeeds
3. [ ] `node dist/steps/2-embed/embedder.js` completes (387 chunks)
4. [ ] `node dist/steps/3-search/retriever.js "query"` returns 5 results
5. [ ] 4+ test queries return relevant top results
6. [ ] Average latency < 1 second

---

## Troubleshooting

**Q: "connection ECONNREFUSED"**
A: Docker not running → `docker-compose up -d qdrant`

**Q: "401 Unauthorized" from OpenAI**
A: Wrong API key → Check OPENAI_API_KEY in .env

**Q: "No search results"**
A: Collections not populated → Run embedder again

**Q: "embedText is not a function"**
A: Build failed → `npm run build` again

---

## Next After POC

Once POC works:

1. Commit your code
2. Write 1 paragraph about results
3. Decide: Build more transformers? OR iterate on this one?

---

## Files You'll Create

```
✅ docker-compose.yml                    (30 lines)
✅ src/services/EmbeddingService.ts       (40 lines)
✅ src/services/VectorStoreService.ts     (60 lines)
✅ src/services/RetrievalService.ts       (30 lines)
✅ src/steps/2-embed/embedder.ts          (80 lines)
✅ src/steps/3-search/retriever.ts        (40 lines)
✅ .env                                    (copy from .env.example)
```

**Total: ~280 lines**

---

## Estimated Timeline

| Phase | Time | Done? |
|-------|------|-------|
| 1. Setup Docker + deps | 15 min | ⬜ |
| 2. EmbeddingService | 45 min | ⬜ |
| 3. VectorStoreService | 45 min | ⬜ |
| 4. Embedder | 60 min* | ⬜ |
| 5. RetrievalService | 30 min | ⬜ |
| 6. Retriever CLI | 30 min | ⬜ |
| 7. Validation | 60 min | ⬜ |

*Includes waiting for API calls

**Total: 3-4 days actual work time**

---

## You're Ready!

Everything you need is in **POC_MUST_HAVES.md** with exact code.

Just follow the steps above.

No overthinking. No scope creep.

**Go build! 🚀**
