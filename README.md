# Design-MCP: Spec-Driven Component Generator

> 👉 **New here?** Start with the **[engineering showcase →](SHOWCASE.md)** (the problem, architecture,
> and key decisions at a glance). This README is the developer changelog / setup reference.

> **Status:** 2026-06-25 — full pipeline (steps 0–4) built; live per-step status below and in the
> linked phase docs.

A TypeScript-based documentation crawler and extraction tool designed to systematically gather component specifications from design system documentation (initially targeting Chakra UI) and transform them into structured, machine-readable formats suitable for RAG (Retrieval-Augmented Generation) systems.

## Quick Start

```bash
# 1. Install dependencies
npm install
npx playwright install chromium

# 2. Configure (optional - defaults work for Chakra UI)
cp .env.example .env

# 3. Run extraction
npm run cli -- 0-extract-docs -m 10

# 4. Verify quality
npm run quality:smoke
npm run quality:samples
```

**Output:** See extracted data in [artifacts/raw-json/](artifacts/raw-json/)

---

## 🎯 Current Focus: Ship the generation capability behind a UI

The full pipeline (extract → normalize → embed → search → **generate**) is built and validated. Step 4
spec-driven generation reached **~93% grounded tsc-valid** via the A–F correction loop (method +
results in **[GENERATION_EXPERIMENT.md](GENERATION_EXPERIMENT.md)**). The active work is exposing that
tested capability through an accessibility-first UI (type a request → see the v3 component rendered
live + its code + the objective report) — plan in **[README_FULLSTACK.md](README_FULLSTACK.md)**.

<details>
<summary><b>✅ Resolved earlier — Trustworthy Retrieval Evaluation</b> (kept for history)</summary>

The retrieval-quality question is **answered**: authentic docs prose beats synthesized templates
(LLM-as-judge, paraphrase leakage test). Full rationale and proof in
**[EVALUATION_STRATEGY.md](EVALUATION_STRATEGY.md)**.

**The fundamental question (resolved):** the text we embed for code examples was once *synthesized from
hardcoded templates*, while the live docs contain real prose we discarded (the Button page has ~21
section headings + per-section descriptions; raw JSON once captured **1 heading and 0 prose**). Was
template-embedding viable, or must we embed authentic prose? Answered with data, in three phases:

- **Phase 1 — Build the trustworthy eval (do first).** Add LLM-as-judge *graded* chunk relevance
  (nDCG) and a paraphrased developer-query set. The current "100% component-hit" score is a mirage
  (too coarse, possibly circular). *Do not fix the scraper yet — build the measuring tool.*
- **Phase 2 — Lock the baseline.** Run the current template-generated data through the strict
  harness for an honest (likely much lower) baseline.
- **Phase 3 — Fix the scraper (Experiment #1).** Rewrite DOM traversal to capture section
  headings + intro prose, re-crawl, re-embed the authentic text, re-eval. The delta vs baseline
  conclusively proves whether real prose beats templates.

**Already shipped on this track:**
- Retrieval eval harness — `npm run quality:eval` ([src/steps/3-search/eval/](src/steps/3-search/eval/)),
  committed baseline at [artifacts/eval/baseline.json](artifacts/eval/).
- **chunkId-collision fix** — duplicate IDs were silently dropping **26% of chunks** at embed time
  (747 chunks → 554 points); now 747 unique → 747 points.

> ⚠️ Before any `2-embed`/`quality:eval` run: set `DEBUG=false` in `.env` (else the OpenAI SDK
> floods stdout), ensure Qdrant is running, and **drop the `chakra-ui-docs` collection before
> re-embedding if chunkIds changed** (point IDs are `uuidv5(chunkId)`; stale points orphan
> otherwise). See [EVALUATION_STRATEGY.md §6](EVALUATION_STRATEGY.md) for the full gotcha list.

</details>

---

## Overview

Design-MCP is a specialized web scraping and data extraction pipeline that:
- Crawls design system documentation websites using Playwright
- Extracts structured component information (props, examples, accessibility notes)
- Filters code examples for composition patterns (not boilerplate)
- Validates and schemas data using Zod
- Prepares documentation for embedding into vector stores and RAG systems
- Enables AI-powered component generation from design specifications

## Architecture

The project follows a **step-based pipeline architecture**:

```
✅ Step 0: Extract Documentation (COMPLETE)
├── Crawling (Playwright-based web automation)
├── Extraction (CSS selectors & DOM parsing)
└── Storage (JSON artifacts)

✅ Step 1: Normalize & Transform (4 of 7 chunk types)
├── CodeExampleChunk transformer ✅ (410 chunks; embeds real docs prose)
├── PropReferenceChunk transformer ✅ (374 chunks)
├── ComponentOverviewChunk ✅ (50) + CapabilityReferenceChunk ✅ (63)
└── 897 normalized chunks from 50 components

✅ Step 2: Embed & Vector Store
├── OpenAI text-embedding-3-small (1536d)
├── Qdrant vector store (897 points, no drift)
└── Batch ingestion

✅ Step 3: Search & Retrieval + Evaluation
├── Vector similarity search + metadata filtering
├── LLM-as-judge eval harness (gP@k / nDCG, paraphrase leakage test)
└── Verdict: authentic docs prose > synthesized templates

✅ Step 4: Spec-Driven Generation (NL → grounded v3 TSX)
├── Retrieval-grounded generation + bounded tsc self-heal (Passes A–F)
├── Objective gates: tsc-valid + v2-smell + composition lint
└── Grounded ~93% tsc-valid (hinted); 100% on held-out prompts
```

### Current Implementation Status

**✅ Week 1 Complete - Core Extraction Pipeline:**
- ✅ CLI infrastructure with Commander.js
- ✅ Playwright browser automation setup
- ✅ Full data schemas (ComponentDoc, Prop, CodeExample)
- ✅ Text processing utilities (chunking, normalization)
- ✅ Environment-based configuration
- ✅ Docker containerization
- ✅ TypeScript compilation and type safety
- ✅ BFS web crawler with link discovery
- ✅ Component data extraction (descriptions, props, code examples)
- ✅ High-quality code filtering (composition patterns only)
- ✅ Props table parsing (column-order agnostic)
- ✅ Related components detection
- ✅ Quality validation suite (smoke tests + sample viewer)

**📊 Extraction Quality (50 Chakra UI components):**
- Schema validation: 100% (50/50 files)
- Description coverage: 100% (50/50 components)
- **Section + prose capture: ~100%** of code examples now carry their real heading **and** intro
  prose (Phase 3 scraper rewrite; was 1/16 headings + 0 prose on the Button page)
- Props extraction: handles simple, composite, and no-props patterns (dot notation for composites,
  e.g. "Root.collection")

**✅ Step 1 — Normalization (4 of 7 chunk types implemented):**
- ✅ **CodeExampleChunk** transformer — **410 chunks**. Embeds the **authentic section prose**
  captured from the docs; the hardcoded template generator is demoted to a fallback used only for
  prose-less sections.
- ✅ **PropReferenceChunk** transformer — **374 chunks** (PropExplanationGenerator + externalized
  template config).
- ✅ **ComponentOverviewChunk** (50) + **CapabilityReferenceChunk** (63) — "what is X" / "what can X
  do" chunks; both routed in `extractEmbeddingText.ts` and embedded (Pass B's reserved-slot retrieval
  depends on them).
- ✅ Inference engine (code analyzer, section inferrer, intent classifier), config system, and
  graceful fallback generation.
- ✅ **897 normalized chunks** total from 50 components.
- 📋 Not yet implemented (3 of 7 types, low ROI): `prop-group`, `composition-pattern`, `api-reference`.

**✅ Step 2 — Embedding:** all **897 chunks embedded** into Qdrant (`chakra-ui-docs`,
text-embedding-3-small, 1536d); drift detection clean (897 points = 897 chunks). _Proof — Qdrant
`points/count` by `chunkType` (2026-06-25): code-example 410, prop-reference 374, component-overview
50, capability-reference 63; prop-group/composition-pattern/api-reference 0._

**✅ Step 3 — Search + Evaluation:** LLM-as-judge retrieval eval (`npm run quality:eval:judge`)
reporting graded precision (gP@k), no-relevant count, and nDCG over the golden set plus a held-out
paraphrased set (leakage test). It proved **authentic prose beats templates** (gpt-4o judge:
paraphrased gP@k 0.684 → 0.748, no-relevant queries 3 → 0). See
[EVALUATION_STRATEGY.md](EVALUATION_STRATEGY.md).

**🧪 Tests:** 609 passing across 20 suites.

**✅ Step 4 — Spec-Driven Generation:** NL request → retrieval-grounded v3 TSX → bounded `tsc`
self-heal, gated on objective signals (tsc-valid + v2-smell + composition lint, **not** the LLM judge,
which Passes A proved unreliable on v3). The A–F correction loop reached **~93% grounded tsc-valid**
(hinted repair) on the 15 v2-"landmine" prompts and **100%** on a held-out generalization set. CLI:
`npm run cli -- 4-generate "<request>"`. Full method + results: [GENERATION_EXPERIMENT.md](GENERATION_EXPERIMENT.md).

**🎯 Next:** ship the tested generation capability behind a UI (live preview + code + objective
report) — see [README_FULLSTACK.md](README_FULLSTACK.md). Then: corpus expansion (~50 more components
in `raw-json-phase3-extra/`), the remaining 3 low-ROI chunk types, and an MCP server.

## Project Structure

```
Design-MCP/
├── src/
│   ├── index.ts                               # CLI entry point
│   ├── schemas/
│   │   ├── RAGResultSchema.ts                 # Extraction schemas (Step 0)
│   │   └── NormalizedChunkSchema.ts           # Normalization schemas (7 chunk types defined)
│   ├── steps/
│   │   ├── 0-extract-docs/                    # ✅ COMPLETE
│   │   │   ├── crawler.ts                     # BFS web crawler
│   │   │   ├── extractors.ts                  # DOM extraction logic
│   │   │   └── test-extraction/               # Quality validation suite
│   │   └── 1-normalize/                       # ✅ PARTIAL (CodeExampleChunk complete)
│   │       ├── config/                        # Configuration system
│   │       │   ├── categories.config.ts       # Component category mappings
│   │       │   ├── patterns.config.ts         # Pattern detection rules
│   │       │   ├── transformer.config.ts      # Transformer behavior settings
│   │       │   └── prop-templates.ts          # ✅ Prop description + guidance templates (NEW)
│   │       ├── inference/                     # Inference engine
│   │       │   ├── codeAnalyzer.ts            # Extract imports, props, hooks
│   │       │   ├── sectionInferrer.ts         # Detect semantic section titles
│   │       │   ├── intentClassifier.ts        # Classify intent (6 types)
│   │       │   └── patternMatchers.ts         # Pattern matching utilities
│   │       ├── generators/                    # Content generation
│   │       │   ├── templateDataExtractor.ts   # Extract data for templates
│   │       │   ├── explanationGenerator.ts    # Generate natural language (code examples)
│   │       │   ├── propExplanationGenerator.ts # ✅ Generate natural language (props) (NEW)
│   │       │   └── __tests__/
│   │       │       ├── explanationGenerator.test.ts
│   │       │       └── propExplanationGenerator.test.ts # ✅ 37/37 tests (NEW)
│   │       ├── transformers/                  # Chunk transformers
│   │       │   ├── codeExampleTransformer.ts  # ✅ CodeExampleChunk (complete)
│   │       │   ├── propReferenceTransformer.ts # PropReferenceChunk (Phase 3)
│   │       │   └── __tests__/
│   │       │       ├── codeExampleTransformer.test.ts
│   │       │       └── propReferenceTransformer.test.ts
│   │       ├── utils/                         # Error handling & metrics
│   │       │   ├── fallbackChunks.ts          # Graceful degradation
│   │       │   ├── transformerErrors.ts       # Custom error types
│   │       │   ├── transformationContext.ts   # Metrics tracking
│   │       │   └── transformationMetrics.ts   # JSONL logging
│   │       └── normalizer.ts                  # Main orchestrator
│   └── utils/
│       ├── textProcessor.ts                   # Text chunking & normalization
│       ├── chunkId.ts                         # Stable chunk ID generation
│       └── tokenEstimator.ts                  # Token counting
├── artifacts/
│   ├── raw-json/                              # ✅ 50 extracted component files
│   ├── normalized/                            # ✅ normalized chunk files (897 chunks, 4 types)
│   ├── metrics/                               # ✅ Transformation metrics (JSONL)
│   └── logs/                                  # ✅ Error logs
├── docs/                                       # 📂 Documentation (see "Documentation" below)
│   ├── CHUNK_TYPE_STRATEGY.md                  # ROI analysis of the 7 chunk types
│   ├── NORMALIZATION_TECHNICAL_GUIDE.md        # Normalization transformer deep-dive
│   ├── NORMALIZATION_USAGE_GUIDE.md            # Normalization usage & design
│   ├── archive/                               # Historical / superseded docs
│   ├── week1/                                 # Week 1 implementation docs
│   └── week2/                                 # Week 2 phase docs
├── scripts/                                    # Build & utility scripts
├── .env.example                               # Environment configuration template
├── Dockerfile                                 # Multi-stage Docker build
├── package.json                               # Dependencies & scripts
├── tsconfig.json                              # TypeScript configuration
├── README.md                                  # This file
├── CLAUDE.md                                  # Project quick facts & contribution guide
├── AGENTS.md                                  # Agent-facing project overview
├── EVALUATION_STRATEGY.md                     # Active retrieval-quality plan
└── TEST_CHECKLIST.md                          # Manual verification checklist
```

## Documentation

Active docs live in the repo root; reference material is under `docs/`; superseded historical
docs are under `docs/archive/` (kept for provenance).

### Root — active
| Doc | What it is |
|---|---|
| [README.md](README.md) | This file — overview, setup, CLI, project structure. |
| [CLAUDE.md](CLAUDE.md) | Contribution rules & quick facts for AI agents working in this repo. |
| [AGENTS.md](AGENTS.md) | Agent-facing project & pipeline overview. |
| [EVALUATION_STRATEGY.md](EVALUATION_STRATEGY.md) | Active retrieval-quality plan + results: LLM-as-judge eval, paraphrase leakage test, and the authentic-prose-vs-template verdict. |
| [TEST_CHECKLIST.md](TEST_CHECKLIST.md) | Manual verification checklist for pipeline steps 0–3. |

### Reference — `docs/`
**Start at [docs/INDEX.md](docs/INDEX.md)** — it classifies every `docs/` file as 🟢 active vs 🗄️
historical (the folder is mostly a point-in-time archive; trust the root docs for current facts).

| Doc | What it is |
|---|---|
| [docs/CHUNK_TYPE_STRATEGY.md](docs/CHUNK_TYPE_STRATEGY.md) | ROI analysis of the 7 chunk types — which to implement next and why. |
| [docs/NORMALIZATION_TECHNICAL_GUIDE.md](docs/NORMALIZATION_TECHNICAL_GUIDE.md) | Deep-dive on the normalization transformer (inference → generation → chunk assembly). |
| [docs/NORMALIZATION_USAGE_GUIDE.md](docs/NORMALIZATION_USAGE_GUIDE.md) | How to run/use normalization, plus design decisions. |

> The two normalization guides predate PropReferenceChunk; their "1/7 chunk types" status headers
> are out of date (prop-reference is implemented), but the architectural content remains accurate.

### Archive — `docs/archive/` (historical / superseded)
| Doc | Why archived |
|---|---|
| [docs/archive/PROJECT_PLAN.md](docs/archive/PROJECT_PLAN.md) | Original Week 1–4 technical plan (Oct 2025); superseded by EVALUATION_STRATEGY.md and actual progress. |
| [docs/archive/VECTOR_DB_POC_GUIDE.md](docs/archive/VECTOR_DB_POC_GUIDE.md) | Build plan/timeline for the vector-DB POC — now complete. |
| [docs/archive/PROJECT_REVIEW.md](docs/archive/PROJECT_REVIEW.md) | Point-in-time project health assessment (Dec 2025). |
| [docs/archive/RETRIEVAL_TEST_REPORT.md](docs/archive/RETRIEVAL_TEST_REPORT.md) | Original 5-query manual retrieval test; the golden eval set was seeded from it. |

Dated implementation/design notes also live under `docs/week1/` and `docs/week2/`.

## Installation

### Prerequisites
- Node.js >= 20.0.0
- npm or yarn

### Local Setup

```bash
# Clone the repository
git clone <repository-url>
cd Design-MCP

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your preferred settings

# Install Playwright browsers
npx playwright install chromium
```

### Docker Setup

```bash
# Build the Docker image
docker build -t design-mcp .

# Run with environment variables
docker run -v $(pwd)/artifacts:/app/artifacts \
  -e START_URL=https://chakra-ui.com/docs/components/concepts/overview \
  -e MAX_PAGES=100 \
  design-mcp start
```

## Configuration

Edit `.env` to customize crawler behavior:

```env
# URL of the documentation to start crawling from
START_URL=https://chakra-ui.com/docs/components/concepts/overview

# Maximum number of pages to crawl (-1 for unlimited)
MAX_PAGES=100

# REQUIRED: Only URLs starting with this pattern will be crawled
# This prevents the crawler from following external links
CRAWL_URL_PATTERN=https://chakra-ui.com/docs/components/

# Optional: Delay between page navigations (in milliseconds)
CRAWL_DELAY=1000
```

**Key Settings:**
- `START_URL`: The page where crawling begins (should list component links)
- `MAX_PAGES`: Limit crawl size for testing (use 5-10 for quick tests)
- `CRAWL_URL_PATTERN`: Safety filter to stay within intended documentation scope
- `CRAWL_DELAY`: Polite crawling delay (1000ms = 1 second between pages)

## Usage

### CLI Commands

```bash
# Build TypeScript
npm run build

# Step 0: Extract documentation - uses settings from .env
npm run cli -- 0-extract-docs

# With CLI options (override .env settings)
npm run cli -- 0-extract-docs -s https://chakra-ui.com/docs/components/concepts/overview -m 50

# Step 1: Normalize code examples (creates semantic chunks)
npm run cli -- 1-normalize                    # Process all components
npm run cli -- 1-normalize Button             # Process single component

# Step 2: Embed normalized chunks into Qdrant
npm run cli -- 2-embed
npm run cli -- 2-embed --limit 5              # Quick validation run

# Step 3: Search embedded chunks
npm run cli -- 3-search "button color"
npm run cli -- 3-search "button color" --limit 3

# Development mode (no build required)
npm run dev
```

### Command Options

**`0-extract-docs`** - Crawl and extract component documentation

Options:
- `-s, --start-url <url>` - Starting URL for crawling
- `-m, --max-pages <number>` - Maximum number of pages to crawl

Example:
```bash
npm run cli -- 0-extract-docs -s https://chakra-ui.com/docs/components/concepts/overview -m 50
```

**`1-normalize [component]`** - Transform raw JSON into normalized chunks

Transforms code examples from `artifacts/raw-json/` into semantic chunks with:
- Intent classification (sizing, variants, states, composition, etc.)
- Natural language explanations
- Structured metadata for vector search

Example:
```bash
npm run cli -- 1-normalize Button             # Single component
npm run cli -- 1-normalize                    # All components
```

Output: `artifacts/normalized/{ComponentName}.json` (one file per component)

**`2-embed`** - Generate embeddings for normalized chunks and upsert them to Qdrant

- Uses `QDRANT_COLLECTION_NAME`, `EMBEDDING_MODEL`, and `EMBEDDING_DIMENSIONS` from `.env`
- Supports `--limit` for small validation runs and `--batch-size` for upsert tuning

Example:
```bash
npm run cli -- 2-embed
npm run cli -- 2-embed --limit 5
```

**`3-search <query>`** - Search embedded chunks

- Embeds the query and searches the configured Qdrant collection
- Prints ranked matches with payload summaries

Example:
```bash
npm run cli -- 3-search "button color"
npm run cli -- 3-search "button color" --limit 3
```

### Quality Evaluation Commands

After extraction, validate the quality of extracted content:

```bash
# Run automated smoke test (pass/fail check)
npm run quality:smoke

# View random samples for manual review
npm run quality:samples

# Test props extraction logic
npm run quality:props-test

# Verify props in extracted files
npm run quality:props-verify

# Run all quality checks
npm run quality:all

# View custom number of samples (e.g., 5)
npx tsx src/steps/0-extract-docs/test-extraction/sample-viewer.ts 5
```

**Quality criteria:**
- ✅ Schema validation ≥95%
- ✅ Description coverage ≥80%
- ✅ Code examples coverage ≥70%
- ✅ Props extraction validated

See [docs/week1/testing/QUALITY_EVALUATION.md](docs/week1/testing/QUALITY_EVALUATION.md) for details.

## Data Schema

Extracted documentation follows the `RAGResult` schema:

```typescript
interface RAGResult {
  componentName: string;           // e.g., "Button"
  sourceUrl: string;                // Original documentation URL
  description: string;              // Component description
  props: Prop[];                    // Component properties
  codeExamples: CodeExample[];      // Usage examples
  accessibilityNotes?: string;      // A11y considerations
}

interface Prop {
  name: string;                     // e.g., "variant"
  type: string;                     // e.g., "string | 'solid' | 'outline'"
  description: string;              // Property description
  defaultValue?: string;            // Default value if any
  required: boolean;                // Whether prop is required
}

interface CodeExample {
  title: string;                    // Example title
  description?: string;             // Example description
  code: string;                     // Source code
  language: string;                 // Default: "tsx"
}
```

## Output

Extracted data is saved to individual JSON files:
```
artifacts/raw-json/{ComponentName}-{timestamp}.json
```

Each file contains structured component data validated against the `ComponentDocSchema`:
- **componentName**: Component identifier (e.g., "Button")
- **sourceUrl**: Original documentation URL
- **description**: Component description/purpose
- **codeExamples**: High-quality usage examples (filtered)
- **relatedComponents**: Components used together in examples
- **props**: Component properties from documentation tables

Example output structure:
```json
{
  "componentName": "Button",
  "sourceUrl": "https://chakra-ui.com/docs/components/button",
  "description": "Used to trigger an action or event",
  "codeExamples": [...],
  "relatedComponents": ["ButtonGroup", "IconButton", "Stack"],
  "props": [...]
}
```

## Development Roadmap

### ✅ Week 1: Core Extraction (COMPLETE)
- [x] Project setup and CLI infrastructure
- [x] Complete web crawler implementation
- [x] Implement DOM extraction logic
- [x] High-quality code filtering (composition patterns)
- [x] Props table parsing (column-order agnostic)
- [x] Related components detection
- [x] Test against Chakra UI documentation (60+ components)
- [x] Validate data schema with real examples (100% pass rate)
- [x] Quality validation suite

**📂 View Results:** See [artifacts/raw-json/](artifacts/raw-json/) for extracted data

### ✅ Step 1 Complete: Normalization Pipeline (4 of 7 chunk types)

**CodeExampleChunk Transformer**
- [x] Inference engine (code analyzer, section inferrer, intent classifier)
- [x] Embeds **authentic docs prose**; the template generator is demoted to a fallback
- [x] Transformation pipeline (raw JSON → CodeExampleChunk), config system, fallback generation
- [x] Metrics tracking & JSONL logging
- [x] **410 code-example chunks** from 50 components

**PropReferenceChunk Transformer**
- [x] `propExplanationGenerator.ts` + externalized `prop-templates.ts` (60+ description, 20+ guidance)
- [x] Type-aware fallbacks; union truncation; honest defaults
- [x] `normalizePropReferences()` orchestrator — per-prop error handling + Zod validation
- [x] **374 prop-reference chunks** from 50 components

**✅ ComponentOverviewChunk + CapabilityReferenceChunk** — **50 + 63 chunks**; "what is X" / "what
can X do". Routed in `extractEmbeddingText.ts` and embedded (Pass B reserved-slot retrieval uses them).

**📋 Remaining chunk types (3 of 7, low ROI):**
- [ ] `prop-group`, `composition-pattern`, `api-reference`

### ✅ Step 2 Complete: Embedding & Vector Store
- [x] OpenAI text-embedding-3-small (1536d)
- [x] Qdrant store — **897 points embedded**, drift detection clean
- [x] Idempotent upsert via `uuidv5(chunkId)` (after fixing a collision bug that dropped 26% of points)

### ✅ Step 3 Complete: Search & Evaluation
- [x] Vector similarity search + metadata filtering, CLI query interface
- [x] **LLM-as-judge eval harness** (`quality:eval:judge`): graded precision (gP@k), no-relevant count, nDCG
- [x] Held-out **paraphrased** query set (leakage / circularity test)
- [x] **Verdict: authentic prose > templates** (paraphrased gP@k 0.684 → 0.748). See [EVALUATION_STRATEGY.md](EVALUATION_STRATEGY.md)

**🔮 Next:**
- [ ] Implement `component-overview` + `capability-reference` chunk types (the weakest eval categories)
- [ ] Optional corpus expansion (~50 more components discovered during the re-crawl)
- [ ] Spec-driven generation (Step 4) and LLM re-ranking (if needed)

**📖 Technical Documentation:**
- [docs/NORMALIZATION_TECHNICAL_GUIDE.md](docs/NORMALIZATION_TECHNICAL_GUIDE.md) - Implementation deep-dive
- [docs/NORMALIZATION_USAGE_GUIDE.md](docs/NORMALIZATION_USAGE_GUIDE.md) - Usage & design decisions

### Week 3+: Advanced Features (PLANNED)
- [ ] Two-stage retrieval optimization
- [ ] Multi-query strategies
- [ ] Component composition queries
- [ ] Extend to other design systems (Material-UI, Ant Design)
- [ ] Custom component library support

## Technical Details

### Technology Stack
- **Runtime:** Node.js 20+
- **Language:** TypeScript (ES2022)
- **Browser Automation:** Playwright (Chromium)
- **CLI Framework:** Commander.js
- **Schema Validation:** Zod
- **Configuration:** dotenv

### Key Components

**ChakraDocsSpider** ([src/steps/0-extract-docs/crawler.ts](src/steps/0-extract-docs/crawler.ts))
- Manages Playwright browser lifecycle
- BFS crawling with link discovery
- Orchestrates page navigation and data extraction
- Validates and saves individual JSON files per component

**Extractors** ([src/steps/0-extract-docs/extractors.ts](src/steps/0-extract-docs/extractors.ts))
- CSS selector-based DOM parsing with semantic fallbacks
- High-quality code filtering (composition score ≥5)
- Column-order-agnostic props table parsing
- Related components detection from code examples
- Section-aware extraction (skips Installation/Import sections)

**Quality Validation** ([src/steps/0-extract-docs/test-extraction/smoke-test.ts](src/steps/0-extract-docs/test-extraction/smoke-test.ts))
- Schema validation (Zod)
- Coverage metrics (descriptions, code examples, props)
- Pass/fail criteria enforcement
- Automated quality gates

**Sample Viewer** ([src/steps/0-extract-docs/test-extraction/sample-viewer.ts](src/steps/0-extract-docs/test-extraction/sample-viewer.ts))
- Random sampling for manual review
- Formatted output for human inspection
- Quality verification workflow

**Normalization Pipeline** ([src/steps/1-normalize/](src/steps/1-normalize/))
- **Transformers**: CodeExample + PropReference + ComponentOverview + CapabilityReference (4/7 chunk types)
- **Inference Engine**: Code analyzer, section inferrer, intent classifier
- **Content Generation**: Authentic docs prose, with template generator as a fallback
- **Configuration**: External JSON configs for categories, patterns, behavior
- **Error Handling**: Graceful fallbacks, detailed logging
- **Metrics**: JSONL-based transformation tracking

**Normalization Schemas** ([src/schemas/NormalizedChunkSchema.ts](src/schemas/NormalizedChunkSchema.ts))
- 7 specialized chunk types defined (CodeExampleChunk + PropReferenceChunk implemented)
- Dual content strategy (embedding-optimized + API reference)
- Type-safe with Zod validation

**Chunk ID Generation** ([src/utils/chunkId.ts](src/utils/chunkId.ts))
- Stable, semantic ID generation
- Versioning support
- Sequential fallback for non-semantic cases

**Quality Assurance**
- 609 passing tests across 20 test suites
- Configuration-driven pattern matching
- Fallback generation for error recovery

### Design Patterns
- **Step-based Pipeline:** Modular architecture for extensibility
- **Configuration-driven:** Environment variables for runtime behavior
- **Schema Validation:** Type-safe data processing with Zod
- **Separation of Concerns:** Clear boundaries between crawling, extraction, and processing

## Troubleshooting

### Playwright Issues
```bash
# Reinstall browser binaries
npx playwright install chromium --force

# Check browser installation
npx playwright install --dry-run
```

### Permission Errors
Ensure the `artifacts/raw-json` directory is writable:
```bash
mkdir -p artifacts/raw-json
chmod -R 755 artifacts
```

### TypeScript Compilation Errors
```bash
# Clean and rebuild
rm -rf dist
npm run build
```

## Contributing

This project is in active development. Contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Implement changes with tests
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Development Guidelines
- Follow existing code structure and naming conventions
- Add TypeScript types for all new code
- Update schemas when changing data structures
- Test extraction logic against multiple documentation sources
- Document non-obvious implementation decisions

## Use Cases

### AI-Powered Component Generation
Use extracted specs to train or prompt LLMs for generating:
- Component implementations in different frameworks
- Custom variants based on design system patterns
- Accessibility-compliant alternatives

### Documentation Analysis
- Compare component APIs across design systems
- Identify documentation gaps
- Generate compatibility matrices

### Migration Tools
- Assist in migrating between design systems
- Map equivalent components across libraries
- Generate migration scripts

## License

[Specify your license here]

## Acknowledgments

- Built for extracting specifications from design systems like [Chakra UI](https://chakra-ui.com/)
- Powered by [Playwright](https://playwright.dev/) for reliable web automation
- Schema validation by [Zod](https://zod.dev/)

---

## What's Next?

### If you're starting fresh:
1. **Run the Quick Start** (see top of README)
2. **Check extraction quality:** `npm run quality:smoke`
3. **Review samples:** `npm run quality:samples`
4. **Adjust configuration** in `.env` if targeting different docs

### Where things stand:
- ✅ **Step 0 — Extraction:** 50 components in [artifacts/raw-json/](artifacts/raw-json/); captures real section headings + prose
- ✅ **Step 1 — Normalization:** 4/7 chunk types, **897 chunks** (code-example 410, prop-reference 374, component-overview 50, capability-reference 63)
- ✅ **Step 2 — Embedding:** 897 points in Qdrant (`chakra-ui-docs`)
- ✅ **Step 3 — Search + Evaluation:** LLM-as-judge harness; authentic prose beats templates
- ✅ **Step 4 — Generation:** grounded v3 TSX + tsc self-heal; ~93% grounded tsc-valid (see [GENERATION_EXPERIMENT.md](GENERATION_EXPERIMENT.md))
- 📋 **Next:** ship a UI over generation ([README_FULLSTACK.md](README_FULLSTACK.md)); then corpus expansion, 3 remaining chunk types, MCP server

### Key Documentation:
- **[CLAUDE.md](CLAUDE.md)** - Project quick facts & contribution guide
- **[docs/NORMALIZATION_TECHNICAL_GUIDE.md](docs/NORMALIZATION_TECHNICAL_GUIDE.md)** - Technical implementation details
- **[docs/NORMALIZATION_USAGE_GUIDE.md](docs/NORMALIZATION_USAGE_GUIDE.md)** - Usage, design decisions, testing
- **[.env.example](.env.example)** - Configuration reference
- **[Documentation](#documentation)** - Full doc index

---

**Status:** ✅ **Steps 0–4 Complete** (extract → normalize → embed → search + eval → spec-driven generation, ~93% grounded tsc-valid) | 📋 **Next: ship a UI over generation ([README_FULLSTACK.md](README_FULLSTACK.md)); then corpus expansion / MCP server**

**Details:**
- Step 0 — Extraction: ✅ 50 components, 100% schema validation; real headings + prose captured
- Step 1 — Normalization: ✅ code-example (410) + prop-reference (374) + component-overview (50) + capability-reference (63) = 897 chunks, 4/7 types
- Step 2 — Embedding: ✅ 897 points in Qdrant (text-embedding-3-small, 1536d)
- Step 3 — Search + Eval: ✅ LLM-as-judge harness; authentic prose > templates (see EVALUATION_STRATEGY.md)
- Step 4 — Generation: ✅ grounded v3 TSX + tsc self-heal; ~93% grounded tsc-valid (see GENERATION_EXPERIMENT.md)
- Tests: ✅ 609 passing across 20 suites

For questions, issues, or feature requests, please open an issue on GitHub.
