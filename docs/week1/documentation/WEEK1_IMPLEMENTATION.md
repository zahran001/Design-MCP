# Week 1 Implementation Guide

**Project:** Design-MCP (Spec-Driven Component Generator)
**Phase:** Core Extraction - Chakra UI Documentation Crawler
**Status:** Ready for Implementation
**Last Updated:** 2025-10-15

---

## Table of Contents

1. [Overview](#overview)
2. [Implementation Decisions](#implementation-decisions)
3. [Architecture Changes](#architecture-changes)
4. [Milestone Breakdown](#milestone-breakdown)
5. [Code Organization](#code-organization)
6. [Testing Strategy](#testing-strategy)
7. [Success Criteria](#success-criteria)

---

## Overview

### Goal

Crawl Chakra UI documentation and extract high-quality, structured component data suitable for RAG (Retrieval-Augmented Generation) systems.

### Key Principles

- **Quality over Quantity**: Filter aggressively for high-value examples
- **Resilience**: Handle failures gracefully, log everything
- **Provenance**: Track source URLs and page context
- **Separation of Concerns**: Raw extraction (Week 1) vs. normalization (Week 2)

### Week 1 Deliverables

- JSONL output with validated component docs
- Separate error log (errors.ndjson)
- Optional per-file JSON output for debugging
- High-quality code examples (composition patterns only)
- Deduped props within each page
- Page context metadata for future merging
- **Related components tracking for cross-component queries**

---

## Implementation Decisions

### Decision 1: Code Block Filtering

**Problem:** Not all code blocks are valuable for LLM training. Installation commands, bare imports, and trivial examples add noise.

**Solution:** Multi-layer quality filtering

#### Filter Layers

1. **Section-based exclusion**
   - Skip code blocks in: Installation, Import, Setup, Getting Started, Prerequisites, Migration
   - Detection: Check preceding `<h2>` or `<h3>` heading

2. **Content heuristics**
   - Skip if < 3 lines
   - Skip if only import statements
   - Skip package manager commands (`npm install`, etc.)
   - Skip config files (package.json snippets, etc.)

3. **Composition scoring** (threshold: ≥5 points)
   - JSX/TSX usage: +2 points
   - Multiple props: +2 points
   - Function definition: +3 points
   - Multiple components: +3 points
   - Event handlers: +1 point
   - Hooks (useState, etc.): +2 points
   - Accessibility attributes: +2 points

4. **Semantic deduplication**
   - Normalize: remove comments, collapse whitespace, normalize string literals
   - Filter exact duplicates after normalization

**Rationale:** Ensures embeddings capture **composition patterns** and **real-world usage**, not syntax reference.

**Expected Impact:**
- Before: ~40 code blocks per component
- After: ~8-15 high-quality examples
- LLM benefit: Better few-shot learning, reduced confusion

**Related Components Detection:**
- Extract component tags from code examples (e.g., `<Button>`, `<Input>`)
- Track which components appear together in examples
- Enables cross-component query support (e.g., "form with button and input")
- Feeds Week 2+ chunking strategies

---

### Decision 2: Props Table Parsing

**Problem:** Props tables have inconsistent column ordering and multiple tables per page.

**Solution:** Column-order-agnostic parsing with within-page deduplication

#### Strategy

1. **Detect props tables**
   - Header must contain "prop/name/property" AND "type"
   - Case-insensitive pattern matching

2. **Dynamic column mapping**
   - Parse header row to detect column indices
   - Support: name, type, default, description
   - Don't assume fixed positions

3. **Required prop detection**
   - Check for asterisks (`*`) or "required" text in name/type cells
   - Clean prop name by removing indicators

4. **Within-page deduplication**
   - Merge props with same name from multiple tables
   - Merge strategy:
     - **Type**: Prefer longer string (more specific union types)
     - **Description**: Prefer non-empty, first non-empty wins
     - **Default**: Prefer non-empty
     - **Required**: Logical OR (if either says required → required)

**Rationale:** Chakra UI has multiple props tables per component (main props, theme props, etc.). Need to handle variations while preserving data.

**Note:** Cross-page deduplication (same component on different pages) deferred to Week 2.

---

### ~~Decision 3: Page Context Metadata~~ [SKIPPED - See Exploration Findings]

> **📊 Exploration Finding (2025-10-15):**
> After crawling 7 Chakra UI components (Button, Input, Box, Dialog, Select, Skeleton, Stat), we discovered that **all component documentation is single-page**. There are no separate `/usage`, `/theming`, or `/migration` pages. All content (Usage, Examples, Props) exists as sections with heading IDs on one page (e.g., `https://chakra-ui.com/docs/components/button#usage`).
>
> **Decision:** Skip `pageContext` field for Week 1. All crawled pages are effectively "main" pages.
>
> **Future consideration:** If we encounter multi-page documentation structures (either Chakra UI v4+ or other component libraries), we can add this field in Week 2+ without re-crawling by parsing the existing `sourceUrl` field.
>
> See [docs/week1/CODE_BLOCK_EXPLORATION.md](docs/week1/CODE_BLOCK_EXPLORATION.md) for detailed findings.

---

**Original Plan (Not Implemented):**

~~**Problem:** Components span multiple pages (main, usage, theming, migration). Week 2 merging needs to know page type.~~

~~**Solution:** Detect and tag page context during extraction~~

~~#### Page Types~~

~~- `main`: Primary component documentation~~
~~- `usage`: Advanced examples and patterns~~
~~- `theming`: Customization and styling~~
~~- `migration`: Version upgrade guides~~
~~- `changelog`: Release notes~~

~~#### Detection Heuristics~~

~~1. Check URL path: `/migration`, `/theming`, `/usage`, `/examples`, `/variants`~~
~~2. Check page title for keywords~~
~~3. Default to `main` if no match~~

~~#### Why Add Now (Week 1)?~~

~~1. **Trivial implementation**: 10-line function~~
~~2. **Week 2 benefit**: Enables smart merging rules~~
~~   - Prefer `main` page descriptions~~
~~   - Filter out `migration` code examples (deprecated patterns)~~
~~   - Separate component props from theme props~~
~~3. **Debug visibility**: See page type in logs during crawl~~
~~4. **Future-proof**: Can add filter (`--skip-migration`) without re-crawling~~

~~**Alternative (rejected):** Parse URLs in Week 2~~
~~- Con: Repeated URL parsing, no filtering capability, harder to debug~~

---

### Decision 4: Output Format

**Problem:** Need both machine-readable pipeline format and human-reviewable debug output.

**Solution:** Dual output with JSONL as primary

#### JSONL (Primary - Production Pipeline)

- **Format**: Newline-delimited JSON (`.jsonl`)
- **Behavior**: Append-only, one doc per line
- **Use case**: Streaming to vector store, Week 2 normalization
- **Collision handling**: N/A (append-only, no collisions)

**Example:**
```jsonl
{"componentName":"Button","sourceUrl":"https://.../button","pageContext":"main",...}
{"componentName":"Button","sourceUrl":"https://.../button/usage","pageContext":"usage",...}
{"componentName":"Input","sourceUrl":"https://.../input","pageContext":"main",...}
```

#### Per-File JSON (Optional - Debug/Review)

- **Format**: Individual JSON files (`.json`)
- **Behavior**: Opt-in via `--per-file` flag
- **Naming strategy**: URL-slug prefix to prevent collisions
  - `components_button_Button.json` (main page)
  - `button_usage_Button.json` (usage page)
  - `button_theming_Button.json` (theming page)
- **Use case**: Human review, git diffs, manual inspection

**Collision Handling:**
- URL-slug prefix ensures unique filenames
- Preserves all crawled data (no overwrites)
- Verbose names acceptable for debug output

**Why URL-slug prefix?**
- Prevents silent data loss from overwrites
- Preserves provenance (know which page data came from)
- Alternative (last-write-wins) would lose data

**CLI Usage:**
```bash
# Production: JSONL only
npm run cli -- 0-extract-docs -m 20

# Debug: JSONL + per-file
npm run cli -- 0-extract-docs -m 20 --per-file
```

---

### Decision 5: Error Handling & Logging

**Problem:** Extraction failures should not crash the crawler. Need visibility for debugging selectors.

**Solution:** Three-phase error handling with separate error log

#### Error Phases

1. **Navigation errors**
   - Failed page loads, timeouts, DNS errors
   - Retry: 3 attempts with backoff (0ms, 500ms, 1500ms)
   - No retry on 4xx errors (except 429)
   - Special handling for 429: wait 10s, retry

2. **Extraction errors**
   - No `<main>` element found
   - No component name/description
   - Props table parsing failures
   - Log error, skip page, continue crawl

3. **Validation errors**
   - Schema validation fails (Zod)
   - **Strategy**: Write partial data if useful
   - If doc has description OR codeExamples OR props: write to JSONL + log error
   - If completely empty: skip write, log error

#### Error Log Format

**File:** `out/errors.ndjson`

**Schema:**
```ts
{
  timestamp: string;           // ISO-8601
  url: string;                 // Page that failed
  phase: "navigation" | "extraction" | "validation";
  error: {
    message: string;
    name: string;
    stack?: string;            // Only if DEBUG=true
  };
  context?: {                  // Optional diagnostics
    componentName?: string;
    retriesAttempted?: number;
    partial?: boolean;
    issues?: string[];
  };
}
```

#### Logging Strategy

- **Separate file**: Don't pollute data stream
- **Append-only**: Survives crashes/interruptions
- **Structured**: Machine-readable for analysis
- **Summary**: Print top 5 errors at end of crawl

**Rationale:**
- Can iterate on selectors without re-crawling
- Partial data preserves value (better than nothing)
- Separate log keeps pipeline clean

---

### Decision 6: Crawler Resilience

**Problem:** Network failures, rate limiting, and selector drift should not crash crawl.

**Solution:** Multiple safeguards

#### 1. Randomized Throttling

- **Purpose**: Be polite to Chakra UI servers
- **Implementation**: Random delay between pages
- **Default**: 200-650ms (configurable via env vars)
- **Config:**
  ```env
  CRAWL_THROTTLE_MS_MIN=200
  CRAWL_THROTTLE_MS_MAX=650
  ```

#### 2. Circuit Breaker

- **Purpose**: Safety limit for runaway crawls
- **Trigger**: Stop at 1000 visited pages
- **Behavior**: Log warning, graceful shutdown

#### 3. Retry with Backoff

- **Attempts**: 3 tries per page
- **Backoff**: 0ms → 500ms → 1500ms
- **No retry**: 4xx errors (client errors won't fix themselves)
- **Special case**: 429 rate limit → wait 10s, retry once

#### 4. Enhanced Logging

**Per-page logs:**
```
Visiting (3/20): https://chakra-ui.com/docs/components/button
→ Button
→ detected page context: main
→ found 12 code blocks, kept 5 high-quality examples
→ found props table with 4 columns
→ extracted 18 props, deduped to 15
✓ extracted: Button
⏱ waiting 437ms...
```

**End summary:**
```
╔═══════════════════════════════════════╗
║         Crawl Summary                 ║
╠═══════════════════════════════════════╣
║ Processed:          20 pages          ║
║ Visited:            23 unique         ║
║ Queued remaining:    7                ║
║                                       ║
║ Successful:         17 (85%)          ║
║ Partial:             2 (10%)          ║
║ Failed:              1 (5%)           ║
║                                       ║
║ Duration:         32.4s               ║
╚═══════════════════════════════════════╝

Top Errors:
  2x - Timeout waiting for main
  1x - No props table found
```

---

## Architecture Changes

### New Files

```
src/
├── utils/
│   ├── errorLogger.ts         # NEW: Error logging utilities
│   └── savePerFile.ts          # NEW: Per-file JSON writer
├── schemas/
│   └── RAGResultSchema.ts      # MODIFIED: Add pageContext, codeExamples, props
└── steps/0-extract-docs/
    ├── crawler.ts              # MODIFIED: Add resilience, logging, per-file
    └── extractors.ts           # MODIFIED: Add code/props extraction, pageContext

scripts/
└── validate-output.sh          # NEW: Validation script

out/
├── docs.jsonl                  # Output: Component docs
└── errors.ndjson               # Output: Error log

artifacts/
└── raw-json/                   # Output: Per-file JSON (optional)
    ├── components_button_Button.json
    └── ...
```

### Schema Changes

```ts
// Before
export const ComponentDocSchema = z.object({
  componentName: z.string().min(1),
  sourceUrl: z.string().url(),
  description: z.string().min(1).optional(),
});

// After
export const ComponentDocSchema = z.object({
  componentName: z.string().min(1),
  sourceUrl: z.string().url(),
  description: z.string().min(1).optional(),

  // Cross-component relationship tracking
  relatedComponents: z.array(z.string()).optional(),

  codeExamples: z.array(z.object({
    code: z.string().min(1),
    language: z.string().optional(),
    title: z.string().optional(),
    section: z.string().optional(),
  })).optional(),
  props: z.array(z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    defaultValue: z.string().optional(),
    description: z.string().optional(),
    required: z.boolean().optional(),
  })).optional(),
});

// NOTE: pageContext field removed - see Decision 3 exploration findings
```

### Environment Variables

```env
# Crawling
START_URL=https://chakra-ui.com/docs/components/concepts/overview
MAX_PAGES=20

# Politeness
CRAWL_THROTTLE_MS_MIN=200
CRAWL_THROTTLE_MS_MAX=650

# Output
OUT_JSONL=./out/docs.jsonl
ERRORS_LOG=./out/errors.ndjson

# Debugging
DEBUG=false   # If true, include stack traces in error log
```

---

## Milestone Breakdown

### Milestone A: Foundation Improvements

**Goal:** Make crawler robust and polite

**Tasks:**
1. Add randomized throttling (200-650ms between pages)
2. Add circuit breaker (stop at 1000 pages)
3. Implement retry logic with backoff (0/500/1500ms)
4. Add 429 rate limit detection and handling
5. Enhance logging (per-page + summary)

**Files Modified:**
- `src/steps/0-extract-docs/crawler.ts`

**Success Check:**
- Crawler waits random delay between pages (visible in logs)
- Retries failed navigation up to 3 times
- Stops at 1000 pages if hit
- Prints summary with stats at end

---

### Milestone B: Code Examples Extraction

**Goal:** Extract high-quality composition examples only

**Tasks:**
1. Implement section-based filtering (skip Installation, Import, etc.)
2. Implement content heuristics (skip boilerplate)
3. Implement composition scoring (threshold ≥5)
4. Implement semantic deduplication
5. Extract language from class names
6. Extract title from preceding heading
7. **Detect related components from code examples**
8. Add to schema and doc object

**Files Modified:**
- `src/steps/0-extract-docs/extractors.ts`
- `src/schemas/RAGResultSchema.ts`

**Success Check:**
- Code blocks in Installation/Import sections are skipped
- Only examples with composition patterns are kept
- Duplicates are removed
- Button component has 5-10 examples (not 40)
- Examples include JSX, props, and component composition
- **`relatedComponents` array populated (e.g., FormControl doc includes ["Input", "Button"])**

---

### Milestone C: Props Table Extraction

**Goal:** Parse props tables with varying column orders

**Tasks:**
1. Detect props tables by header patterns
2. Dynamically map column indices (don't assume order)
3. Parse rows into prop objects
4. Detect required props (asterisks, "required" text)
5. Dedupe within page (merge by name, prefer richer data)
6. Add to schema and doc object

**Files Modified:**
- `src/steps/0-extract-docs/extractors.ts`
- `src/schemas/RAGResultSchema.ts`

**Success Check:**
- Props tables with different column orders are parsed
- Required props are detected
- Duplicate props are merged (prefer longer type, non-empty fields)
- Button component has ~15 props
- Type unions are preserved (e.g., `"sm" | "md" | "lg"`)

---

### ~~Milestone D: Page Context Detection~~ [SKIPPED]

> **Skipped based on exploration findings** - Chakra UI uses single-page documentation structure.
> See Decision 3 above for rationale.

~~**Goal:** Tag each doc with page type for Week 2 merging~~

~~**Tasks:**~~
~~1. Implement `detectPageContext()` helper~~
~~2. Add to schema~~
~~3. Tag each doc during extraction~~
~~4. Log page context for visibility~~

~~**Files Modified:**~~
~~- `src/steps/0-extract-docs/extractors.ts`~~
~~- `src/schemas/RAGResultSchema.ts`~~

~~**Success Check:**~~
~~- `/button` tagged as "main"~~
~~- `/button/usage` tagged as "usage"~~
~~- `/button/theming` tagged as "theming"~~
~~- `/button/migration` tagged as "migration"~~
~~- Logs show page context~~

---

### Milestone E: Error Logging

**Goal:** Log all failures to separate file for debugging

**Tasks:**
1. Create `errorLogger.ts` utility
2. Add `CrawlError` schema
3. Log navigation failures
4. Log extraction failures
5. Log validation failures
6. Handle partial data writes
7. Print error summary at end

**Files Created:**
- `src/utils/errorLogger.ts`

**Files Modified:**
- `src/steps/0-extract-docs/crawler.ts`
- `src/schemas/RAGResultSchema.ts`

**Success Check:**
- Navigation errors logged with retry count
- Extraction errors logged with context (title, hasMain)
- Validation errors logged with Zod issues
- Partial docs written if they have any useful data
- `errors.ndjson` file created
- Top 5 errors printed at end

---

### Milestone F: Per-File Output Option

**Goal:** Enable debug output with individual JSON files

**Tasks:**
1. Create `savePerFile.ts` utility
2. Implement URL-slug naming strategy
3. Add `--per-file` CLI option
4. Add `--per-file-dir` CLI option
5. Integrate in crawler (optional write after JSONL)

**Files Created:**
- `src/utils/savePerFile.ts`

**Files Modified:**
- `src/steps/0-extract-docs/crawler.ts`
- `src/index.ts`

**Success Check:**
- `--per-file` flag writes individual JSON files
- Filenames include URL slug (no collisions)
- Files are pretty-printed (2-space indent)
- JSONL is always written (per-file is additive)
- Multiple pages for same component produce separate files

---

## Code Organization

### Utility Functions

#### `src/utils/errorLogger.ts`

**Purpose:** Centralized error logging

**Exports:**
- `initErrorLogger(path: string): Promise<void>`
- `logError(phase, url, error, context?): Promise<void>`

**Usage:**
```ts
await initErrorLogger('./out/errors.ndjson');
await logError('navigation', url, error, { retriesAttempted: 3 });
```

---

#### `src/utils/savePerFile.ts`

**Purpose:** Write individual JSON files with safe naming

**Exports:**
- `savePerFile(doc: ComponentDoc, outputDir?: string): Promise<string>`

**Usage:**
```ts
const filepath = await savePerFile(doc, 'artifacts/raw-json');
console.log(`Saved to ${filepath}`);
```

**Naming Logic:**
- Extract URL slug: last 2 path segments
- Sanitize component name: replace non-alphanumeric with `_`
- Combine: `{slug}_{sanitizedName}.json`

---

### Extractor Functions

#### `src/steps/0-extract-docs/extractors.ts`

**New Exports:**
- ~~`detectPageContext(url, title): PageContext`~~ [SKIPPED - see Milestone D]
- `isInExcludedSection(codeNode, page): Promise<{excluded, section}>`
- `isLowValueCode(code): boolean`
- `getCompositionScore(code): number`
- `dedupeCodeExamples(examples): typeof examples`
- `detectRelatedComponents(componentName, codeExamples): string[]`
- `normalizeCell(text): string`
- `isRequired(nameCell, typeCell): boolean`
- `dedupeProps(props): typeof props`

**Modified Export:**
- `extractComponent(page, url): Promise<ComponentDoc | null>`
  - Now extracts: description, codeExamples, props, relatedComponents

---

### Crawler Functions

#### `src/steps/0-extract-docs/crawler.ts`

**New Functions:**
- `navigateWithRetry(page, url, maxAttempts): Promise<Response | null>`

**Modified Export:**
- `runCrawl(opts): Promise<string[]>`
  - Now accepts: `outPath`, `perFile`, `perFileDir`
  - Now tracks: `successCount`, `partialCount`, `failureCount`, `errorTracker`
  - Now logs: Enhanced per-page logs, summary stats, top errors

---

## Testing Strategy

### Smoke Test

**Purpose:** Verify all features work on small dataset

**Command:**
```bash
npm run cli -- 0-extract-docs -m 5 --per-file
```

**Expected Output:**
- `out/docs.jsonl` (5 lines)
- `out/errors.ndjson` (errors if any)
- `artifacts/raw-json/` (5+ files with URL-slug names)
- Console: Summary with stats

**Validation:**
- All JSONL lines parse as valid JSON
- All docs have `componentName`, `sourceUrl`, `pageContext`
- At least one doc has `codeExamples`
- At least one doc has `props`

---

### Validation Script

**File:** `scripts/validate-output.sh`

**Features:**
- Parse all JSONL lines (validate JSON syntax)
- Check required fields (`componentName`, `sourceUrl`, `pageContext`)
- Count docs with `description`, `codeExamples`, `props`
- Calculate coverage percentage
- Fail if coverage < 70%

**Usage:**
```bash
chmod +x scripts/validate-output.sh
./scripts/validate-output.sh
```

**Expected Output:**
```
Validating JSONL output...
✓ All lines are valid JSON
✓ Total components: 20
✓ All docs have required fields
✓ Descriptions: 18/20
✓ Code examples: 15/20
✓ Props: 16/20
✓ Quality coverage: 81%
```

---

### Full Crawl Test

**Purpose:** Test at scale, verify quality thresholds

**Command:**
```bash
npm run cli -- 0-extract-docs -m 25
./scripts/validate-output.sh
```

**Success Criteria:**
- ≥70% coverage (description OR codeExamples OR props)
- ≥80% successful extractions (not partial/failed)
- Average 5-15 code examples per component (not 40+)
- Average 10-20 props per component
- No crashes or hangs
- Errors logged to `errors.ndjson`

---

## Success Criteria

### Functional Requirements

- ✅ Crawl completes without crashing
- ✅ JSONL output validates against schema
- ✅ Error log captures all failures
- ✅ Partial data preserved when useful
- ✅ No silent data loss

### Quality Requirements

- ✅ ≥70% of docs have description OR codeExamples OR props
- ✅ Code examples show composition (not boilerplate)
- ✅ Props tables parsed correctly (all column orders)
- ✅ Duplicates removed (code examples, props)
- ✅ Page context tagged correctly

### Performance Requirements

- ✅ Polite crawling (200-650ms delays)
- ✅ Retry failures (up to 3 attempts)
- ✅ Handle rate limiting (429 → wait 10s)
- ✅ Circuit breaker prevents runaway (1000 page limit)

### Developer Experience

- ✅ Clear logs (per-page progress + summary)
- ✅ Error summary (top 5 errors at end)
- ✅ Validation script (quick quality check)
- ✅ Per-file output (optional, for debugging)
- ✅ Configurable via env vars + CLI flags

---

## Implementation Checklist

### Schema & Types

- [ ] ~~Update `ComponentDocSchema` with `pageContext`~~ [SKIPPED]
- [ ] Add `relatedComponents` array to schema
- [ ] Add `codeExamples` array to schema
- [ ] Add `props` array to schema
- [ ] Create `CrawlError` schema
- [ ] Export TypeScript types

### Utilities

- [ ] Create `src/utils/errorLogger.ts`
  - [ ] `initErrorLogger()`
  - [ ] `logError()`
- [ ] Create `src/utils/savePerFile.ts`
  - [ ] `savePerFile()`
  - [ ] URL slug extraction
  - [ ] Filename sanitization

### Extractors

- [ ] ~~Implement `detectPageContext()`~~ [SKIPPED]
- [ ] Implement `isInExcludedSection()`
- [ ] Implement `isLowValueCode()`
- [ ] Implement `getCompositionScore()`
- [ ] Implement `dedupeCodeExamples()`
- [ ] Implement `detectRelatedComponents()`
- [ ] Implement code examples extraction loop
- [ ] Implement `normalizeCell()`
- [ ] Implement `isRequired()`
- [ ] Implement `dedupeProps()`
- [ ] Implement props table detection
- [ ] Implement props table parsing loop
- [ ] Update `extractComponent()` to return all new fields (codeExamples, props, relatedComponents)

### Crawler

- [ ] Implement `navigateWithRetry()`
- [ ] Add randomized throttling
- [ ] Add circuit breaker
- [ ] Add 429 detection and handling
- [ ] Add success/partial/failure tracking
- [ ] Add error tracker map
- [ ] Integrate `logError()` calls
- [ ] Add per-page enhanced logging
- [ ] Add summary logging
- [ ] Add per-file output option
- [ ] Handle partial data writes

### CLI

- [ ] Add `--per-file` flag
- [ ] Add `--per-file-dir` option
- [ ] Pass options to `runCrawl()`

### Configuration

- [ ] Update `.env.example` with all new vars
- [ ] Document all env vars

### Testing

- [ ] Create `scripts/validate-output.sh`
- [ ] Run smoke test (5 pages)
- [ ] Run validation script
- [ ] Run full crawl test (20+ pages)
- [ ] Verify quality coverage ≥70%
- [ ] Verify error logging works
- [ ] Verify per-file output works

---

## Next Steps After Week 1

### Week 2 Preview: Normalization & Indexing

1. **Cross-page merging**
   - Merge docs with same `componentName`
   - Use `pageContext` to prioritize data sources
   - Filter migration examples
   - **Use `relatedComponents` for metadata filtering in vector search**

2. **Metadata enrichment**
   - Add `capturedAt` timestamp
   - Add `crawlVersion` for schema migrations
   - Add `componentSlug` for routing

3. **Text processing**
   - Semantic chunking for long descriptions
   - Code example normalization
   - Dedupe across pages

4. **Chunking strategy decision**
   - **Option 1**: Chunk per component (simpler, use `relatedComponents` for cross-component queries)
   - **Option 2**: Chunk per code example (better composition, more chunks)
   - **Recommendation**: Start with Option 1, add Option 2 if cross-component accuracy <70%

5. **Output formats**
   - NDJSON shards by component
   - One file per canonical component
   - Embedding-ready format with metadata

---

## Questions Before Implementation?

This document captures all decisions, rationale, and implementation details for Week 1. Review this thoroughly before starting to code.

**Key areas to clarify:**
- File structure (where each function goes)
- Edge cases (what if X happens?)
- Testing approach (manual vs automated)
- Debugging strategy (how to troubleshoot issues)

Once you're confident with this plan, implementation can proceed milestone by milestone, with each milestone being independently testable.
