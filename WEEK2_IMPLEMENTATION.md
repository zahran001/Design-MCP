# Week 2 Implementation Guide: Knowledge Base & Advanced Retrieval

**Duration:** Days 8-14 (7 days, ~56 hours)
**Status:** Ready to Start
**Prerequisites:** Week 1 Complete (50 components extracted to `artifacts/raw-json/`)

---

## Overview

Transform raw extracted data into an intelligent, queryable knowledge base with two-stage retrieval (vector similarity + LLM re-ranking).

**End Goal:**
```bash
npm run cli -- search "accessible button with loading state"
# Returns: 10 highly relevant, re-ranked chunks with scores
```

---

## Phase 2A: Data Normalization & Preparation

**Timeline:** Days 8-9 (16 hours)
**Goal:** Clean, deduplicate, and chunk data for embedding generation

### Milestone 2A.1: Normalization Pipeline (6 hours)

#### Task: Create Normalized Data Schema

**File:** `src/schemas/NormalizedDocSchema.ts`

```typescript
import { z } from 'zod';
import { CodeExampleSchema } from './RAGResultSchema.js';

/**
 * Standardized prop with resolved type conflicts
 */
export const StandardizedPropSchema = z.object({
  name: z.string(),
  type: z.string(),                    // Most specific type found
  description: z.string(),             // Longest/best description
  defaultValue: z.string().optional(),
  required: z.boolean().default(false),
  deprecated: z.boolean().default(false),

  // Structured type information
  typeStructure: z.object({
    kind: z.enum(['union', 'string', 'number', 'boolean', 'object', 'function']),
    values: z.array(z.string()).optional(),        // For union types
    properties: z.record(z.string()).optional()    // For object types
  }).optional()
});

/**
 * Semantic relationship between components
 */
export const RelatedComponentSchema = z.object({
  name: z.string(),
  relationship: z.enum(['variant', 'composition', 'family']),
  confidence: z.number().min(0).max(1),  // Co-occurrence frequency
  occurrences: z.number()                // How many times they appear together
});

/**
 * Normalized component (merged from multiple raw extractions)
 */
export const NormalizedComponentSchema = z.object({
  id: z.string(),                       // Canonical ID: "button"
  canonicalName: z.string(),            // "Button"
  aliases: z.array(z.string()),         // ["CloseButton", "IconButton"]
  category: z.enum([
    'form', 'layout', 'feedback', 'overlay',
    'disclosure', 'navigation', 'media', 'data-display', 'other'
  ]).optional(),

  description: z.string(),              // Best description
  sourceUrls: z.array(z.string()),      // All pages that mention this

  props: z.array(StandardizedPropSchema),
  codeExamples: z.array(CodeExampleSchema),
  relatedComponents: z.array(RelatedComponentSchema),

  metadata: z.object({
    normalizedAt: z.string(),
    sourceCount: z.number(),            // How many raw files merged
    totalCodeExamples: z.number(),
    deduplicatedExamples: z.number()
  })
});

export type NormalizedComponent = z.infer<typeof NormalizedComponentSchema>;
export type StandardizedProp = z.infer<typeof StandardizedPropSchema>;
export type RelatedComponent = z.infer<typeof RelatedComponentSchema>;
```

#### Task: Implement Normalizer

**File:** `src/steps/1-normalize-docs/normalizer.ts`

**Key functions:**

```typescript
import { ComponentDoc } from '../../schemas/RAGResultSchema.js';
import { NormalizedComponent } from '../../schemas/NormalizedDocSchema.js';

/**
 * Main normalization function
 */
export async function normalizeComponents(
  rawComponents: ComponentDoc[]
): Promise<NormalizedComponent[]> {
  // Step 1: Group by canonical name
  const groups = groupByCanonicalName(rawComponents);

  // Step 2: Merge each group
  const normalized = groups.map(group => mergeComponentGroup(group));

  // Step 3: Filter and score related components
  normalized.forEach(comp => {
    comp.relatedComponents = filterSemanticRelations(comp);
  });

  return normalized;
}

/**
 * Group components by canonical name
 * Example: "Button", "CloseButton", "IconButton" → one group
 */
function groupByCanonicalName(components: ComponentDoc[]): ComponentDoc[][] {
  const groups = new Map<string, ComponentDoc[]>();

  for (const component of components) {
    const canonical = extractCanonicalName(component.componentName);

    if (!groups.has(canonical)) {
      groups.set(canonical, []);
    }
    groups.get(canonical)!.push(component);
  }

  return Array.from(groups.values());
}

/**
 * Extract canonical name from variations
 * "CloseButton" → "Button"
 * "IconButton" → "Button"
 * "ModalOverlay" → "Modal"
 */
function extractCanonicalName(name: string): string {
  // Remove common suffixes
  const suffixes = ['Button', 'Modal', 'Input', 'Select', 'Card'];

  for (const suffix of suffixes) {
    if (name.endsWith(suffix)) {
      return suffix;
    }
  }

  return name;
}

/**
 * Merge multiple component docs into one normalized doc
 */
function mergeComponentGroup(group: ComponentDoc[]): NormalizedComponent {
  const primary = group[0];
  const canonical = extractCanonicalName(primary.componentName);

  return {
    id: canonical.toLowerCase(),
    canonicalName: canonical,
    aliases: group.map(c => c.componentName).filter(n => n !== canonical),

    // Pick best description (longest, most informative)
    description: pickBestDescription(group),

    sourceUrls: group.map(c => c.sourceUrl),

    // Merge and standardize props
    props: mergeProps(group.flatMap(c => c.props || [])),

    // Deduplicate code examples
    codeExamples: deduplicateCodeExamples(group.flatMap(c => c.codeExamples || [])),

    // Aggregate related components
    relatedComponents: aggregateRelatedComponents(group),

    metadata: {
      normalizedAt: new Date().toISOString(),
      sourceCount: group.length,
      totalCodeExamples: group.reduce((sum, c) => sum + (c.codeExamples?.length || 0), 0),
      deduplicatedExamples: 0  // Will be set after deduplication
    }
  };
}

/**
 * Deduplicate code examples by content hash
 */
function deduplicateCodeExamples(examples: CodeExample[]): CodeExample[] {
  const seen = new Set<string>();
  const unique: CodeExample[] = [];

  for (const example of examples) {
    const hash = hashCode(example.code);

    if (!seen.has(hash)) {
      seen.add(hash);
      unique.push(example);
    }
  }

  return unique;
}

/**
 * Simple string hash for deduplication
 */
function hashCode(str: string): string {
  return require('crypto')
    .createHash('md5')
    .update(str.trim())
    .digest('hex');
}

/**
 * Filter related components to remove noise
 */
function filterSemanticRelations(component: NormalizedComponent): RelatedComponent[] {
  const rawRelated = component.relatedComponents;

  return rawRelated.filter(rel => {
    // Remove external libraries
    if (isExternalLibrary(rel.name)) return false;

    // Remove layout utilities (unless explicitly related)
    if (isLayoutUtility(rel.name) && rel.confidence < 0.5) return false;

    // Remove type definitions
    if (isTypeDefinition(rel.name)) return false;

    return true;
  });
}

function isExternalLibrary(name: string): boolean {
  const externalPatterns = [
    /^Ri[A-Z]/,     // react-icons
    /^Lu[A-Z]/,     // lucide-react
    /^Hi[A-Z]/,     // heroicons
    /^Md[A-Z]/,     // material icons
    /Loader$/,      // react-spinners
    /^zod$/i,
    /^React$/
  ];

  return externalPatterns.some(pattern => pattern.test(name));
}

function isLayoutUtility(name: string): boolean {
  return ['HStack', 'VStack', 'Stack', 'Box', 'Center', 'Container'].includes(name);
}

function isTypeDefinition(name: string): boolean {
  return /^HTML[A-Z]/.test(name) || name.includes('Element');
}
```

**Acceptance Criteria:**
- [ ] Merges related components (e.g., Button + CloseButton + IconButton)
- [ ] Deduplicates code examples (hash-based comparison)
- [ ] Filters out external libraries from relatedComponents
- [ ] All output validates against `NormalizedComponentSchema`
- [ ] Creates `artifacts/normalized/components.json`

---

### Milestone 2A.2: Semantic Chunking (6 hours)

#### Task: Create Chunk Schema

**File:** `src/schemas/ChunkSchema.ts`

```typescript
import { z } from 'zod';

export const DocumentChunkSchema = z.object({
  id: z.string(),                      // "button-desc-001"
  componentName: z.string(),           // "Button"
  content: z.string(),                 // Actual text content
  tokens: z.number(),                  // Estimated token count

  type: z.enum(['description', 'prop', 'code_example', 'accessibility']),

  metadata: z.object({
    section: z.string().optional(),    // "Usage", "Props", "Examples"
    propName: z.string().optional(),   // If type='prop'
    propCategory: z.string().optional(), // "appearance", "behavior", etc.
    language: z.string().optional(),   // If type='code_example'
    hasCode: z.boolean().default(false),
    relatedComponents: z.array(z.string()).optional(),
    sourceUrl: z.string(),
    componentId: z.string()            // Canonical component ID
  })
});

export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;
```

#### Task: Implement Chunker

**File:** `src/steps/1-normalize-docs/chunker.ts`

```typescript
import { NormalizedComponent } from '../../schemas/NormalizedDocSchema.js';
import { DocumentChunk } from '../../schemas/ChunkSchema.js';

/**
 * Chunk a normalized component into semantic units
 */
export function chunkComponent(component: NormalizedComponent): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];

  // Chunk 1: Description (always whole)
  chunks.push(createDescriptionChunk(component));

  // Chunk 2-N: Props (grouped by category)
  chunks.push(...chunkProps(component));

  // Chunk N+1...: Code examples (NEVER split)
  chunks.push(...chunkCodeExamples(component));

  return chunks;
}

function createDescriptionChunk(component: NormalizedComponent): DocumentChunk {
  const content = `${component.canonicalName}: ${component.description}`;

  return {
    id: `${component.id}-desc-001`,
    componentName: component.canonicalName,
    content,
    tokens: estimateTokens(content),
    type: 'description',
    metadata: {
      section: 'Overview',
      sourceUrl: component.sourceUrls[0],
      componentId: component.id,
      hasCode: false
    }
  };
}

function chunkProps(component: NormalizedComponent): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];

  // Group props by category
  const grouped = groupPropsByCategory(component.props);

  for (const [category, props] of Object.entries(grouped)) {
    // Split into chunks if too many props
    const propChunks = splitPropsIntoChunks(props, {
      targetTokens: 500,
      maxTokens: 800
    });

    propChunks.forEach((propGroup, index) => {
      const content = formatPropsAsText(propGroup);

      chunks.push({
        id: `${component.id}-props-${category.toLowerCase()}-${index + 1}`,
        componentName: component.canonicalName,
        content,
        tokens: estimateTokens(content),
        type: 'prop',
        metadata: {
          section: 'Props',
          propCategory: category,
          sourceUrl: component.sourceUrls[0],
          componentId: component.id,
          hasCode: false
        }
      });
    });
  }

  return chunks;
}

function groupPropsByCategory(props: StandardizedProp[]): Record<string, StandardizedProp[]> {
  return {
    'Appearance': props.filter(p => /^(variant|color|size|rounded|style)/i.test(p.name)),
    'Behavior': props.filter(p => /^(onClick|onChange|onSubmit|is[A-Z]|disabled|loading)/i.test(p.name)),
    'Layout': props.filter(p => /^(width|height|padding|margin|gap|align)/i.test(p.name)),
    'Accessibility': props.filter(p => /^(aria|role|tabIndex|title)/i.test(p.name)),
    'Other': props.filter(p => {
      const name = p.name;
      return !/(variant|color|size|rounded|style|onClick|onChange|is[A-Z]|width|height|aria|role)/i.test(name);
    })
  };
}

function formatPropsAsText(props: StandardizedProp[]): string {
  return props.map(prop => `
${prop.name}${prop.required ? '*' : ''}: ${prop.type}
  ${prop.description}
  ${prop.defaultValue ? `Default: ${prop.defaultValue}` : ''}
  `.trim()).join('\n\n');
}

function chunkCodeExamples(component: NormalizedComponent): DocumentChunk[] {
  return component.codeExamples.map((example, index) => {
    const title = example.title || `Example ${index + 1}`;
    const content = `${title}\n\n${example.code}`;

    return {
      id: `${component.id}-example-${String(index + 1).padStart(3, '0')}`,
      componentName: component.canonicalName,
      content,
      tokens: estimateTokens(content),
      type: 'code_example',
      metadata: {
        section: example.section || 'Examples',
        language: example.language || 'tsx',
        hasCode: true,
        relatedComponents: extractComponentsFromCode(example.code),
        sourceUrl: component.sourceUrls[0],
        componentId: component.id
      }
    };
  });
}

/**
 * Estimate tokens (rough heuristic: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Extract component names from code
 */
function extractComponentsFromCode(code: string): string[] {
  const components = new Set<string>();

  // Match JSX tags: <Button>, <Modal.Header>, etc.
  const tagRegex = /<([A-Z][a-zA-Z0-9]*)/g;
  let match;

  while ((match = tagRegex.exec(code)) !== null) {
    components.add(match[1]);
  }

  return Array.from(components);
}
```

**Acceptance Criteria:**
- [ ] Description chunks are 100-500 tokens
- [ ] Prop chunks are 400-800 tokens
- [ ] Code example chunks are never split (complete functions)
- [ ] All chunks have complete metadata
- [ ] Chunks validate against `DocumentChunkSchema`
- [ ] Total chunks: ~800-1000 for 50 components

---

### Milestone 2A.3: CLI Integration (4 hours)

#### Task: Create Normalization Command

**File:** `src/steps/1-normalize-docs/index.ts`

```typescript
import fs from 'fs/promises';
import path from 'path';
import { ComponentDocSchema } from '../../schemas/RAGResultSchema.js';
import { normalizeComponents } from './normalizer.js';
import { chunkComponent } from './chunker.js';

export async function runNormalization() {
  console.log('🔄 Starting normalization pipeline...\n');

  // Step 1: Load raw components
  console.log('📂 Loading raw components...');
  const rawDir = 'artifacts/raw-json';
  const files = await fs.readdir(rawDir);

  const rawComponents = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;

    const content = await fs.readFile(path.join(rawDir, file), 'utf8');
    const parsed = JSON.parse(content);

    // Validate
    const validated = ComponentDocSchema.parse(parsed);
    rawComponents.push(validated);
  }

  console.log(`✅ Loaded ${rawComponents.length} components\n`);

  // Step 2: Normalize
  console.log('⚙️  Normalizing and merging...');
  const normalized = await normalizeComponents(rawComponents);

  console.log(`✅ Created ${normalized.length} normalized components\n`);

  // Step 3: Chunk
  console.log('✂️  Chunking for embeddings...');
  const allChunks = normalized.flatMap(comp => chunkComponent(comp));

  console.log(`✅ Created ${allChunks.length} chunks\n`);

  // Step 4: Save outputs
  console.log('💾 Saving artifacts...');

  // Create output directory
  await fs.mkdir('artifacts/normalized', { recursive: true });

  // Save normalized components
  await fs.writeFile(
    'artifacts/normalized/components.json',
    JSON.stringify(normalized, null, 2)
  );

  // Save chunks
  await fs.writeFile(
    'artifacts/normalized/chunks.json',
    JSON.stringify(allChunks, null, 2)
  );

  // Save metadata index
  const metadata = allChunks.map((chunk, index) => ({
    index,
    ...chunk
  }));

  await fs.writeFile(
    'artifacts/normalized/metadata.json',
    JSON.stringify(metadata, null, 2)
  );

  console.log('✅ Saved to artifacts/normalized/\n');

  // Print summary
  console.log('📊 Summary:');
  console.log(`   Raw components: ${rawComponents.length}`);
  console.log(`   Normalized: ${normalized.length}`);
  console.log(`   Total chunks: ${allChunks.length}`);
  console.log(`   Avg chunks per component: ${(allChunks.length / normalized.length).toFixed(1)}`);

  const chunksByType = {
    description: allChunks.filter(c => c.type === 'description').length,
    prop: allChunks.filter(c => c.type === 'prop').length,
    code_example: allChunks.filter(c => c.type === 'code_example').length,
    accessibility: allChunks.filter(c => c.type === 'accessibility').length
  };

  console.log('\n   Chunks by type:');
  console.log(`   - Descriptions: ${chunksByType.description}`);
  console.log(`   - Props: ${chunksByType.prop}`);
  console.log(`   - Code examples: ${chunksByType.code_example}`);
  console.log(`   - Accessibility: ${chunksByType.accessibility}`);
}
```

**Update:** `src/index.ts`

```typescript
program
  .command('1-normalize-docs')
  .description('Normalize and chunk extracted documentation')
  .action(async () => {
    const { runNormalization } = await import('./steps/1-normalize-docs/index.js');
    await runNormalization();
  });
```

**Usage:**
```bash
npm run cli -- 1-normalize-docs
```

**Acceptance Criteria:**
- [ ] Command runs without errors
- [ ] Creates `artifacts/normalized/components.json`
- [ ] Creates `artifacts/normalized/chunks.json`
- [ ] Creates `artifacts/normalized/metadata.json`
- [ ] Prints summary statistics

---

## Phase 2B: Vector Store & Embeddings

**Timeline:** Days 10-12 (24 hours)
**Goal:** Generate embeddings and build HNSWLIB index

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

**Timeline:** Days 13-14 (16 hours)
**Goal:** Implement two-stage retrieval with Groq API

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

### Phase 2A: Normalization ✅
- [ ] `NormalizedDocSchema.ts` created
- [ ] `normalizer.ts` merges related components
- [ ] `chunker.ts` creates semantic chunks
- [ ] `artifacts/normalized/components.json` created
- [ ] `artifacts/normalized/chunks.json` created
- [ ] ~800-1000 chunks generated
- [ ] CLI command: `npm run cli -- 1-normalize-docs` works

### Phase 2B: Vector Store ✅
- [ ] `EmbeddingService.ts` generates embeddings
- [ ] `VectorStoreService.ts` manages HNSWLIB index
- [ ] `stores/vector-index/index.bin` created
- [ ] `stores/vector-index/metadata.json` created
- [ ] Search returns results in <50ms
- [ ] CLI command: `npm run cli -- 2-build-vector-store` works

### Phase 2C: Retrieval ✅
- [ ] `GroqService.ts` re-ranks documents
- [ ] `RetrievalService.ts` implements two-stage retrieval
- [ ] CLI command: `npm run cli -- search <query>` works
- [ ] Re-ranking improves precision by >15%
- [ ] Total retrieval time <2 seconds

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
│   ├── NormalizedDocSchema.ts        # NEW
│   └── ChunkSchema.ts                # NEW
├── services/
│   ├── EmbeddingService.ts           # NEW
│   ├── VectorStoreService.ts         # NEW
│   ├── GroqService.ts                # NEW
│   └── RetrievalService.ts           # NEW
└── steps/
    ├── 1-normalize-docs/
    │   ├── index.ts                  # NEW
    │   ├── normalizer.ts             # NEW
    │   └── chunker.ts                # NEW
    └── 2-build-vector-store/
        ├── index.ts                  # NEW
        └── search.ts                 # NEW

artifacts/
└── normalized/
    ├── components.json               # NEW - Merged components
    ├── chunks.json                   # NEW - Semantic chunks
    └── metadata.json                 # NEW - Chunk metadata

stores/
└── vector-index/
    ├── index.bin                     # NEW - HNSWLIB index
    └── metadata.json                 # NEW - Aligned metadata

tests/
└── unit/
    └── services/
        ├── EmbeddingService.test.ts  # NEW
        └── VectorStoreService.test.ts # NEW
```

---

**Ready to start Week 2?** Begin with Phase 2A: Normalization Pipeline. Good luck! 🚀
