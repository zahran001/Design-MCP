# Week 2 Implementation Guide: Knowledge Base & Advanced Retrieval

**Duration:** Days 8-19 (12 days, ~96 hours)
**Status:** Ready to Start
**Prerequisites:** Week 1 Complete (50 components extracted to `artifacts/raw-json/`)

**⚠️ IMPORTANT:** This guide now follows the **advanced normalization strategy** from [NORMALIZATION_GUIDE.md](NORMALIZATION_GUIDE.md). Key changes:
- Extended Phase 2A (Days 8-14 instead of 8-9)
- 7 specialized chunk types (vs 4 basic types)
- Inference engine + natural language generation
- Adjusted Phase 2B/2C timelines (Days 15-19)

---

## Overview

Transform raw extracted data into an intelligent, queryable knowledge base with two-stage retrieval (vector similarity + LLM re-ranking).

**End Goal:**
```bash
npm run cli -- search "accessible button with loading state"
# Returns: 10 highly relevant, re-ranked chunks with scores
```

---

## Phase 2A: Data Normalization & Preparation (Advanced Strategy)

**Timeline:** Days 8-14 (56 hours)
**Goal:** Create semantically rich, intent-based chunks optimized for LLM retrieval

**Strategy:** Advanced normalization with 7 specialized chunk types, natural language generation, and dual content strategy (embedding-optimized + API reference). See [NORMALIZATION_GUIDE.md](NORMALIZATION_GUIDE.md) for detailed implementation guide.

### Milestone 2A.1: Schema Definition & Foundation (Days 8-9, 16 hours)

**Reference:** See [NORMALIZATION_GUIDE.md - Phase 1](NORMALIZATION_GUIDE.md#phase-1-days-1-7-codeexamplechunk-only) for detailed implementation guide.

#### Task: Create Advanced Chunk Schema

**File:** `src/schemas/NormalizedChunkSchema.ts`

**Key Features:**
- 7 specialized chunk types (vs 4 basic types)
- Dual content strategy (natural language + API reference)
- Type inference and natural language generation
- Token counting and size optimization

**Chunk Types:**
1. **CodeExampleChunk** - Executable examples with inferred sections, intents, and natural language explanations
2. **CapabilityReferenceChunk** - Component capabilities (e.g., "Button supports 7 size options")
3. **PropReferenceChunk** - Individual prop documentation with type parsing
4. **ComponentOverviewChunk** - High-level component description
5. **PropGroupChunk** - Props grouped by category (appearance, behavior, etc.)
6. **CompositionPatternChunk** - How components work together
7. **APIReferenceChunk** - Complete API summary

**Example: CodeExampleChunk Structure**

```typescript
interface CodeExampleChunk {
  metadata: {
    chunkId: string;           // "button-example-size-variants-v1"
    chunkType: "code-example";
    componentName: string;
    sourceUrl: string;
    tags: string[];            // ["sizing", "layout"]
    complexity: "simple" | "moderate" | "complex";
  };

  example: {
    title: string;             // ✨ Inferred: "Size Variants"
    intent: string;            // ✨ Inferred: "sizing"
    difficulty: "basic" | "intermediate" | "advanced";
  };

  content: {
    explanation: string;       // ✨ Generated: "This example demonstrates..."
    code: string;
    demonstrates: string[];    // ✨ Generated: ["Using size prop...", ...]
    keyPoints: string[];       // ✨ Generated: ["Size accepts...", ...]
  };

  codeMetadata: {
    language: string;
    imports: ImportStatement[];    // ✨ Extracted
    components: string[];          // ✨ Extracted
    props: PropUsage[];            // ✨ Extracted
    hasInteractivity: boolean;     // ✨ Detected
    hasState: boolean;             // ✨ Detected
    complexity: number;            // ✨ Scored
  };
}
```

**✨ = Inferred/Generated** (not present in raw data)

See full schema definition in [src/schemas/NormalizedChunkSchema.ts](src/schemas/NormalizedChunkSchema.ts)

#### Task: Implement Inference Engine

**Files:** `src/steps/1-normalize/inference/`

**Reference:** [NORMALIZATION_GUIDE.md - Days 2-3](NORMALIZATION_GUIDE.md#day-2-3-inference-engine-6-8-hours)

Create inference utilities to extract missing metadata from code:

**1. Section Inference** (`sectionInferrer.ts`)
```typescript
// Infer semantic section titles from code patterns
// Examples:
//   code.includes('size=') → "Size Variants"
//   code.includes('variant=') → "Visual Variants"
//   code.includes('loading') → "Loading States"
//   code.includes('Icon') → "Button with Icons"
```

**2. Code Analysis** (`codeAnalyzer.ts`)
```typescript
// Extract structured information from code
export function extractImports(code: string): ImportStatement[];
export function extractComponentTags(code: string): string[];
export function extractPropUsage(code: string): PropUsage[];
```

**3. Intent Classification** (`intentClassifier.ts`)
```typescript
// Classify code intent
// Options: sizing | variants | states | composition | interaction
export function classifyIntent(code: string): string;
```

**4. Difficulty Scoring** (`difficultyScorer.ts`)
```typescript
// Calculate example difficulty
export function calculateDifficulty(compositionScore: number): 'basic' | 'intermediate' | 'advanced';
```

**Acceptance Criteria:**
- [ ] 95%+ examples have semantic section titles (not generic "Example 1")
- [ ] All imports extracted correctly from code
- [ ] All JSX components detected
- [ ] All prop usage patterns captured
- [ ] Intent classification ≥85% accurate (manual review)

---

### Milestone 2A.2: Natural Language Generation (Days 10-11, 16 hours)

**Reference:** [NORMALIZATION_GUIDE.md - Day 4](NORMALIZATION_GUIDE.md#day-4-natural-language-generator-4-6-hours)

#### Task: Implement NLG Generators

**Files:** `src/steps/1-normalize/generators/`

Generate natural language content for embeddings:

**1. Explanation Generator** (`explanationGenerator.ts`)
```typescript
// Generate human-readable explanations
// Example: "This example demonstrates how to control button dimensions
//          using the size prop, showing all 7 available size options..."
export function generateExplanation(
  code: string,
  metadata: { intent: string; components: string[]; props: PropUsage[] }
): string;
```

**2. Key Points Generator** (`keyPointsGenerator.ts`)
```typescript
// Extract teaching moments
// Example: [
//   "The size prop accepts: 'xs', 'sm', 'md', 'lg', 'xl'",
//   "HStack with gap='6' provides consistent spacing"
// ]
export function generateKeyPoints(
  code: string,
  metadata: { props: PropUsage[]; components: string[] }
): string[];
```

**3. Demonstrates Generator** (`demonstratesGenerator.ts`)
```typescript
// Convert structured data to natural language
// Example: [
//   "Using the size prop to control button dimensions",
//   "Horizontal layout with HStack component"
// ]
export function generateDemonstrates(
  props: PropUsage[],
  components: string[],
  intent: string
): string[];
```

**Acceptance Criteria:**
- [ ] 100% chunks have natural language explanations (50+ characters)
- [ ] Key points are factually accurate (manual review of 20 samples)
- [ ] Demonstrates list is comprehensive
- [ ] No hallucinations or generic content

---

### Milestone 2A.3: Transformation Pipeline (Days 12-13, 16 hours)

**Reference:** [NORMALIZATION_GUIDE.md - Days 5-7](NORMALIZATION_GUIDE.md#day-5-transform-pipeline-4-6-hours)

#### Task: Implement Code Example Transformer

**File:** `src/steps/1-normalize/transformers/codeExampleTransformer.ts`

Orchestrate all inference and generation utilities:

```typescript
import { CodeExample } from '../../../schemas/RAGResultSchema.js';
import { CodeExampleChunk } from '../../../schemas/NormalizedChunkSchema.js';

/**
 * Transform raw code example → enriched CodeExampleChunk
 */
export async function transformCodeExample(
  rawExample: CodeExample,
  componentName: string,
  sourceUrl: string
): Promise<CodeExampleChunk> {
  // 1. Infer section title (if missing)
  const title = rawExample.section || inferSectionTitle(rawExample.code, rawExample.section);

  // 2. Classify intent
  const intent = classifyIntent(rawExample.code);

  // 3. Extract code metadata
  const imports = extractImports(rawExample.code);
  const components = extractComponentTags(rawExample.code);
  const props = extractPropUsage(rawExample.code);

  // 4. Calculate difficulty
  const compositionScore = getCompositionScore(rawExample.code);
  const difficulty = calculateDifficulty(compositionScore);

  // 5. Generate natural language
  const explanation = generateExplanation(rawExample.code, { intent, components, props });
  const keyPoints = generateKeyPoints(rawExample.code, { props, components });
  const demonstrates = generateDemonstrates(props, components, intent);

  // 6. Generate chunk ID
  const chunkId = generateChunkId(componentName, 'code-example', title);

  return {
    metadata: {
      chunkId,
      chunkType: 'code-example',
      componentName,
      sourceUrl,
      tags: [intent, ...components.map(c => c.toLowerCase())],
      complexity: compositionScore < 10 ? 'simple' : compositionScore < 20 ? 'moderate' : 'complex',
      // ... more metadata
    },
    example: { title, intent, difficulty },
    content: { explanation, code: rawExample.code, demonstrates, keyPoints },
    codeMetadata: {
      imports,
      components,
      props,
      hasInteractivity: detectInteractivity(rawExample.code),
      hasState: detectState(rawExample.code),
      complexity: compositionScore
    }
  };
}
```

**Acceptance Criteria:**
- [ ] All inference functions integrated
- [ ] All generator functions integrated
- [ ] Chunks validate against schema
- [ ] 90%+ chunks are 200-500 tokens
- [ ] Manual review: 20 chunks are accurate

#### Task: CLI Integration

**File:** `src/steps/1-normalize/index.ts`

```typescript
export async function runNormalization(componentName?: string) {
  console.log('🚀 Starting advanced normalization pipeline...\n');

  // Load raw data
  const rawComponent = await loadRawComponent(componentName);

  // Transform code examples
  const codeExampleChunks = await Promise.all(
    rawComponent.codeExamples.map(ex =>
      transformCodeExample(ex, rawComponent.componentName, rawComponent.sourceUrl)
    )
  );

  // Validate all chunks
  codeExampleChunks.forEach(chunk => {
    const result = validateChunk(chunk);
    if (!result.success) {
      console.error(`❌ Validation failed for ${chunk.metadata.chunkId}`);
      console.error(result.error.format());
    }
  });

  // Save output
  await saveChunks(componentName, codeExampleChunks);

  // Print quality metrics
  printQualityReport(codeExampleChunks);
}
```

**Update:** `src/index.ts`

```typescript
program
  .command('1-normalize [component]')
  .description('Normalize and enrich component documentation')
  .action(async (component) => {
    const { runNormalization } = await import('./steps/1-normalize/index.js');
    await runNormalization(component);
  });
```

**Usage:**
```bash
# Process one component (Phase 1 scope)
npm run cli -- 1-normalize Button

# Later: Process all components (Phase 3)
npm run cli -- 1-normalize
```

**Acceptance Criteria:**
- [ ] Command processes Button component successfully
- [ ] Creates `artifacts/normalized/Button-chunks.json`
- [ ] Prints quality report (token distribution, inference success rate)
- [ ] All chunks validate against schema
- [ ] 12-18 chunks generated for Button (depending on examples)

---

### Milestone 2A.4: Validation & Quality Metrics (Day 14, 8 hours)

**Reference:** [NORMALIZATION_GUIDE.md - Validation](NORMALIZATION_GUIDE.md#quality-assurance)

#### Task: Implement Quality Checks

**File:** `src/steps/1-normalize/quality.ts`

```typescript
// Automated quality checks
export function validateChunkQuality(chunks: NormalizedChunk[]): QualityReport {
  return {
    tokenSizeDistribution: analyzeTokenSizes(chunks),
    naturalLanguageCoverage: checkNaturalLanguage(chunks),
    sectionInferenceSuccess: checkSemanticSections(chunks),
    intentClassificationAccuracy: analyzeIntents(chunks)
  };
}
```

#### Task: Manual Review Process

**Steps:**
1. Run normalization on Button component
2. Randomly select 20 chunks
3. Verify each chunk against checklist:
   - [ ] Explanation accurately describes code
   - [ ] Key points are factually correct
   - [ ] Section title is semantic
   - [ ] Intent matches code purpose
   - [ ] Chunk size is appropriate

**Acceptance Criteria:**
- [ ] 90%+ chunks in optimal token range (200-500)
- [ ] 100% chunks have natural language explanations
- [ ] 95%+ chunks have semantic section titles
- [ ] 85%+ intent classifications accurate
- [ ] Manual review: 18/20 chunks pass quality checks

---

## Phase 2B: Vector Store & Embeddings

**Timeline:** Days 15-17 (24 hours)
**Goal:** Generate embeddings for normalized chunks and build HNSWLIB index

**Note:** Phase 2B timeline adjusted to account for extended Phase 2A (Days 8-14)

### Milestone 2B.1: Embedding Generation (8 hours)

#### Task: Install Dependencies

```bash
npm install @xenova/transformers hnswlib-node
```

#### Task: Create Embedding Service

**File:** `src/services/EmbeddingService.ts`

```typescript
import { pipeline, env } from '@xenova/transformers';

// Disable local model cache for production
env.cacheDir = './models';

export class EmbeddingService {
  private embedder: any = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';

  async initialize() {
    console.log('🔄 Loading embedding model...');

    this.embedder = await pipeline(
      'feature-extraction',
      this.modelName
    );

    console.log('✅ Embedding model loaded\n');
  }

  async embed(text: string): Promise<number[]> {
    if (!this.embedder) {
      await this.initialize();
    }

    const output = await this.embedder(text, {
      pooling: 'mean',
      normalize: true
    });

    return Array.from(output.data);
  }

  async batchEmbed(texts: string[], batchSize: number = 32): Promise<number[][]> {
    if (!this.embedder) {
      await this.initialize();
    }

    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      const batchEmbeddings = await Promise.all(
        batch.map(text => this.embed(text))
      );

      embeddings.push(...batchEmbeddings);

      // Progress
      console.log(`   Processed ${Math.min(i + batchSize, texts.length)}/${texts.length} chunks`);
    }

    return embeddings;
  }

  getDimensions(): number {
    return 384;  // all-MiniLM-L6-v2 dimension
  }
}
```

**Acceptance Criteria:**
- [ ] Model downloads on first run
- [ ] Embedding dimension is 384
- [ ] Embeddings are normalized (L2 norm ≈ 1.0)
- [ ] Batch processing works efficiently

---

### Milestone 2B.2: HNSWLIB Vector Index (8 hours)

#### Task: Create Vector Store Service

**File:** `src/services/VectorStoreService.ts`

```typescript
import { HierarchicalNSW } from 'hnswlib-node';
import fs from 'fs/promises';

export interface SearchResult {
  index: number;
  chunkId: string;
  componentName: string;
  content: string;
  type: string;
  metadata: any;
  distance: number;
  score: number;
  rank: number;
}

export class VectorStoreService {
  private index: HierarchicalNSW | null = null;
  private metadata: any[] = [];
  private numDimensions = 384;

  async build(embeddings: number[][], metadata: any[]) {
    console.log('🏗️  Building HNSWLIB index...\n');

    const maxElements = embeddings.length;

    // Create index
    this.index = new HierarchicalNSW('cosine', this.numDimensions);
    this.index.initIndex(maxElements, 16, 200, 100);

    // Add all points
    for (let i = 0; i < embeddings.length; i++) {
      this.index.addPoint(embeddings[i], i);

      if ((i + 1) % 100 === 0) {
        console.log(`   Added ${i + 1}/${maxElements} points`);
      }
    }

    console.log(`✅ Index built with ${maxElements} points\n`);

    // Store metadata
    this.metadata = metadata;

    // Save to disk
    await this.save();
  }

  async save() {
    console.log('💾 Saving index to disk...');

    await fs.mkdir('stores/vector-index', { recursive: true });

    // Save HNSWLIB index
    this.index!.writeIndexSync('stores/vector-index/index.bin');

    // Save metadata
    await fs.writeFile(
      'stores/vector-index/metadata.json',
      JSON.stringify(this.metadata, null, 2)
    );

    console.log('✅ Index saved\n');
  }

  async load() {
    console.log('📂 Loading index from disk...');

    // Load HNSWLIB index
    this.index = new HierarchicalNSW('cosine', this.numDimensions);
    this.index.readIndexSync('stores/vector-index/index.bin');

    // Load metadata
    const metadataContent = await fs.readFile(
      'stores/vector-index/metadata.json',
      'utf8'
    );
    this.metadata = JSON.parse(metadataContent);

    console.log(`✅ Loaded index with ${this.metadata.length} chunks\n`);
  }

  async search(queryEmbedding: number[], k: number = 25): Promise<SearchResult[]> {
    if (!this.index) {
      throw new Error('Index not loaded. Call load() or build() first.');
    }

    // Search
    const { neighbors, distances } = this.index.searchKnn(queryEmbedding, k);

    // Enrich with metadata
    const results: SearchResult[] = neighbors.map((index, i) => {
      const meta = this.metadata[index];

      return {
        index,
        chunkId: meta.id,
        componentName: meta.componentName,
        content: meta.content,
        type: meta.type,
        metadata: meta.metadata,
        distance: distances[i],
        score: 1 - distances[i],  // Convert to similarity
        rank: i + 1
      };
    });

    return results;
  }
}
```

**Acceptance Criteria:**
- [ ] Index builds without errors
- [ ] Index persists to `stores/vector-index/index.bin`
- [ ] Metadata saves to `stores/vector-index/metadata.json`
- [ ] Loading from disk works
- [ ] Search returns results in <50ms

---

### Milestone 2B.3: Build Vector Store (8 hours)

#### Task: Create Build Script

**File:** `src/steps/2-build-vector-store/index.ts`

```typescript
import fs from 'fs/promises';
import { EmbeddingService } from '../../services/EmbeddingService.js';
import { VectorStoreService } from '../../services/VectorStoreService.js';

export async function buildVectorStore() {
  console.log('🚀 Building vector store...\n');

  // Step 1: Load chunks
  console.log('📂 Loading chunks...');
  const chunksContent = await fs.readFile('artifacts/normalized/chunks.json', 'utf8');
  const chunks = JSON.parse(chunksContent);
  console.log(`✅ Loaded ${chunks.length} chunks\n`);

  // Step 2: Generate embeddings
  console.log('🧠 Generating embeddings...');
  const embeddingService = new EmbeddingService();
  await embeddingService.initialize();

  const texts = chunks.map((chunk: any) => chunk.content);
  const embeddings = await embeddingService.batchEmbed(texts, 32);

  console.log(`✅ Generated ${embeddings.length} embeddings\n`);

  // Step 3: Build index
  const vectorStore = new VectorStoreService();

  // Create metadata aligned with embeddings
  const metadata = chunks.map((chunk: any, index: number) => ({
    index,
    ...chunk
  }));

  await vectorStore.build(embeddings, metadata);

  console.log('✅ Vector store built successfully!\n');

  // Step 4: Test search
  console.log('🧪 Testing search...');
  const testQuery = "button with loading state";
  const queryEmbedding = await embeddingService.embed(testQuery);
  const results = await vectorStore.search(queryEmbedding, 5);

  console.log(`\nTest query: "${testQuery}"`);
  console.log('Top 5 results:');
  results.forEach(r => {
    console.log(`  ${r.rank}. [${r.componentName}] ${r.type} (score: ${r.score.toFixed(3)})`);
    console.log(`     ${r.content.substring(0, 80)}...`);
  });
}
```

**Update:** `src/index.ts`

```typescript
program
  .command('2-build-vector-store')
  .description('Generate embeddings and build HNSWLIB index')
  .action(async () => {
    const { buildVectorStore } = await import('./steps/2-build-vector-store/index.js');
    await buildVectorStore();
  });
```

**Usage:**
```bash
npm run cli -- 2-build-vector-store
```

**Acceptance Criteria:**
- [ ] Generates embeddings for all chunks
- [ ] Builds HNSWLIB index
- [ ] Saves to `stores/vector-index/`
- [ ] Test search returns relevant results
- [ ] Completes in <5 minutes

---

## Phase 2C: LLM-Powered Re-ranking

**Timeline:** Days 18-19 (16 hours)
**Goal:** Implement two-stage retrieval with Groq API

**Note:** Phase 2C timeline adjusted to account for extended Phase 2A (Days 8-14)

### Milestone 2C.1: Groq Integration (6 hours)

#### Task: Install Groq SDK

```bash
npm install groq-sdk
```

**Add to `.env.example`:**
```
GROQ_API_KEY=your_groq_api_key_here
```

#### Task: Create Groq Service

**File:** `src/services/GroqService.ts`

```typescript
import Groq from 'groq-sdk';

interface RerankRequest {
  query: string;
  documents: Array<{
    id: string;
    content: string;
  }>;
}

interface RerankResponse {
  rankedDocuments: Array<{
    id: string;
    relevanceScore: number;
    reasoning?: string;
  }>;
}

export class GroqService {
  private client: Groq;

  constructor(apiKey?: string) {
    this.client = new Groq({
      apiKey: apiKey || process.env.GROQ_API_KEY
    });
  }

  async rerank(request: RerankRequest): Promise<RerankResponse> {
    const prompt = this.buildRerankPrompt(request);

    try {
      const response = await this.client.chat.completions.create({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at evaluating document relevance for UI component queries. Analyze each document and rank by relevance to the query.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 2000
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as RerankResponse;

    } catch (error) {
      console.error('Groq API error:', error);
      // Fallback: return documents in original order with default scores
      return {
        rankedDocuments: request.documents.map((doc, i) => ({
          id: doc.id,
          relevanceScore: 10 - i,  // Descending scores
          reasoning: 'Fallback ranking (API error)'
        }))
      };
    }
  }

  private buildRerankPrompt(request: RerankRequest): string {
    const documentsText = request.documents.map((doc, i) => `
[${i}] ID: ${doc.id}
Content: ${doc.content.substring(0, 500)}${doc.content.length > 500 ? '...' : ''}
    `).join('\n---\n');

    return `
Given the user query and candidate documents, rank each document by relevance.

Query: "${request.query}"

Documents:
${documentsText}

Analyze each document and return a JSON object with this structure:
{
  "rankedDocuments": [
    {
      "id": "chunk-id-here",
      "relevanceScore": 9,
      "reasoning": "Brief explanation of why this is relevant"
    },
    ...
  ]
}

Relevance scoring:
- 9-10: Directly answers the query with implementation details
- 7-8: Highly relevant context or related information
- 5-6: Somewhat relevant, tangentially related
- 3-4: Loosely related
- 0-2: Not relevant

Only include documents with score >= 5. Sort by score descending.
    `.trim();
  }
}
```

**Acceptance Criteria:**
- [ ] Groq API connection works
- [ ] Returns valid JSON
- [ ] Handles API errors gracefully
- [ ] Respects rate limits

---

### Milestone 2C.2: Retrieval Service (6 hours)

#### Task: Create Retrieval Service

**File:** `src/services/RetrievalService.ts`

```typescript
import { EmbeddingService } from './EmbeddingService.js';
import { VectorStoreService, SearchResult } from './VectorStoreService.js';
import { GroqService } from './GroqService.js';

export interface RetrievalResult {
  chunks: SearchResult[];
  query: string;
  retrievalMethod: 'vector_only' | 'vector_with_rerank';
  metadata: {
    totalCandidates: number;
    retrievalTimeMs: number;
    rerankingTimeMs?: number;
  };
}

export class RetrievalService {
  constructor(
    private embeddingService: EmbeddingService,
    private vectorStore: VectorStoreService,
    private groqService: GroqService
  ) {}

  async search(
    query: string,
    options?: {
      topK?: number;
      finalK?: number;
      useReranking?: boolean;
    }
  ): Promise<RetrievalResult> {
    const {
      topK = 25,
      finalK = 10,
      useReranking = true
    } = options || {};

    const startTime = Date.now();

    // Stage 1: Vector search
    const queryEmbedding = await this.embeddingService.embed(query);
    const candidates = await this.vectorStore.search(queryEmbedding, topK);

    const retrievalTimeMs = Date.now() - startTime;

    // Stage 2: Re-ranking (optional)
    if (!useReranking) {
      return {
        chunks: candidates.slice(0, finalK),
        query,
        retrievalMethod: 'vector_only',
        metadata: {
          totalCandidates: candidates.length,
          retrievalTimeMs
        }
      };
    }

    const rerankStartTime = Date.now();

    const rerankRequest = {
      query,
      documents: candidates.map(c => ({
        id: c.chunkId,
        content: c.content
      }))
    };

    const reranked = await this.groqService.rerank(rerankRequest);

    // Map back to full SearchResult objects
    const finalResults = reranked.rankedDocuments
      .slice(0, finalK)
      .map(doc => {
        const original = candidates.find(c => c.chunkId === doc.id)!;
        return {
          ...original,
          rerankScore: doc.relevanceScore,
          rerankReasoning: doc.reasoning
        };
      });

    const rerankingTimeMs = Date.now() - rerankStartTime;

    return {
      chunks: finalResults as any,
      query,
      retrievalMethod: 'vector_with_rerank',
      metadata: {
        totalCandidates: topK,
        retrievalTimeMs,
        rerankingTimeMs
      }
    };
  }
}
```

**Acceptance Criteria:**
- [ ] Vector-only search works
- [ ] Two-stage search works
- [ ] Returns timing metadata
- [ ] Handles errors gracefully

---

### Milestone 2C.3: Search Command & Evaluation (4 hours)

#### Task: Create Search Command

**File:** `src/steps/2-build-vector-store/search.ts`

```typescript
import { EmbeddingService } from '../../services/EmbeddingService.js';
import { VectorStoreService } from '../../services/VectorStoreService.js';
import { GroqService } from '../../services/GroqService.js';
import { RetrievalService } from '../../services/RetrievalService.js';

export async function runSearch(query: string, useReranking: boolean = true) {
  console.log(`🔍 Searching for: "${query}"\n`);

  // Initialize services
  const embeddingService = new EmbeddingService();
  await embeddingService.initialize();

  const vectorStore = new VectorStoreService();
  await vectorStore.load();

  const groqService = new GroqService();

  const retrieval = new RetrievalService(
    embeddingService,
    vectorStore,
    groqService
  );

  // Search
  const result = await retrieval.search(query, {
    topK: 25,
    finalK: 10,
    useReranking
  });

  // Display results
  console.log(`Method: ${result.retrievalMethod}`);
  console.log(`Retrieval time: ${result.metadata.retrievalTimeMs}ms`);
  if (result.metadata.rerankingTimeMs) {
    console.log(`Re-ranking time: ${result.metadata.rerankingTimeMs}ms`);
  }
  console.log(`\nTop ${result.chunks.length} results:\n`);

  result.chunks.forEach((chunk, i) => {
    console.log(`${i + 1}. [${chunk.componentName}] ${chunk.type}`);
    console.log(`   Score: ${chunk.score.toFixed(3)}`);
    if ('rerankScore' in chunk) {
      console.log(`   Rerank score: ${(chunk as any).rerankScore}/10`);
    }
    console.log(`   ${chunk.content.substring(0, 100)}...`);
    console.log();
  });
}
```

**Update:** `src/index.ts`

```typescript
program
  .command('search <query>')
  .description('Search the knowledge base')
  .option('--no-rerank', 'Disable LLM re-ranking')
  .action(async (query, options) => {
    const { runSearch } = await import('./steps/2-build-vector-store/search.js');
    await runSearch(query, options.rerank !== false);
  });
```

**Usage:**
```bash
# With re-ranking (default)
npm run cli -- search "accessible button with loading state"

# Vector-only
npm run cli -- search "modal dialog" --no-rerank
```

**Acceptance Criteria:**
- [ ] Command works with and without re-ranking
- [ ] Displays results clearly
- [ ] Shows timing metrics
- [ ] Re-ranked results are better than vector-only

---

## Week 2 Deliverables Checklist

### Phase 2A: Advanced Normalization (Days 8-14) ✅
- [ ] `NormalizedChunkSchema.ts` created (7 chunk types)
- [ ] Inference engine implemented (4 modules)
  - [ ] `sectionInferrer.ts` - 95%+ semantic sections
  - [ ] `intentClassifier.ts` - 85%+ accuracy
  - [ ] `codeAnalyzer.ts` - extracts imports/components/props
  - [ ] `difficultyScorer.ts` - calculates basic/intermediate/advanced
- [ ] Natural language generators implemented (3 modules)
  - [ ] `explanationGenerator.ts` - 100% coverage
  - [ ] `keyPointsGenerator.ts` - factually accurate
  - [ ] `demonstratesGenerator.ts` - comprehensive
- [ ] Transformation pipeline implemented
  - [ ] `codeExampleTransformer.ts` - orchestrates all utilities
- [ ] Quality validation implemented
  - [ ] `quality.ts` - automated checks
  - [ ] Manual review: 18/20 chunks pass
- [ ] `artifacts/normalized/Button-chunks.json` created (12-18 chunks)
- [ ] CLI command: `npm run cli -- 1-normalize Button` works
- [ ] 90%+ chunks in optimal token range (200-500)

### Phase 2B: Vector Store (Days 15-17) ✅
- [ ] `EmbeddingService.ts` generates embeddings
- [ ] `VectorStoreService.ts` manages HNSWLIB index
- [ ] `stores/vector-index/index.bin` created
- [ ] `stores/vector-index/metadata.json` created
- [ ] Search returns results in <50ms
- [ ] CLI command: `npm run cli -- 2-build-vector-store` works
- [ ] Embeddings generated for Button chunks (12-18 embeddings)

### Phase 2C: Retrieval (Days 18-19) ✅
- [ ] `GroqService.ts` re-ranks documents
- [ ] `RetrievalService.ts` implements two-stage retrieval
- [ ] CLI command: `npm run cli -- search <query>` works
- [ ] Re-ranking improves precision by >15%
- [ ] Total retrieval time <2 seconds
- [ ] Test query: "How do I make a button larger?" retrieves correct chunks

---

## Testing Strategy

### Unit Tests

Create `tests/unit/services/`:

```typescript
// EmbeddingService.test.ts
describe('EmbeddingService', () => {
  it('should generate 384-dimensional embeddings', async () => {
    const service = new EmbeddingService();
    await service.initialize();
    const embedding = await service.embed('test');
    expect(embedding).toHaveLength(384);
  });

  it('should normalize embeddings', async () => {
    const service = new EmbeddingService();
    await service.initialize();
    const embedding = await service.embed('test');
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(magnitude).toBeCloseTo(1.0, 5);
  });
});

// VectorStoreService.test.ts
describe('VectorStoreService', () => {
  it('should build and save index', async () => {
    const embeddings = [[0.1, 0.2, ...]]; // Mock embeddings
    const metadata = [{ id: 'test-1', content: 'test' }];

    const service = new VectorStoreService();
    await service.build(embeddings, metadata);

    expect(fs.existsSync('stores/vector-index/index.bin')).toBe(true);
  });

  it('should search and return results', async () => {
    const service = new VectorStoreService();
    await service.load();

    const results = await service.search(queryEmbedding, 10);

    expect(results).toHaveLength(10);
    expect(results[0].score).toBeGreaterThan(results[9].score);
  });
});
```

### Integration Tests

```typescript
// retrieval-flow.test.ts
describe('Full Retrieval Flow', () => {
  it('should complete two-stage retrieval', async () => {
    const retrieval = new RetrievalService(embedding, vectorStore, groq);

    const result = await retrieval.search('button with loading state', {
      useReranking: true
    });

    expect(result.chunks).toHaveLength(10);
    expect(result.retrievalMethod).toBe('vector_with_rerank');
    expect(result.metadata.retrievalTimeMs).toBeLessThan(2000);
  });
});
```

---

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Normalization | Merge related components | Check `normalized/components.json` |
| Chunking | 800-1000 chunks | Count in `normalized/chunks.json` |
| Embedding speed | <5 min for 1000 chunks | Time `2-build-vector-store` command |
| Search speed | <50ms (vector only) | Test with `search` command |
| Re-ranking quality | >15% precision improvement | Manual evaluation (see below) |
| Total retrieval | <2s (with re-ranking) | Time `search` command |

### Manual Evaluation

Create 10-15 test queries and manually verify results:

```typescript
const testQueries = [
  "accessible button with loading state",
  "modal dialog with form validation",
  "tooltip with keyboard navigation",
  "checkbox group with error handling",
  "input field with validation",
  // ... add more
];
```

For each query:
1. Run with `--no-rerank` (vector only)
2. Run with re-ranking (default)
3. Compare top 10 results
4. Count truly relevant results (precision@10)

**Expected improvement:**
- Vector only: 6-7/10 relevant (60-70% precision)
- With re-ranking: 8-9/10 relevant (80-90% precision)

---

## Troubleshooting

### Issue: Embeddings generation is slow

**Solution:**
- Reduce batch size: `batchEmbed(texts, 16)` instead of 32
- Use smaller model (trade quality for speed)
- Run on machine with more RAM

### Issue: HNSWLIB index build fails

**Solution:**
- Check embedding dimensions match (should be 384)
- Ensure embeddings are normalized
- Try smaller `maxElements` parameter

### Issue: Groq API rate limit errors

**Solution:**
- Add retry with exponential backoff
- Reduce batch size for re-ranking
- Cache results for common queries

### Issue: Search returns irrelevant results

**Solution:**
- Check chunking quality (chunks may be too large/small)
- Verify metadata is correctly aligned
- Tune re-ranking prompt for better filtering

---

## Next Steps (Week 3)

Once Week 2 is complete:

1. **Component Spec Schema** - Define formal specification structure
2. **Planner Service** - Use retrieval to generate specs
3. **Generator Service** - Transform specs to code
4. **Validator Service** - Validate generated code

**Week 3 will build on:**
- `RetrievalService.search()` → provides context for planning
- Chunked, embedded knowledge base → enables semantic search
- Two-stage retrieval → ensures high-quality context

---

## Files Created This Week

```
src/
├── schemas/
│   └── NormalizedChunkSchema.ts      # NEW - Advanced chunk types (7 types)
│
├── utils/
│   ├── chunkId.ts                    # NEW - Stable ID generation
│   └── tokenEstimator.ts             # NEW - Token counting
│
├── services/
│   ├── EmbeddingService.ts           # NEW
│   ├── VectorStoreService.ts         # NEW
│   ├── GroqService.ts                # NEW
│   └── RetrievalService.ts           # NEW
│
└── steps/
    ├── 1-normalize/                  # NEW - Advanced normalization
    │   ├── inference/
    │   │   ├── sectionInferrer.ts    # Infer section titles
    │   │   ├── intentClassifier.ts   # Classify intent
    │   │   ├── codeAnalyzer.ts       # Extract code metadata
    │   │   └── difficultyScorer.ts   # Calculate difficulty
    │   │
    │   ├── generators/
    │   │   ├── explanationGenerator.ts    # Generate explanations
    │   │   ├── keyPointsGenerator.ts      # Generate key points
    │   │   └── demonstratesGenerator.ts   # Generate demonstrates
    │   │
    │   ├── transformers/
    │   │   ├── codeExampleTransformer.ts  # Phase 1 (Days 8-14)
    │   │   ├── capabilityReferenceTransformer.ts  # Phase 2 (future)
    │   │   └── propReferenceTransformer.ts        # Phase 2 (future)
    │   │
    │   ├── index.ts                  # Main CLI entrypoint
    │   └── quality.ts                # Quality metrics
    │
    └── 2-build-vector-store/
        ├── index.ts                  # Build vector store
        └── search.ts                 # Search command

artifacts/
└── normalized/
    ├── Button-chunks.json            # NEW - Phase 1 output (CodeExampleChunks)
    └── {Component}-chunks.json       # NEW - Per-component normalized chunks

stores/
└── vector-index/
    ├── index.bin                     # NEW - HNSWLIB index
    └── metadata.json                 # NEW - Aligned metadata

tests/
└── unit/
    ├── services/
    │   ├── EmbeddingService.test.ts
    │   └── VectorStoreService.test.ts
    │
    └── normalization/                # NEW
        ├── inference.test.ts
        ├── generators.test.ts
        └── transformers.test.ts
```

---

**Ready to start Week 2?** Begin with Phase 2A: Normalization Pipeline. Good luck! 🚀
