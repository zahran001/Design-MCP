# Design-MCP: Spec-Driven Component Generator

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

✅ Step 1: Normalize & Transform (PARTIAL - CodeExampleChunk Complete)
├── Code analysis & pattern detection
├── Intent classification & section inference
├── Natural language generation
└── Normalized chunk output (387 chunks from 50 components)

📋 Step 2: Embed & Vector Store (NEXT - POC MVP Target)
├── Embedding generation
├── Vector store integration
└── Batch ingestion

📋 Step 3: Search & Retrieval (PLANNED)
├── Vector similarity search
├── Metadata filtering
└── Query interface
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

**📊 Extraction Quality (49 Chakra UI components):**
- Schema validation: 100% (49/49 files)
- Description coverage: 100% (49/49 components)
- Code examples: High coverage (400+ total examples)
- Props extraction: 588 total props extracted
  - Avg 14.0 props per component (for components with props tables)
  - Pattern detection: Handles simple, composite, and no-props patterns
  - Dot notation for composite components (e.g., "Root.collection")
- Avg 7.1 code examples per component (filtered from ~40 raw blocks)

**✅ Week 2 Phase 2A Complete - CodeExampleChunk Transformer:**
- ✅ Advanced normalization schemas (7 chunk types defined)
- ✅ **CodeExampleChunk transformer fully implemented** (1/7 chunk types)
- ✅ Inference engine (code analyzer, section inferrer, intent classifier)
- ✅ Natural language generation (template-based explanation generator)
- ✅ Configuration system (categories, patterns, transformer config)
- ✅ Error handling & fallback generation
- ✅ Metrics tracking & logging (JSONL format)
- ✅ **470 tests passing** across 15 test suites
- ✅ **387 normalized chunks** created from 50 components

**🎯 Next: Week 2 Phase 2B - Vector DB POC (MVP):**
- Embedding generation for CodeExampleChunk
- Vector store integration (Qdrant)
- Basic search implementation
- POC validation with real queries
- **After POC:** Decide which additional chunk types to implement based on retrieval results

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
│   │       │   └── transformer.config.ts      # Transformer behavior settings
│   │       ├── inference/                     # Inference engine
│   │       │   ├── codeAnalyzer.ts            # Extract imports, props, hooks
│   │       │   ├── sectionInferrer.ts         # Detect semantic section titles
│   │       │   ├── intentClassifier.ts        # Classify intent (6 types)
│   │       │   └── patternMatchers.ts         # Pattern matching utilities
│   │       ├── generators/                    # Content generation
│   │       │   ├── templateDataExtractor.ts   # Extract data for templates
│   │       │   └── explanationGenerator.ts    # Generate natural language
│   │       ├── transformers/                  # Chunk transformers
│   │       │   └── codeExampleTransformer.ts  # ✅ CodeExampleChunk (complete)
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
│   ├── raw-json/                              # ✅ 49 extracted component files
│   ├── normalized/                            # ✅ 50 normalized files (387 chunks)
│   ├── metrics/                               # ✅ Transformation metrics (JSONL)
│   └── logs/                                  # ✅ Error logs
├── docs/                                       # 📂 ARCHIVED (historical documentation)
│   ├── week1/                                 # Week 1 implementation docs
│   └── week2/                                 # Week 2 phase docs (archived)
├── scripts/                                    # Build & utility scripts
├── .env.example                               # Environment configuration template
├── Dockerfile                                 # Multi-stage Docker build
├── package.json                               # Dependencies & scripts
├── tsconfig.json                              # TypeScript configuration
├── CLAUDE.md                                  # Project quick facts & contribution guide
├── NORMALIZATION_TECHNICAL_GUIDE.md           # Technical implementation details
└── NORMALIZATION_USAGE_GUIDE.md               # Usage, design decisions, testing
```

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

**Future commands** (not yet implemented):
- `2-embed [component]` - Generate embeddings for vector search
- `3-search "query"` - Search normalized chunks

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

### ✅ Week 2 Phase 2A Complete: CodeExampleChunk Normalization

**Phase 2A: CodeExampleChunk Transformer (Complete)**
- [x] Advanced chunk schema definition (7 types defined, 1 implemented)
- [x] Chunk ID generation utilities
- [x] Inference engine (code analyzer, section inferrer, intent classifier)
- [x] Natural language generation (template-based)
- [x] Transformation pipeline (raw JSON → CodeExampleChunk)
- [x] Configuration system (categories, patterns, behavior)
- [x] Error handling & fallback generation
- [x] Metrics tracking & JSONL logging
- [x] **470 tests passing** across 15 test suites
- [x] **387 normalized chunks** from 50 components

**📋 Phase 2B: Vector DB POC (NEXT - MVP Target)**
- [ ] Embedding generation for CodeExampleChunk
- [ ] Vector store integration (Qdrant)
- [ ] Basic vector search implementation
- [ ] Query interface (CLI)
- [ ] POC validation with real queries

**🔮 Future (Post-POC):**
- [ ] Evaluate retrieval quality
- [ ] Decide which additional chunk types to implement
- [ ] Extend normalization to selected chunk types
- [ ] LLM re-ranking (if needed)

**📖 Technical Documentation:**
- [NORMALIZATION_TECHNICAL_GUIDE.md](NORMALIZATION_TECHNICAL_GUIDE.md) - Implementation deep-dive
- [NORMALIZATION_USAGE_GUIDE.md](NORMALIZATION_USAGE_GUIDE.md) - Usage & design decisions

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
- **Transformer**: CodeExampleChunk fully implemented (1/7 chunk types)
- **Inference Engine**: Code analyzer, section inferrer, intent classifier
- **Content Generation**: Template-based explanation generator
- **Configuration**: External JSON configs for categories, patterns, behavior
- **Error Handling**: Graceful fallbacks, detailed logging
- **Metrics**: JSONL-based transformation tracking

**Normalization Schemas** ([src/schemas/NormalizedChunkSchema.ts](src/schemas/NormalizedChunkSchema.ts))
- 7 specialized chunk types defined (CodeExampleChunk implemented)
- Dual content strategy (embedding-optimized + API reference)
- Type-safe with Zod validation

**Chunk ID Generation** ([src/utils/chunkId.ts](src/utils/chunkId.ts))
- Stable, semantic ID generation
- Versioning support
- Sequential fallback for non-semantic cases

**Quality Assurance**
- 470 passing tests across 15 test suites
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

### If continuing from Week 2 Phase 2A:
- ✅ **Step 0: Extraction is complete!** (49 components in [artifacts/raw-json/](artifacts/raw-json/))
- ✅ **Step 1: Normalization is complete!** (CodeExampleChunk transformer - 387 chunks created)
- 📋 **Next: Step 2 - Vector DB POC** (Embedding + search with CodeExampleChunk)
- 🎯 **Goal:** Validate retrieval quality before building more chunk types

### Key Documentation:
- **[CLAUDE.md](CLAUDE.md)** - Project quick facts & contribution guide
- **[NORMALIZATION_TECHNICAL_GUIDE.md](NORMALIZATION_TECHNICAL_GUIDE.md)** - Technical implementation details
- **[NORMALIZATION_USAGE_GUIDE.md](NORMALIZATION_USAGE_GUIDE.md)** - Usage, design decisions, testing
- **[.env.example](.env.example)** - Configuration reference
- **[docs/](docs/)** - Archived historical documentation

---

**Status:** ✅ **Step 0 Complete** | ✅ **Step 1 Partial (1/7 chunk types)** | 📋 **Next: Step 2 POC (Embedding + Search)**

For questions, issues, or feature requests, please open an issue on GitHub.
