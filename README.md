# Design-MCP: Spec-Driven Component Generator

A TypeScript-based documentation crawler and extraction tool designed to systematically gather component specifications from design system documentation (initially targeting Chakra UI) and transform them into structured, machine-readable formats suitable for RAG (Retrieval-Augmented Generation) systems.

## Overview

Design-MCP is a specialized web scraping and data extraction pipeline that:
- Crawls design system documentation websites using Playwright
- Extracts structured component information (props, examples, accessibility notes)
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

**Implemented:**
- ✅ CLI infrastructure with Commander.js
- ✅ Playwright browser automation setup
- ✅ Data schemas (RAGResult, Prop, CodeExample)
- ✅ Text processing utilities (chunking, normalization)
- ✅ Environment-based configuration
- ✅ Docker containerization
- ✅ TypeScript compilation and type safety

**In Progress (Placeholder Implementations):**
- 🚧 Web crawler pagination and link following
- 🚧 Component data extraction logic
- 🚧 CSS selector refinement for Chakra UI
- 🚧 Props table parsing
- 🚧 Code example extraction
- 🚧 Accessibility section parsing

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
  -e START_URL=https://chakra-ui.com/docs/components \
  -e MAX_PAGES=100 \
  design-mcp start
```

## Configuration

Edit `.env` to customize crawler behavior:

```env
# URL of the documentation to start crawling from
START_URL=https://chakra-ui.com/docs/components

# Maximum number of pages to crawl (use -1 for unlimited)
MAX_PAGES=100

# Control the crawling delay between pages (in milliseconds)
CRAWL_DELAY=1000
```

## Usage

### CLI Commands

```bash
# Run in development mode (with ts-node)
npm run dev

# Extract documentation (Step 0)
npm run cli 0-extract-docs

# With CLI options (override .env settings)
npm run cli 0-extract-docs -- -s https://chakra-ui.com/docs/components -m 50

# Build TypeScript for production
npm run build

# Run production build
npm start
```

### Command Options

**`0-extract-docs`** - Crawl and extract component documentation

Options:
- `-s, --start-url <url>` - Starting URL for crawling
- `-m, --max-pages <number>` - Maximum number of pages to crawl

Example:
```bash
npm run cli 0-extract-docs -- --start-url https://chakra-ui.com/docs/components --max-pages 25
```

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

Crawled data is saved to:
```
artifacts/raw-json/crawl-{timestamp}.json
```

Each file contains structured component data validated against the RAGResult schema.

## Development Roadmap

### Phase 1: Core Extraction (Current)
- [x] Project setup and CLI infrastructure
- [ ] Complete web crawler implementation
- [ ] Implement DOM extraction logic
- [ ] Test against Chakra UI documentation
- [ ] Validate data schema with real examples

### Phase 2: Data Transformation
- [ ] Normalize extracted data across formats
- [ ] Implement intelligent text chunking
- [ ] Extract and catalog code examples
- [ ] Handle edge cases and malformed docs

### Phase 3: RAG Integration
- [ ] Generate embeddings for component descriptions
- [ ] Integrate with vector stores (Pinecone/Weaviate/Chroma)
- [ ] Implement semantic search functionality
- [ ] Build retrieval pipeline

### Phase 4: Multi-System Support
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

**ChakraDocsSpider** (`src/steps/0-extract-docs/crawler.ts`)
- Manages Playwright browser lifecycle
- Orchestrates page navigation and data extraction
- Handles output file generation

**Extractors** (`src/steps/0-extract-docs/extractors.ts`)
- CSS selector-based DOM parsing
- Component-specific extraction functions
- Accessibility information gathering

**Text Processor** (`src/utils/textProcessor.ts`)
- Intelligent text chunking with overlap
- Whitespace normalization
- Code block extraction

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

**Status:** 🚧 Under Active Development

For questions, issues, or feature requests, please open an issue on GitHub.
