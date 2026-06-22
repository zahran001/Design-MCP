# Test Checklist

Manual verification checklist for the current Design-MCP implementation.

Scope covered:
- Step 0: extraction
- Step 1: normalization
- Step 2: embedding into Qdrant
- Step 3: retrieval from Qdrant

Out of scope:
- planner/spec generation
- validator pipeline
- MCP server
- production API/deployment

## 1. Prerequisites

- Node.js 20+
- npm installed
- Docker available for Qdrant
- `.env` created from `.env.example`

Minimum `.env` values:

```env
START_URL=https://chakra-ui.com/docs/components/concepts/overview
MAX_PAGES=10
CRAWL_URL_PATTERN=https://chakra-ui.com/docs/components/
OPENAI_API_KEY=sk-...
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_NAME=chakra-ui-docs
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

Install once:

```bash
npm install
npx playwright install chromium
```

## 2. Fast Sanity Check

Run these first:

```bash
npm run build
npm test -- --runInBand --silent
npm run cli -- --help
```

Expected:
- build succeeds
- tests pass
- CLI shows `0-extract-docs`, `1-normalize`, `2-embed`, `3-search`

## 3. Step 0: Extraction

Quick extraction run:

```bash
npm run cli -- 0-extract-docs -m 5
```

Quality checks:

```bash
npm run quality:smoke
npm run quality:props-verify
```

Verify manually:
- new JSON files appear in `artifacts/raw-json/`
- extracted files include `componentName`
- extracted files include `sourceUrl`
- extracted files include `codeExamples` or `props` or both

Spot-check one file:

```bash
Get-Content artifacts\raw-json\Button-*.json -TotalCount 80
```

## 4. Step 1: Normalization

Single-component run:

```bash
npm run cli -- 1-normalize Button
```

Full run:

```bash
npm run cli -- 1-normalize
```

Verify manually:
- `artifacts/normalized/Button.json` exists
- `artifacts/normalized/Button-props.json` exists when props are available
- code example chunks contain `metadata.chunkType = "code-example"`
- prop chunks contain `metadata.chunkType = "prop-reference"`
- prop normalization summary prints token statistics

Spot-check outputs:

```bash
Get-Content artifacts\normalized\Button.json -TotalCount 80
Get-Content artifacts\normalized\Button-props.json -TotalCount 80
```

## 5. Step 2: Qdrant Startup

Start Qdrant:

```bash
docker compose up -d
```

Verify Qdrant is healthy:

```bash
curl http://localhost:6333/health
```

Expected:
- Qdrant container is running
- health endpoint returns success

## 6. Step 2: Embedding

Small validation run:

```bash
npm run cli -- 2-embed --limit 5
```

Optional dedicated test harness:

```bash
npx tsx src/steps/2-embed/embedder-test.ts
```

Full run:

```bash
npm run cli -- 2-embed
```

Verify manually:
- collection creation/upsert logs appear
- chunks are embedded without extraction errors
- limited run stops at the requested count
- both code-example and prop-reference chunks are accepted

Useful variation:

```bash
npm run cli -- 2-embed --limit 10 --batch-size 5
```

## 7. Step 3: Retrieval

Run a few searches:

```bash
npm run cli -- 3-search "button color"
npm run cli -- 3-search "button size" --limit 3
npm run cli -- 3-search "disabled button"
```

Verify manually:
- ranked results print without crashing
- result summaries work for both code-example and prop-reference payloads
- payload logs show component name, source URL, and summary text
- execution summary prints at the end

## 8. Regression Checks

Use these to confirm the recent fixes specifically:

### Retrieval payload summary regression

Run:

```bash
npm run cli -- 3-search "button size"
```

Pass condition:
- search does not fail when a prop-reference chunk is returned
- summary text can come from prop fields, not only `explanation`

### Prop token statistics regression

Run:

```bash
npm run cli -- 1-normalize Button
```

Pass condition:
- token statistics show a non-zero optimal-range count when appropriate
- no obviously broken `0/N` due to calculation bug

### Embedding text extraction regression

Run:

```bash
npm test -- --runInBand --silent
```

Pass condition:
- `extractEmbeddingText` tests pass
- metadata anchors are accepted as intended behavior

## 9. Code Pointers

Use these files when investigating failures:

- CLI entrypoints: `src/index.ts`
- extraction crawler: `src/steps/0-extract-docs/crawler.ts`
- extraction logic: `src/steps/0-extract-docs/extractors.ts`
- normalizer: `src/steps/1-normalize/normalizer.ts`
- embedder: `src/steps/2-embed/embedder.ts`
- embedder test harness: `src/steps/2-embed/embedder-test.ts`
- embedding text extraction: `src/steps/2-embed/utils/extractEmbeddingText.ts`
- retriever: `src/steps/3-search/retriever.ts`
- search summary/logging: `src/utils/searchLogger.ts`
- vector config: `src/config/vectorConfig.ts`
- Qdrant service: `src/services/VectorStoreService.ts`
- retrieval service: `src/services/RetrievalService.ts`

## 10. Current Completion Notes

Implemented now:
- extraction
- code-example normalization
- prop-reference normalization
- embedding pipeline
- vector search CLI

Not implemented yet:
- remaining 5 chunk types
- planner/spec generation
- validator pipeline
- MCP server
- production API/CI/CD
