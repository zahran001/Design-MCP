# AGENTS.md

> **Status:** 2026-06-26 — current to steps 0–4.
>
> **[CLAUDE.md](CLAUDE.md) is the canonical, fuller agent guide and is kept current first.** This file
> mirrors the essentials for tools that read `AGENTS.md`; if the two ever disagree, CLAUDE.md wins.

## Project Summary

- **Name:** `spec-driven-generator`
- **Purpose:** a RAG → generation pipeline for Chakra UI **v3** — crawl docs, extract → normalize →
  embed (Qdrant) → retrieve, then **generate** one grounded, self-contained TSX component from a
  natural-language request, gated on objective `tsc` / v2-smell / composition checks.
- **Primary target:** Chakra UI docs.
- **Tech stack:** TypeScript, Node.js 20+, Playwright, Commander, Zod, OpenAI embeddings, Qdrant, Docker.

## Current Pipeline

This repo is organized as a step-based pipeline:

```text
src/
  index.ts
  steps/
    0-extract-docs/
      crawler.ts
      extractors.ts
      test-extraction/
      test-props/
    1-normalize/
      normalizer.ts
      config/
      inference/
      generators/
      transformers/
      utils/
    2-embed/
      embedder.ts
      utils/
    3-search/
      retriever.ts
      eval/
    4-generate/
      generator.ts
      pipeline.ts
      validators/
      eval/
      test-generation/
  schemas/
    RAGResultSchema.ts
    NormalizedChunkSchema.ts
  services/
    EmbeddingService.ts
    VectorStoreService.ts
    RetrievalService.ts
  utils/
    textProcessor.ts
    tokenEstimator.ts
    chunkId.ts
    searchLogger.ts
```

When making changes, prefer the smallest change set that preserves the existing step boundaries.

## Local Commands

### Install

```bash
npm install
npx playwright install chromium
```

### Build

```bash
npm run build
```

### CLI / Runtime

```bash
npm run cli -- 0-extract-docs -m 10
npm run cli -- 1-normalize
npm run cli -- 2-embed
npm run cli -- 3-search "button color"
npm run cli -- 4-generate "a green submit button"   # NL → grounded v3 TSX + tsc/smell/composition report
```

### Tests and Quality Checks

```bash
npm test
npm run test:coverage
npm run quality:smoke
npm run quality:samples
npm run quality:props-test
npm run quality:props-verify
npm run quality:all
```

## Environment

Copy `.env.example` to `.env` and adjust as needed.

Key variables:

- `START_URL`: crawl entrypoint
- `MAX_PAGES`: crawl limit, `-1` for unlimited
- `CRAWL_URL_PATTERN`: required allowlist prefix for followed URLs
- `CRAWL_DELAY`: delay between pages in milliseconds
- `DEBUG`: verbose logging toggle
- `OPENAI_API_KEY`: required for embeddings
- `QDRANT_URL`: vector DB endpoint
- `QDRANT_COLLECTION_NAME`: target collection
- `EMBEDDING_MODEL`: embedding model name
- `EMBEDDING_DIMENSIONS`: expected embedding dimension

## Code Conventions

- Use ESM and preserve the current `NodeNext` TypeScript setup.
- Target `ES2022`.
- Keep `strict` TypeScript compatibility.
- Prefer named exports over default exports unless an existing file already establishes a different pattern.
- Prefer readable, explicit code over clever compression.
- Keep logs concise and actionable. Include concrete context such as URL, component name, chunk type, or collection name.
- Throw errors with enough detail to debug, but do not bury the caller in noisy messages.
- Preserve idempotence for file-producing steps. Re-running a step should not corrupt artifacts or create duplicate records.
- Follow existing naming patterns in the surrounding module before introducing a new one.

## Change Rules

- Never invent commands, file paths, environment variables, or public APIs.
- Prefer surgical edits over broad refactors unless the task explicitly requires restructuring.
- Do not loosen crawl safety. `CRAWL_URL_PATTERN` filtering is a hard guardrail.
- Strip hash fragments or other duplicate-producing URL variants when queueing crawl targets.
- Be resilient to documentation markup drift. Prefer semantic selectors and layered fallbacks over brittle class-based extraction.
- Do not commit secrets or hardcode keys. Treat `.env.example` as documentation only.
- If changing schemas, keep downstream consumers in mind: extraction, normalization, embedding, and retrieval are coupled through artifact shape.
- If changing output formats, update the relevant docs and verification steps in the same change when practical.

## Preferred Work Patterns

### Extraction changes

- Favor semantic selectors such as `main h1`, `main pre code`, and table header inspection.
- Tolerate missing sections. Some component pages legitimately lack props tables, examples, or accessibility notes.
- Return partial structured data when possible instead of failing the entire run.
- Validate extracted payloads against `RAGResultSchema` before treating them as good artifacts.

### Normalization changes

- Keep chunk IDs stable where possible.
- Preserve schema validity against `NormalizedChunkSchema`.
- Prefer targeted fallbacks over dropping chunks silently.
- Keep generated natural-language explanations honest. Do not infer undocumented defaults or behavior as fact.

### Embedding and retrieval changes

- Keep embedding text deterministic for the same input.
- Avoid shape drift between normalized artifacts and embedding payload builders.
- Log vector-store operations with enough metadata to debug ingestion/search issues without exposing secrets.

### Generation changes

- Ground generation only in retrieved context; output imports come **only** from `@chakra-ui/react`
  and `react` (no `@/components/ui/*`, no icon libraries).
- Trust the objective gates — `tsc`-validity + `v2-smell` lint + composition lint. The LLM judge is
  **not** trusted on v3 (it inverts); use it as a secondary signal only.
- Never emit a Chakra **v3** API from memory — verify against the retrieved corpus or the
  `gen-sandbox` `tsc` check (v3 broke heavily from v2).
- Keep the A/B isolation: curated knowledge (v2→v3 renames, few-shot exemplars) stays grounded-arm-
  only, keyed on retrieval — never in the shared prompt.
- Verify with `npx tsx src/steps/4-generate/eval/run-ab.ts` and
  `src/steps/4-generate/test-generation/run-heldout.ts`; judge per target prompt cell (generation is
  non-deterministic), not the headline rate.

## Verification Flow

Choose the smallest verification set that matches the scope of the change.

### For extraction work

```bash
npm run cli -- 0-extract-docs -m 5
npm run quality:smoke
npm run quality:props-verify
```

Success criteria:

- The run completes without crawler crashes.
- JSON artifacts are written to `artifacts/raw-json/`.
- Output includes `componentName`, `sourceUrl`, and useful extracted content.

### For normalization work

```bash
npm test
```

Focus on transformer, inference, generator, and schema tests relevant to the modified files.

### For embedding or search work

- Run `npm run build`.
- Run the specific step you changed (`npm run embed` or `npm run search`) if local services and environment variables are available.
- If Qdrant or API credentials are unavailable, state that clearly instead of guessing.

## Docker

Build and run with:

```bash
docker build -t design-mcp .
docker run --rm -e START_URL="https://chakra-ui.com/docs/components/concepts/overview" -e MAX_PAGES=20 design-mcp
```

When editing Docker-related files:

- Keep the image reproducible.
- Prefer multi-stage builds if the change affects build/runtime layering.
- Keep Playwright setup explicit.

## Known Gotchas

- Chakra UI documentation structure changes over time. Do not hardcode fragile class names when semantic alternatives exist.
- Internal docs links often contain hash fragments such as `#usage` or `#props`; normalize them before deduplication.
- Some pages contain nested MDX markup and multiple code blocks; extract the actual code text, not prettified wrapper markup.
- Props tables may vary in column order and naming; detect them by meaning, not only exact header text.
- A missing props table or code sample is not automatically an error.

## Performance Knobs

- `MAX_PAGES` controls crawl breadth.
- `CRAWL_DELAY` controls crawl politeness and runtime.
- Extraction and normalization should prefer predictable behavior over aggressive concurrency.

## Non-goals

Do not optimize these unless the task explicitly calls for it:

- Parallel browser contexts
- Broad architectural rewrites across multiple pipeline steps
- Persisted crawl checkpointing
- Unscoped schema redesign
- Premature optimization of embedding/search before correctness is verified

## Definition Of Done

A change is generally done when:

- The code builds, or the reason it could not be built is stated clearly.
- Relevant tests or quality checks for the touched area pass, or any blocked verification is stated clearly.
- Artifact-producing steps remain deterministic and schema-valid.
- Documentation and configuration examples remain accurate for the changed behavior.
