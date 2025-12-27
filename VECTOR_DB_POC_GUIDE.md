# Vector DB POC Implementation Guide

**Objective:** Build a working vector search system for 387 normalized code example chunks in 5-6 days.

**Success Criteria:**
- ✅ 387 chunks embedded and stored in Qdrant
- ✅ Search returns relevant results for 80%+ of test queries
- ✅ Average latency <500ms
- ✅ Interactive CLI interface working
- ✅ POC validation report with metrics

**Timeline:** 5-6 days

---

## Phase 1: Setup & Dependencies (Day 1 - 2 hours)

### Step 1.1: Update package.json

Add new dependencies:
```json
{
  "dependencies": {
    "openai": "^4.52.0",
    "@qdrant/js-client": "^1.9.0",
    "chalk": "^5.3.0",
    "ora": "^8.0.1"
  }
}
```

Add new scripts:
```json
{
  "scripts": {
    "embed": "npm run build && node dist/steps/2-embed/embedder.js",
    "search": "npm run build && node dist/steps/3-search/retriever.js",
    "search:interactive": "npm run build && node dist/steps/3-search/retriever.js --interactive"
  }
}
```

**Why these dependencies:**
- `openai`: Official OpenAI SDK with batch support
- `@qdrant/js-client`: Official Qdrant TypeScript client
- `chalk`: Pretty terminal colors for CLI output
- `ora`: Spinner animations for progress tracking

---

### Step 1.2: Create docker-compose.yml

Location: **Root directory**

```yaml
version: '3.9'

services:
  qdrant:
    image: qdrant/qdrant:v1.7.0
    container_name: qdrant-chakra-ui
    ports:
      - "6333:6333"
      - "6334:6334"
    environment:
      - QDRANT_API_KEY=${QDRANT_API_KEY:-}
      - QDRANT_HEARTBEAT=${QDRANT_HEARTBEAT:-30}
    volumes:
      - qdrant_storage:/qdrant/storage:z
      - qdrant_snapshots:/qdrant/snapshots:z
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

volumes:
  qdrant_storage:
    driver: local
  qdrant_snapshots:
    driver: local
```

**Key points:**
- Port 6333: REST API
- Port 6334: gRPC API (optional but available)
- Health check to verify service is running
- Volumes for persistence

---

### Step 1.3: Update .env.example

Add to end of file:

```bash
# =====================================
# Vector Database & Embeddings (Week 2 Phase 2B)
# =====================================

# OpenAI Configuration
OPENAI_API_KEY=sk-...your-key-here...
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536

# Qdrant Configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION_NAME=chakra-ui-docs

# Embedding Configuration
EMBED_BATCH_SIZE=100
EMBED_MAX_RETRIES=3
```

---

### Step 1.4: Start Qdrant

```bash
docker-compose up -d qdrant
docker-compose logs qdrant  # Verify it's running
```

Verify health:
```bash
curl http://localhost:6333/health
# Should return: {"status":"ok"}
```

**Checkpoint:** Docker running, dependencies ready → Move to Phase 2

---

## Phase 2: EmbeddingService (Day 1-2 - 4-6 hours)

### Step 2.1: Create EmbeddingService.ts

**Location:** `src/services/EmbeddingService.ts`

**Responsibilities:**
1. Wrap OpenAI embedding API
2. Handle batching (max 2048 texts per request)
3. Implement retry logic with exponential backoff
4. Track token usage and costs
5. Handle errors gracefully

**Key Interface:**
```typescript
interface EmbeddedText {
  text: string;
  embedding: number[];
  tokens: number;
}

interface EmbeddingResult {
  embeddings: EmbeddedText[];
  totalTokens: number;
  estimatedCost: number;
  duration: number;
}
```

**Key Methods:**
```typescript
class EmbeddingService {
  // Embed single text
  async embedText(text: string): Promise<number[]>

  // Embed batch of texts (handles chunking if needed)
  async embedBatch(texts: string[], onProgress?: (i: number, total: number) => void): Promise<EmbeddingResult>

  // Estimate cost before embedding
  estimateCost(totalTokens: number): number

  // Get usage stats
  getStats(): { totalTokens: number; totalCost: number; embeddingsCreated: number }
}
```

**Implementation Pattern:**
1. Split texts into batches of up to 2048
2. For each batch:
   - Call OpenAI API
   - Handle rate limits (wait 60s if rate limited)
   - Retry failed requests (max 3 times with exponential backoff)
   - Track tokens and cost
3. Aggregate results
4. Log summary stats

**Error Handling:**
- Network errors → Retry with backoff
- Rate limit (429) → Wait and retry
- Invalid API key (401) → Fail fast with helpful message
- Token limit (hitting max) → Log warning, continue
- Unknown errors → Log and throw

**Testing:**
```bash
# Test with a single embedding
npm run build
node -e "const {EmbeddingService} = require('./dist/services/EmbeddingService'); const svc = new EmbeddingService(); svc.embedText('Hello world').then(console.log);"
```

---

### Step 2.2: Create VectorStoreService.ts

**Location:** `src/services/VectorStoreService.ts`

**Responsibilities:**
1. Connect to Qdrant
2. Manage collection lifecycle (create, delete, info)
3. Upsert vector + metadata
4. Search with filtering
5. Handle connection errors

**Key Types:**
```typescript
interface VectorPoint {
  id: number;
  vector: number[];
  payload: {
    chunkId: string;
    componentName: string;
    sourceUrl: string;
    chunkType: string;
    category: string;
    complexity: string;
    tags: string[];
    intent?: string;
    title?: string;
    explanation?: string;
    code?: string;
  };
}

interface SearchResult {
  id: number;
  score: number;
  payload: VectorPoint['payload'];
}

interface CollectionInfo {
  points_count: number;
  vectors_count: number;
  status: string;
}
```

**Key Methods:**
```typescript
class VectorStoreService {
  // Collection management
  async createCollection(name: string, vectorSize: number): Promise<void>
  async deleteCollection(name: string): Promise<void>
  async collectionExists(name: string): Promise<boolean>
  async getCollectionInfo(name: string): Promise<CollectionInfo>

  // Data operations
  async upsertPoints(points: VectorPoint[]): Promise<void>
  async deletePoints(ids: number[]): Promise<void>

  // Search
  async search(
    queryVector: number[],
    options: {
      limit?: number;
      scoreThreshold?: number;
      filter?: object;
    }
  ): Promise<SearchResult[]>

  // Utility
  async health(): Promise<boolean>
}
```

**Implementation Pattern:**
1. Use `@qdrant/js-client` SDK
2. Connection pooling for efficiency
3. Automatic reconnection on failure
4. Structured metadata in payloads for filtering

**Error Handling:**
- Connection refused → Clear error message with instructions to start Docker
- Collection not found → Helpful message suggesting creation
- Invalid vectors → Validate before upsert
- Search errors → Log and return empty results

**Testing:**
```bash
# Test connection
npm run build
node -e "const {VectorStoreService} = require('./dist/services/VectorStoreService'); const svc = new VectorStoreService(); svc.health().then(console.log);"
```

---

### Step 2.3: Implement Embedder Pipeline

**Location:** `src/steps/2-embed/embedder.ts`

**Responsibilities:**
1. Load all normalized JSON files
2. Extract embeddable content from each chunk
3. Batch embed via EmbeddingService
4. Prepare VectorPoints with metadata
5. Upsert to Qdrant
6. Report metrics

**Input:** All files in `artifacts/normalized/*.json`

**Output:** 387 chunks in Qdrant collection

**Algorithm:**
```
1. Load all normalized files
2. For each component file:
   a. Parse JSON
   b. Extract chunks (should be array of CodeExampleChunk)
   c. For each chunk:
      - Extract text to embed: explanation + demonstrates + keyPoints
      - Store chunk ID, metadata
3. Batch embed all texts
4. Create VectorPoints with embeddings + payloads
5. Upsert to Qdrant in batches (1000 per batch)
6. Report: total chunks, tokens, cost, duration
```

**Progress Tracking:**
- Use `ora` spinner for visual feedback
- Show: "Processing component X/50"
- Show: "Embedding Y/387 chunks"
- Show: "Upserting Z/387 to Qdrant"

**Metrics to Report:**
```
✅ Embedder Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Processing Results
  Components processed: 50
  Chunks embedded: 387
  Chunks with text: 387 (100%)

💾 Storage
  Collection: chakra-ui-docs
  Vector dimension: 1536
  Total points: 387

🧠 Embedding Statistics
  Total tokens: 54,180
  Avg tokens/chunk: 140
  Min/Max: 67-238

💰 OpenAI API Cost
  Cost per 1M tokens: $0.020
  Total cost: $0.001

⏱️  Performance
  Total duration: 2m 34s
  Embedding time: 1m 45s
  Qdrant upsert: 0m 49s

✅ Success! Ready for search.
```

---

## Phase 3: RetrievalService (Day 2-3 - 4-6 hours)

### Step 3.1: Create RetrievalService.ts

**Location:** `src/services/RetrievalService.ts`

**Responsibilities:**
1. Embed user queries
2. Search Qdrant
3. Format and rank results
4. Apply metadata filters
5. Pretty-print results

**Key Interface:**
```typescript
interface SearchOptions {
  limit?: number;
  component?: string;
  category?: string;
  minComplexity?: 'basic' | 'intermediate' | 'advanced';
}

interface RetrievalResult {
  rank: number;
  score: number;
  chunkId: string;
  componentName: string;
  title: string;
  intent: string;
  difficulty: string;
  explanation: string;
  code: string;
  sourceUrl: string;
}
```

**Key Methods:**
```typescript
class RetrievalService {
  async search(query: string, options?: SearchOptions): Promise<RetrievalResult[]>

  async searchInteractive(): Promise<void>

  async exportResults(query: string, results: RetrievalResult[], filename?: string): Promise<void>
}
```

**Search Algorithm:**
1. Embed query using EmbeddingService
2. Build Qdrant filter from options (if provided)
3. Search with cosine similarity
4. Rank results by score (descending)
5. Format and return

**Result Formatting:**
```typescript
// Convert Qdrant search result to RetrievalResult
{
  rank: 1,
  score: 0.92,
  chunkId: "button-example-sizing-v1",
  componentName: "Button",
  title: "Size Variants",
  intent: "sizing",
  difficulty: "intermediate",
  explanation: "This example demonstrates...",
  code: "import { Button, HStack } from ...",
  sourceUrl: "https://chakra-ui.com/docs/components/button"
}
```

**Testing:**
```bash
# Test search after embedder completes
npm run build
npm run search -- --query "How do I size a button?" --num-results 3
```

---

## Phase 4: CLI Search Interface (Day 3-4 - 3-4 hours)

### Step 4.1: Implement Retriever CLI

**Location:** `src/steps/3-search/retriever.ts`

**Capabilities:**
1. Single query mode: `npm run search -- --query "..."`
2. Interactive mode: `npm run search:interactive`
3. Filter by component: `--component Button`
4. Filter by category: `--category form-controls`
5. Export to JSON: `--export results.json`

**CLI Usage Examples:**
```bash
# Single query
npm run search -- -q "How do I size a button?" -n 5

# Interactive mode
npm run search:interactive

# With filters
npm run search -- -q "button styling" -c Button --complexity intermediate

# Export results
npm run search -- -q "icon button" --export /tmp/results.json
```

**Interactive Mode UX:**
```
🔍 Chakra UI Component Search (Interactive Mode)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Type 'quit' to exit, 'help' for commands
Available commands: filter, export, metrics, help, quit

> Query: How do I create a button with loading state?

📊 Results (5/5) | Score range: 0.82-0.94
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Result #1 (score: 0.94) 🏆
────────────────────────────────────────────────
Component: Button
Intent: loading-states
Difficulty: intermediate
Chunk ID: button-example-loading-state-v1

📝 Explanation:
This example demonstrates how to show a loading state while an
action is in progress. The Button component supports a 'loading'
prop to display a spinner...

💻 Code:
import { Button, Stack } from "@chakra-ui/react"

const Demo = () => {
  return (
    <Stack direction="row" gap="4" align="center">
      <Button loading>Click me</Button>
      <Button loading loadingText="Saving...">
        Click me
      </Button>
    </Stack>
  )
}

🔗 Source: https://chakra-ui.com/docs/components/button

────────────────────────────────────────────────
Result #2 (score: 0.89)
...

> Query: filter by component=Button
> Query: export to /tmp/results.json
✅ Exported 5 results to /tmp/results.json

> Query: quit
👋 Goodbye!
```

**Pretty Print Module:**
```typescript
// Create src/steps/3-search/resultFormatter.ts
function formatResult(result: RetrievalResult, rank: number): string
function formatMetrics(results: RetrievalResult[]): string
function printInteractiveHeader(): string
```

---

## Phase 5: Validation & Testing (Day 5 - 4-6 hours)

### Step 5.1: Create Test Suite

**Location:** `src/steps/3-search/__tests__/validation.test.ts`

**Test Categories:**

**Category 1: Size/Variants (CodeExampleChunk strength)**
```typescript
const tests = [
  { query: "How do I size a button?", expectedIntent: "sizing" },
  { query: "Show me different button variants", expectedIntent: "styling" },
  { query: "Make a button larger", expectedIntent: "sizing" },
];
```

**Category 2: Interaction (State management)**
```typescript
const tests = [
  { query: "Button with loading state", expectedIntent: "loading-states" },
  { query: "Disabled button example", expectedIntent: "state" },
  { query: "Button click handler", expectedIntent: "interactivity" },
];
```

**Category 3: Composition (Multi-component)**
```typescript
const tests = [
  { query: "Button with icons", expectedComponents: ["Button", "Icon"] },
  { query: "Button group layout", expectedComponents: ["Button", "ButtonGroup"] },
];
```

**Category 4: Styling (Appearance)**
```typescript
const tests = [
  { query: "Change button color", expectedIntent: "styling" },
  { query: "Rounded button corners", expectedIntent: "styling" },
];
```

**Category 5: Edge Cases**
```typescript
const tests = [
  { query: "What is Button?", shouldWork: true, note: "No ComponentOverview yet" },
  { query: "What props does Button have?", shouldWork: true, note: "No PropReference yet" },
];
```

**Metrics to Track:**
```typescript
interface ValidationMetrics {
  totalQueries: number;
  successfulQueries: number;
  p1Accuracy: number;  // % where top result is relevant
  p3Accuracy: number;  // % where top 3 includes answer
  p5Accuracy: number;  // % where top 5 includes answer
  avgScore: number;
  avgLatency: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
}
```

**Success Criteria:**
```typescript
const criteria = {
  p1Accuracy: 0.80,      // ≥80% of top results relevant
  p3Accuracy: 0.95,      // ≥95% of answers in top 3
  avgLatency: 500,       // <500ms average
  noErrors: true,        // Zero crashes
}
```

---

### Step 5.2: Manual Testing Script

**Location:** `src/steps/3-search/manual-validation.ts`

**Purpose:** Interactive validation with human judgment

```bash
npm run build
npm run test:validation

# Output format:
# Query: "How do I size a button?"
# Result 1: button-example-sizing-v1 (score: 0.92)
# Result 2: button-example-variants-v1 (score: 0.87)
# Result 3: hstack-example-spacing-v1 (score: 0.71)
#
# Relevant? (y/n/skip): y
# Comments: Good match, sizing prop demonstrated
#
# Total: 15/20 queries rated as relevant ✅
```

---

## Phase 6: Analysis & Reporting (Day 6 - 2-3 hours)

### Step 6.1: Generate POC Report

**Location:** `artifacts/poc-report.md`

**Report Structure:**

```markdown
# Vector DB POC Report

## Executive Summary
- Status: ✅ POC Complete
- Date: 2025-12-27
- Duration: 5.5 days
- Result: SUCCESSFUL

## Key Metrics
- Chunks embedded: 387/387 (100%)
- Total tokens: 54,180
- API cost: $0.001
- Collection size: 3.2 MB

## Search Quality
- P@1 Accuracy: 85% (17/20 queries)
- P@3 Accuracy: 95% (19/20 queries)
- P@5 Accuracy: 100% (20/20 queries)
- Avg latency: 345ms
- 95th percentile: 480ms

## Query Category Performance
| Category | Tests | P@1 | P@3 | Notes |
|----------|-------|-----|-----|-------|
| Size/Variants | 3 | 100% | 100% | Perfect |
| Interaction | 3 | 67% | 100% | Good |
| Composition | 2 | 100% | 100% | Excellent |
| Styling | 3 | 100% | 100% | Excellent |
| Edge Cases | 2 | 50% | 75% | Expected (no overview/prop chunks) |

## Token Count Analysis
- Min: 67 tokens
- Max: 238 tokens
- Avg: 139 tokens
- Below 150 threshold: 56%
- Assessment: Acceptable - OpenAI embeddings work well with shorter texts

## Conclusion
✅ POC VALIDATED - Approach is sound!

### Next Steps
1. Build remaining 6 chunk transformers
2. Test search quality with more chunk types
3. Consider generation pipeline
4. Optimize based on learnings

### Recommendations
1. Enhance explanation templates to increase token count
2. Add section extraction to improve intent classification
3. Consider hybrid search (keyword + vector) for edge cases
```

---

## Execution Checklist

### Phase 1: Setup (2 hours)
- [ ] Update package.json with dependencies
- [ ] Create docker-compose.yml
- [ ] Update .env.example
- [ ] Start Qdrant: `docker-compose up -d qdrant`
- [ ] Verify: `curl http://localhost:6333/health`

### Phase 2: EmbeddingService (4-6 hours)
- [ ] Create src/services/EmbeddingService.ts
  - [ ] OpenAI client setup
  - [ ] Batch embedding logic
  - [ ] Retry with exponential backoff
  - [ ] Token counting and cost estimation
  - [ ] Error handling
- [ ] Test with `npm run build` and single embedding

### Phase 3: VectorStoreService (4-6 hours)
- [ ] Create src/services/VectorStoreService.ts
  - [ ] Qdrant client initialization
  - [ ] Collection management
  - [ ] Upsert logic with batching
  - [ ] Search with filtering
  - [ ] Connection error handling
- [ ] Test connection and health check

### Phase 4: Embedder Pipeline (4-6 hours)
- [ ] Create src/steps/2-embed/embedder.ts
  - [ ] Load all normalized JSON files
  - [ ] Extract embeddable content
  - [ ] Batch embed using EmbeddingService
  - [ ] Prepare VectorPoints with metadata
  - [ ] Upsert to Qdrant
  - [ ] Report metrics
- [ ] Run: `npm run embed`
- [ ] Verify: All 387 chunks in Qdrant

### Phase 5: RetrievalService (4-6 hours)
- [ ] Create src/services/RetrievalService.ts
  - [ ] Query embedding
  - [ ] Qdrant search with filters
  - [ ] Result formatting
  - [ ] Error handling
- [ ] Create src/steps/3-search/retriever.ts
  - [ ] CLI argument parsing
  - [ ] Single query mode
  - [ ] Interactive mode
  - [ ] Pretty printing
  - [ ] Export to JSON
- [ ] Update src/index.ts to add search command
- [ ] Test: `npm run search -- -q "How do I size a button?"`

### Phase 6: Validation (4-6 hours)
- [ ] Create validation test suite (15-20 queries)
- [ ] Run manual testing
- [ ] Measure: P@1, P@3, P@5 accuracy
- [ ] Measure: Latency (avg, p50, p95, p99)
- [ ] Verify: No crashes or errors
- [ ] Generate POC report

### Phase 7: Analysis (2-3 hours)
- [ ] Review metrics against success criteria
- [ ] Document findings
- [ ] Plan next steps:
  - [ ] If P@1 ≥80%: Build remaining transformers
  - [ ] If P@1 <80%: Analyze failures and iterate
- [ ] Create decision framework

---

## Key Implementation Decisions

### 1. Batch Size
- **Choice:** 100 texts per batch (conservative)
- **Rationale:** OpenAI allows 2048, but 100 gives better error recovery
- **Trade-off:** Slightly more API calls, but safer

### 2. Retry Strategy
- **Choice:** Exponential backoff with 3 retries
- **Rationale:** Handle transient failures gracefully
- **Logic:** 1s, 2s, 4s delays between attempts

### 3. Metadata Storage
- **Choice:** Store full chunk content in Qdrant payload
- **Rationale:** Faster retrieval, no need for separate lookups
- **Trade-off:** Larger vector db, but acceptable (<5 MB)

### 4. Search Limit Default
- **Choice:** 5 results by default
- **Rationale:** Balance comprehensiveness with usability
- **Customizable:** Users can request up to 20

### 5. Token Weighting
- **Choice:** Accept 56% below target, validate in POC
- **Rationale:** OpenAI embeddings work well with shorter texts
- **Plan:** Iterate after POC based on actual quality

---

## Common Issues & Solutions

### Issue: "Error: connect ECONNREFUSED 127.0.0.1:6333"
**Cause:** Qdrant not running
**Solution:**
```bash
docker-compose up -d qdrant
docker-compose logs qdrant
```

### Issue: "401 Unauthorized" from OpenAI
**Cause:** Invalid API key
**Solution:**
```bash
# Check .env file
cat .env | grep OPENAI_API_KEY
# Verify key is correct (starts with sk-)
```

### Issue: "Rate limit exceeded"
**Cause:** Too many API requests
**Solution:**
- Reduce batch size from 100 to 50
- Add delay between batches
- Check OpenAI account limits

### Issue: "Collection not found"
**Cause:** First time running embedder
**Solution:**
- Service automatically creates collection
- If manual: Use VectorStoreService.createCollection()

### Issue: "Search returns no results"
**Cause:** Vector index not populated
**Solution:**
```bash
# Verify embedder completed
npm run embed
# Check collection status
curl http://localhost:6333/collections/chakra-ui-docs
```

---

## Success Metrics Summary

**After completing this POC, you should have:**

1. ✅ **Working Vector Search**
   - 387 chunks embedded and searchable
   - <500ms average latency
   - Qdrant running with persistence

2. ✅ **Quality Validation**
   - 80%+ P@1 accuracy (20 test queries)
   - 95%+ P@3 accuracy
   - 100% uptime during validation

3. ✅ **User Interface**
   - CLI single-query mode
   - Interactive query loop
   - Pretty-printed results
   - Export to JSON

4. ✅ **Decision Framework**
   - Clear metrics on approach viability
   - Analysis of failure cases (if any)
   - Recommendations for next phase

5. ✅ **Documentation**
   - POC report with metrics
   - Implementation notes
   - Known limitations

---

## Next Steps After POC

### If POC is Successful (P@1 ≥80%)
1. **Build remaining 6 chunk transformers**
   - ComponentOverviewChunk
   - CapabilityReferenceChunk
   - PropReferenceChunk
   - PropGroupChunk
   - CompositionPatternChunk
   - APIReferenceChunk

2. **Test search quality with all chunk types**
   - Run same validation queries
   - Compare metrics

3. **Consider generation pipeline**
   - Start with Planner service
   - Design ComponentSpec schema

### If POC shows gaps (P@1 <80%)
1. **Analyze failure categories**
   - Which query types fail?
   - Are chunks too small?
   - Is intent classification wrong?

2. **Iterate on CodeExampleChunk**
   - Enhance explanation templates
   - Improve intent classification
   - Retest

3. **Consider hybrid search**
   - Add keyword search fallback
   - Combine with vector search
   - Test combined approach

---

## Timeline Summary

```
Day 1: Setup dependencies + EmbeddingService
       └─ 2h setup + 4-6h EmbeddingService = ~6-8h

Day 2: VectorStoreService + Embedder
       └─ 4-6h VectorStoreService + 4-6h Embedder = ~8-12h

Day 3: RetrievalService (start)
       └─ 4-6h RetrievalService + CLI = ~6-8h

Day 4: RetrievalService (finish) + validation prep
       └─ 2-4h finish + 2h validation prep = ~4-6h

Day 5: Validation testing
       └─ 4-6h manual testing + metrics = ~5-6h

Day 6: Analysis & reporting
       └─ 2-3h analysis + POC report = ~3h

Total: 5-6 days, ~30-45 hours of implementation
```

---

Good luck! You've got this. 🚀

The foundation is solid—this POC will either validate a great approach or uncover learnings to iterate on.
