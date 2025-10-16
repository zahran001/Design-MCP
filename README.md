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
Step 0: Extract Documentation
├── Crawling (Playwright-based web automation)
├── Extraction (CSS selectors & DOM parsing)
└── Storage (JSON artifacts)

Future Steps:
├── Step 1: Transform & Normalize
├── Step 2: Chunk & Embed
└── Step 3: Vector Store Integration
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
- Code examples: 96% (48/50 components, 355 total examples)
- Avg 7.1 code examples per component (filtered from ~40 raw blocks)

**🎯 Ready for Week 2:**
- Data normalization and cross-page merging
- Text chunking for embeddings
- Vector store integration

## Project Structure

```
Design-MCP/
├── src/
│   ├── index.ts                      # CLI entry point
│   ├── schemas/
│   │   └── RAGResultSchema.ts        # Zod schemas for validation
│   ├── steps/
│   │   └── 0-extract-docs/
│   │       ├── crawler.ts            # Main spider class
│   │       └── extractors.ts         # DOM extraction functions
│   └── utils/
│       └── textProcessor.ts          # Text chunking & normalization
├── artifacts/
│   └── raw-json/                     # Crawled data output
├── stores/                            # Future: vector store data
├── .env.example                      # Environment configuration template
├── Dockerfile                        # Multi-stage Docker build
├── package.json                      # Dependencies & scripts
└── tsconfig.json                     # TypeScript configuration
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

# Extract documentation (Step 0) - uses settings from .env
npm run cli -- 0-extract-docs

# With CLI options (override .env settings)
npm run cli -- 0-extract-docs -s https://chakra-ui.com/docs/components/concepts/overview -m 50

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
npm run cli 0-extract-docs -- --start-url https://chakra-ui.com/docs/components/concepts/overview --max-pages 25
```

### Quality Evaluation Commands

After extraction, validate the quality of extracted content:

```bash
# Run automated smoke test (pass/fail check)
npm run quality:smoke

# View random samples for manual review
npm run quality:samples

# Run both smoke test and sample viewer
npm run quality:all

# View custom number of samples (e.g., 5)
npx tsx src/steps/0-extract-docs/sample-viewer.ts 5
```

**Quality criteria:**
- ✅ Schema validation ≥95%
- ✅ Description coverage ≥80%
- ✅ Code examples coverage ≥70%

See [Quality Evaluation Guide](docs/QUALITY_EVALUATION.md) for details.

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

### ✅ Phase 1: Core Extraction (COMPLETE)
- [x] Project setup and CLI infrastructure
- [x] Complete web crawler implementation
- [x] Implement DOM extraction logic
- [x] High-quality code filtering (composition patterns)
- [x] Props table parsing (column-order agnostic)
- [x] Related components detection
- [x] Test against Chakra UI documentation (50 components)
- [x] Validate data schema with real examples (100% pass rate)
- [x] Quality validation suite

**📂 View Results:** See [artifacts/raw-json/](artifacts/raw-json/) for extracted data

### Phase 2: Data Transformation (Week 2)
- [ ] Normalize extracted data across formats
- [ ] Implement intelligent text chunking
- [ ] Cross-page deduplication and merging
- [ ] Handle edge cases and malformed docs
- [ ] Prepare data for embedding generation

### Phase 3: RAG Integration (Week 3+)
- [ ] Generate embeddings for component descriptions
- [ ] Integrate with vector stores (Pinecone/Weaviate/Chroma)
- [ ] Implement semantic search functionality
- [ ] Build retrieval pipeline
- [ ] Test cross-component queries using relatedComponents

### Phase 4: Multi-System Support (Future)
- [ ] Extend to other design systems (Material-UI, Ant Design, etc.)
- [ ] Create adapters for different documentation formats
- [ ] Implement configurable extraction rules
- [ ] Support custom component libraries

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

**Quality Validation** ([src/steps/0-extract-docs/smoke-test.ts](src/steps/0-extract-docs/smoke-test.ts))
- Schema validation (Zod)
- Coverage metrics (descriptions, code examples)
- Pass/fail criteria enforcement
- Automated quality gates

**Sample Viewer** ([src/steps/0-extract-docs/sample-viewer.ts](src/steps/0-extract-docs/sample-viewer.ts))
- Random sampling for manual review
- Formatted output for human inspection
- Quality verification workflow

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

### If continuing from Week 1:
- ✅ **Week 1 is complete!** (Core extraction pipeline)
- 📂 **Your data:** 50 components extracted in [artifacts/raw-json/](artifacts/raw-json/)
- 📋 **Implementation details:** See [WEEK1_IMPLEMENTATION.md](WEEK1_IMPLEMENTATION.md)
- 🎯 **Next phase:** Data normalization and chunking (see [CLAUDE.md](CLAUDE.md) for guidance)

### Key Documentation:
- **[CLAUDE.md](CLAUDE.md)** - Project quick facts, commands, and contribution guide (for LLM assistance)
- **[WEEK1_IMPLEMENTATION.md](WEEK1_IMPLEMENTATION.md)** - Detailed implementation plan and decisions
- **[.env.example](.env.example)** - Configuration reference

---

**Status:** ✅ **Week 1 Complete** | 🎯 Ready for Week 2 (Data Normalization)

For questions, issues, or feature requests, please open an issue on GitHub.
