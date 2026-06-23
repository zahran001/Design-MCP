// =============================================================================
// Week 1 Extractors - Component Documentation
// =============================================================================
// Updated: 2025-10-21 (Refactored - Phase 2)
// Reference: docs/REFACTORING_GUIDE.md
//
// This file contains extraction orchestration for Chakra UI component documentation.
// Implements Milestone B (Code Examples) and Milestone C (Props Tables).
//
// REFACTORING (2025-10-21):
// Pure utilities extracted to separate modules for better testability:
//   - utils/textProcessors.ts  → Text cleaning, normalization, JSX parsing
//   - utils/codeAnalysis.ts    → Scoring, filtering, classification
//   - utils/importParser.ts    → Import pattern extraction
//   - utils/arrayUtils.ts      → Deduplication, relationship detection
//
// This file now focuses on:
//   - Playwright DOM interaction
//   - Orchestration of extraction pipeline
//   - Public API (extractComponent)
//
// ARCHITECTURE:
//   Batch 1-3: EXTRACTED to utils/ (pure functions, testable without browser)
//   Batch 4: Playwright Interaction (kept here - requires browser)
//   Batch 5: Main Extraction (orchestration)
//   Batch 6: Integration (public API)
//
// QUALITY STRATEGY (Updated 2025-10-21):
// Multi-stage classification (NO filtering by score):
//   - Section filtering: Skip installation/import sections
//   - Content heuristics: Skip package.json, bare imports, install commands
//   - Composition scoring: CLASSIFY all examples (trivial/basic/intermediate/advanced)
//   - Deduplication: Remove semantically identical code blocks
//
// =============================================================================

import type { Page } from 'playwright';
import type { ComponentDoc, CodeExample, Prop, ImportPattern } from '../../schemas/RAGResultSchema.js';

// Import pure utility modules (Phase 2 refactoring)
import { cleanHeadingText, normalizeCode, extractComponentTags } from './utils/textProcessors.js';
import { getCompositionScore, isInExcludedSection, isLowValueCode } from './utils/codeAnalysis.js';
import { extractImports } from './utils/importParser.js';
import { dedupeCodeExamples, detectRelatedComponents, dedupeImportPatterns } from './utils/arrayUtils.js';

// Enable debug logging (set to false in production)
// Usage: DEBUG=true npm run cli -- 0-extract-docs
const DEBUG = process.env.DEBUG === 'true';

/**
 * Internal debug logger - only logs when DEBUG=true
 * Helps trace execution flow when troubleshooting extraction issues
 */
function log(...args: any[]) {
  if (DEBUG) console.log('[extractors]', ...args);
}

// =============================================================================
// Batch 1-3: EXTRACTED TO UTILS/ (2025-10-21)
// =============================================================================
// Pure functions moved to separate modules for better testability:
//   - utils/textProcessors.ts  → cleanHeadingText, normalizeCode, extractComponentTags
//   - utils/codeAnalysis.ts    → getCompositionScore, isInExcludedSection, isLowValueCode
//   - utils/importParser.ts    → extractImports
//   - utils/arrayUtils.ts      → dedupeCodeExamples, detectRelatedComponents, dedupeImportPatterns
//
// These functions are now imported at the top of this file.
// =============================================================================

// =============================================================================
// Batch 4: Playwright Interaction (KEPT HERE - requires browser)
// =============================================================================

// =============================================================================
// Batch 4: Playwright Interaction
// =============================================================================

/** Per-code-block section context, aligned to `main pre` document order. */
interface SectionContext {
  section: string;            // cleaned heading text (e.g. "Sizes")
  sectionId: string;          // heading anchor id (e.g. "sizes")
  sectionDescription: string; // intro prose beneath the heading, if any
}

/**
 * Reveal demo code that Chakra v3 hides behind tabs.
 *
 * WHY (Phase 3, empirically verified 2026-06-22): each interactive demo on a
 * Chakra v3 component page is a Preview / Code / Stackblitz tab widget. The
 * `<pre><code>` for the demo lives in the *Code* tabpanel, which is NOT mounted
 * in the DOM until that tab is activated. On the Button page only 10 of 27 code
 * blocks are present on load; clicking every "Code" tab raises it to 27. Without
 * this step a re-crawl SILENTLY DROPS the demo examples (Sizes, Variants, ...).
 *
 * Resilient by design: clicks are best-effort (short timeout, errors swallowed);
 * a demo whose tab fails to open simply yields no code block, exactly as today.
 */
async function revealCodeTabs(page: Page): Promise<void> {
  const codeTabs = page.locator('main [role="tab"]', { hasText: /^Code$/ });
  const count = await codeTabs.count();
  log(`revealCodeTabs - found ${count} Code tabs to activate`);

  for (let i = 0; i < count; i++) {
    try {
      await codeTabs.nth(i).click({ timeout: 2000 });
    } catch {
      // Overlapping/offscreen tabs may not be clickable; degrade gracefully.
    }
  }

  if (count > 0) {
    // Let the newly-activated tabpanels mount their <pre> before extraction.
    await page.waitForTimeout(400);
  }
}

/**
 * Compute section context for every `<pre>` in `<main>`, in document order.
 *
 * Replaces the old sibling/parent heading walk, which failed because Chakra v3
 * nests demo code far from its heading. Instead we make ONE document-order pass
 * over `<main>` (a TreeWalker visits nodes in document order regardless of
 * nesting depth) and, for each code block, attribute:
 *   - section / sectionId: the most recent preceding heading, and
 *   - sectionDescription: the intro paragraph(s) since that heading (or since
 *     the previous code block under the same heading).
 *
 * Preview-panel noise (e.g. the color-swatch labels "gray, red, ...", rendered
 * INSIDE a [role="tabpanel"]) is excluded, so only real authored prose counts.
 *
 * The returned array is index-aligned with `main.locator('pre')`, because both
 * enumerate `<pre>` in the same document order. Call AFTER revealCodeTabs().
 */
async function computeSectionContexts(page: Page): Promise<SectionContext[]> {
  const raw = await page.locator('main').evaluate((main) => {
    const out: Array<{ section: string; sectionId: string; description: string }> = [];
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_ELEMENT);

    let currentHeading = '';
    let currentHeadingId = '';
    let proseBuffer: string[] = [];

    let node = walker.currentNode as Element | null;
    while (node) {
      const tag = node.tagName.toLowerCase();

      if (/^h[1-6]$/.test(tag)) {
        currentHeading = (node.textContent || '').replace(/\s+/g, ' ').trim();
        currentHeadingId = (node as HTMLElement).id || '';
        proseBuffer = [];
      } else if (tag === 'p') {
        // Only count intro prose that lives OUTSIDE the demo tab widgets;
        // paragraphs inside a tabpanel are rendered preview content, not docs.
        if (!node.closest('[role="tabpanel"]')) {
          const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
          if (text) proseBuffer.push(text);
        }
      } else if (tag === 'pre') {
        out.push({
          section: currentHeading,
          sectionId: currentHeadingId,
          description: proseBuffer.join(' ').trim(),
        });
        // Clear so a second demo under the same heading doesn't re-claim the
        // first demo's intro prose.
        proseBuffer = [];
      }

      node = walker.nextNode() as Element | null;
    }
    return out;
  });

  return raw.map((r) => ({
    section: cleanHeadingText(r.section),
    sectionId: r.sectionId,
    sectionDescription: r.description,
  }));
}

// =============================================================================
// Batch 5: Main Extraction
// =============================================================================

/**
 * Extract all code examples from the page with quality filtering
 *
 * PURPOSE: Main orchestrator that combines all extraction logic from Batches 1-4
 *
 * UPDATED (2025-10-21): Now classifies ALL examples instead of filtering by score
 *
 * EXECUTION FLOW:
 *   1. Find all <pre> elements in <main> (Chakra's code block container)
 *   2. For each code block:
 *      a. Extract code text from nested <code> element
 *      b. Find preceding heading using findPrecedingHeading()
 *      c. Extract imports (ALWAYS, even if code will be filtered)
 *      d. Apply 2-stage filtering pipeline (see below)
 *      e. Classify by composition score and complexity
 *      f. Extract language from class attribute (e.g., "language-tsx")
 *      g. Build CodeExample object with code, score, complexity, language, section
 *   3. Deduplicate examples using normalizeCode()
 *   4. Deduplicate import patterns by source+type
 *   5. Return classified examples + import patterns
 *
 * FILTERING PIPELINE (in order):
 *   Stage 1: Section-based filtering
 *            Skip if section is "Installation", "Import", "Setup", etc.
 *            (see isInExcludedSection)
 *
 *   Stage 2: Content heuristics
 *            Skip if code is:
 *            - Too short (< 3 lines)
 *            - Installation commands (npm install, yarn add)
 *            - Bare imports
 *            - package.json or config file snippets
 *            (see isLowValueCode)
 *
 *   Stage 3: Composition scoring (CLASSIFICATION ONLY - NO FILTERING)
 *            ALL examples are kept and classified by complexity:
 *            - trivial (score 0-2): Simple JSX, shows API patterns like <Button variant="primary">
 *            - basic (score 3-6): Props + functions
 *            - intermediate (score 7-10): Hooks + events
 *            - advanced (score 11+): Full composition
 *            (see getCompositionScore for scoring rubric)
 *
 * METRICS: Tracks counts for debugging:
 *   - excluded: Filtered by section
 *   - lowValue: Filtered by content heuristics
 *   - accepted: Passed all filters (includes ALL complexity levels)
 *
 * RETURN: Object containing:
 *   - examples: Deduplicated code examples with score + complexity metadata
 *   - importPatterns: Imports from accepted examples only
 *   - allImportPatterns: Imports from ALL blocks (including filtered)
 */
async function extractCodeExamples(page: Page): Promise<{
  examples: CodeExample[];
  importPatterns: ImportPattern[];
  allImportPatterns: ImportPattern[];
}> {
  log('extractCodeExamples - starting extraction...');

  // Phase 3: materialize demo code hidden behind Chakra v3 "Code" tabs, THEN
  // compute each block's heading + intro prose from a single document-order pass.
  await revealCodeTabs(page);

  const main = page.locator('main');
  const codeBlocks = main.locator('pre');
  const count = await codeBlocks.count();

  // Index-aligned with codeBlocks (both enumerate `main pre` in document order).
  const sectionContexts = await computeSectionContexts(page);

  log('extractCodeExamples - found', count, 'code blocks');

  const examples: CodeExample[] = [];
  const allImports: ImportPattern[] = [];      // From ALL blocks
  const acceptedImports: ImportPattern[] = []; // From accepted blocks only

  let filtered = {
    excluded: 0,   // Rejected due to section (Installation, Import, etc.)
    lowValue: 0,   // Rejected due to content heuristics
    accepted: 0,   // Passed all filters (including trivial examples)
  };

  for (let i = 0; i < count; i++) {
    const block = codeBlocks.nth(i);

    // Get code text
    const codeElement = block.locator('code').first();
    const code = (await codeElement.textContent())?.trim() || '';

    if (!code) {
      log(`extractCodeExamples - block ${i + 1}: empty code, skipping`);
      continue;
    }

    log(`extractCodeExamples - block ${i + 1}: ${code.split('\n').length} lines`);

    // Section context from the document-order map (heading + intro prose)
    const ctx = sectionContexts[i] ?? { section: '', sectionId: '', sectionDescription: '' };
    const section = ctx.section;
    const found = section.length > 0;

    // ALWAYS extract imports (even if code will be filtered)
    const importsInBlock = extractImports(code, section);
    if (importsInBlock.length > 0) {
      allImports.push(...importsInBlock);
      log(`extractCodeExamples - block ${i + 1}: extracted ${importsInBlock.length} import patterns`);
    }

    // Section-based filtering
    if (found && isInExcludedSection(section)) {
      log(`extractCodeExamples - block ${i + 1}: FILTERED (excluded section: "${section}")`);
      filtered.excluded++;
      continue;
    }

    // Content heuristics filtering
    if (isLowValueCode(code)) {
      log(`extractCodeExamples - block ${i + 1}: FILTERED (low-value content)`);
      filtered.lowValue++;
      continue;
    }

    // Composition scoring (CHANGED: classify instead of filter)
    const scoreResult = getCompositionScore(code);

    // REMOVED: if (score < 5) continue;
    // All examples now kept, just classified by complexity

    // CODE ACCEPTED - track imports from this block separately
    if (importsInBlock.length > 0) {
      acceptedImports.push(...importsInBlock);
    }

    // Extract language from class attribute if present
    const language = await codeElement.evaluate((el) => {
      const classes = el.className || '';
      const match = classes.match(/language-(\w+)/);
      return match ? match[1] : undefined;
    });

    // Build code example object with NEW classification fields
    const example: CodeExample = {
      code,
      score: scoreResult.score,              // NEW
      complexity: scoreResult.complexity,    // NEW
    };

    if (language) {
      example.language = language;
      log(`extractCodeExamples - block ${i + 1}: detected language: ${language}`);
    }
    if (section) {
      example.section = section;
      // Heading also seeds the embedding `Title:` anchor downstream.
      example.title = section;
    }
    if (ctx.sectionId) {
      example.sectionId = ctx.sectionId;
    }
    if (ctx.sectionDescription) {
      example.sectionDescription = ctx.sectionDescription;
      log(`extractCodeExamples - block ${i + 1}: prose (${ctx.sectionDescription.length} chars)`);
    }

    examples.push(example);
    filtered.accepted++;
    log(`extractCodeExamples - block ${i + 1}: ACCEPTED (score ${scoreResult.score}, complexity: ${scoreResult.complexity})`);
  }

  log('extractCodeExamples - filtering summary:', filtered);

  // Deduplicate examples
  const dedupedExamples = dedupeCodeExamples(examples);

  // Deduplicate import patterns (separate for accepted vs all)
  const dedupedAcceptedImports = dedupeImportPatterns(acceptedImports);
  const dedupedAllImports = dedupeImportPatterns(allImports);

  log('extractCodeExamples - complete:', {
    examples: dedupedExamples.length,
    acceptedImports: dedupedAcceptedImports.length,
    allImports: dedupedAllImports.length,
  });

  return {
    examples: dedupedExamples,
    importPatterns: dedupedAcceptedImports,
    allImportPatterns: dedupedAllImports,
  };
}

// =============================================================================
// Batch 5.5: Props Extraction (Milestone C)
// =============================================================================

/**
 * Extract props from a Chakra UI component page
 *
 * PURPOSE: Parse props tables from Chakra UI documentation pages
 *
 * CHAKRA UI PROPS PATTERNS:
 *   Pattern 1: No props section → return []
 *   Pattern 2: Simple props (h2#props → table) → single props table
 *   Pattern 3: Composite props (h2#props → h3 → table) → multiple tables with subcomponents
 *
 * COLUMN ORDER (Fixed in Chakra UI):
 *   - Column 0: Prop (name)
 *   - Column 1: Default (default value)
 *   - Column 2: Type (may include description)
 *
 * COMPOSITE COMPONENTS:
 *   For components like Combobox with Root, Item, etc.:
 *   - Each h3 subheading represents a subcomponent
 *   - Props are named with dot notation: "Root.collection", "Item.item"
 *
 * EXECUTION FLOW:
 *   1. Find h2#props heading
 *   2. Check for h3 subheadings (determines pattern)
 *   3. If h3 exists → Pattern 3 (composite)
 *   4. Otherwise → Pattern 2 (simple)
 *   5. Extract tables using flexible selectors (handles div wrapping)
 *   6. Parse rows using fixed column indices
 *
 * RETURN: Array of Prop objects (empty if no props found)
 */
async function extractProps(page: Page): Promise<Prop[]> {
  log('extractProps - starting extraction...');

  // Pattern 1: Check if props section exists
  const propsHeading = page.locator('h2#props').first();
  if (!(await propsHeading.count())) {
    log('extractProps - no props heading found (Pattern 1)');
    return [];
  }

  log('extractProps - props heading found, checking for subheadings...');

  // Determine pattern: Check for h3 subheadings
  const subheadings = await propsHeading.locator('~ h3').all();

  if (subheadings.length > 0) {
    // Pattern 3: Composite props (multiple tables with subcomponents)
    log('extractProps - Pattern 3 detected (composite), subheadings:', subheadings.length);
    return await extractCompositeProps(page, subheadings);
  } else {
    // Pattern 2: Simple props (single table)
    log('extractProps - Pattern 2 detected (simple)');
    return await extractSimpleProps(page, propsHeading);
  }
}

/**
 * Extract props from a simple table (Pattern 2)
 *
 * STRUCTURE: h2#props → (optional div) → table
 *
 * Uses flexible selector to handle both:
 *   - Direct sibling: h2#props → table
 *   - Div-wrapped: h2#props → div → table
 */
async function extractSimpleProps(
  page: Page,
  propsHeading: ReturnType<Page['locator']>
): Promise<Prop[]> {
  log('extractSimpleProps - searching for table...');

  // Flexible selector: handles direct sibling OR div-wrapped
  const table = propsHeading.locator('~ table, ~ div table').first();

  if (!(await table.count())) {
    log('extractSimpleProps - no table found');
    return [];
  }

  log('extractSimpleProps - table found, extracting rows...');
  return await extractPropsFromTable(table);
}

/**
 * Extract props from composite tables (Pattern 3)
 *
 * STRUCTURE: h2#props → h3 (subcomponent) → (optional div) → table
 *
 * For each h3 subheading:
 *   1. Extract subcomponent name (e.g., "Root", "Item")
 *   2. Find associated table
 *   3. Parse props with dot notation: "Root.collection"
 */
async function extractCompositeProps(
  page: Page,
  subheadings: Array<ReturnType<Page['locator']>>
): Promise<Prop[]> {
  log('extractCompositeProps - processing', subheadings.length, 'subheadings...');

  const allProps: Prop[] = [];

  for (const h3 of subheadings) {
    // Extract subcomponent name
    const subcomponentName = (await h3.textContent())?.trim() || '';
    log('extractCompositeProps - processing subcomponent:', subcomponentName);

    // Find table after this h3 (handles div wrapping)
    const table = h3.locator('~ table, ~ div table').first();

    if (!(await table.count())) {
      log('extractCompositeProps - no table found for', subcomponentName);
      continue;
    }

    // Extract props from table
    const props = await extractPropsFromTable(table, subcomponentName);
    allProps.push(...props);
    log('extractCompositeProps - extracted', props.length, 'props for', subcomponentName);
  }

  log('extractCompositeProps - total props extracted:', allProps.length);
  return allProps;
}

/**
 * Extract props from a table element
 *
 * COLUMN ORDER (Fixed in Chakra UI):
 *   - Column 0: Prop name
 *   - Column 1: Default value
 *   - Column 2: Type and description (structured as <code> + <p>)
 *
 * COLUMN 2 STRUCTURE:
 *   - <code> element: TypeScript type signature (e.g., "string | undefined")
 *   - <p> element: Human-readable description (e.g., "The color scheme")
 *
 * @param table - Playwright locator for table element
 * @param prefix - Optional prefix for composite props (e.g., "Root")
 */
async function extractPropsFromTable(
  table: ReturnType<Page['locator']>,
  prefix?: string
): Promise<Prop[]> {
  log('extractPropsFromTable - extracting rows...', prefix ? `(prefix: ${prefix})` : '');

  const props: Prop[] = [];

  // Get all rows in tbody (skip header)
  const rows = table.locator('tbody tr');
  const rowCount = await rows.count();

  log('extractPropsFromTable - found', rowCount, 'rows');

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const cells = row.locator('td');
    const cellCount = await cells.count();

    if (cellCount < 3) {
      log('extractPropsFromTable - row', i, 'has fewer than 3 cells, skipping');
      continue;
    }

    // Extract cell values (fixed column order)
    const propName = (await cells.nth(0).textContent())?.trim() || '';
    const defaultValue = (await cells.nth(1).textContent())?.trim() || '';

    // Column 2 contains type in <code> element and description in <p> element
    const typeCell = cells.nth(2);
    const typeText = (await typeCell.locator('code').first().textContent())?.trim() || '';
    const descText = (await typeCell.locator('p').first().textContent())?.trim() || '';

    if (!propName || !typeText) {
      log('extractPropsFromTable - row', i, 'missing name or type, skipping');
      continue;
    }

    // Build prop object
    const prop: Prop = {
      name: prefix ? `${prefix}.${propName}` : propName,
      type: typeText,
    };

    // Add description if present (extracted from <p> element)
    if (descText) {
      prop.description = descText;
    }

    // Add default value if present (Chakra uses "-" for no default)
    if (defaultValue && defaultValue !== '-') {
      prop.defaultValue = defaultValue;
    }

    props.push(prop);
    log('extractPropsFromTable - extracted prop:', prop.name);
  }

  log('extractPropsFromTable - extracted', props.length, 'props');
  return props;
}

// =============================================================================
// Batch 6: Integration (Updated extractComponent)
// =============================================================================

/**
 * Extract component documentation from a page
 *
 * PUBLIC API - Main entry point for extracting structured ComponentDoc from Chakra UI pages
 *
 * PURPOSE: Transform a Chakra UI component documentation page into structured JSON
 *
 * EXECUTION FLOW:
 *   1. Validate page structure (<main> element exists)
 *   2. Extract component name from <h1> (required)
 *   3. Extract description from first <p> after <h1> (with fallback)
 *   4. Extract code examples using extractCodeExamples() (Batch 5)
 *   5. Detect related components using detectRelatedComponents() (Batch 3)
 *   6. Build ComponentDoc object
 *   7. Return null if no useful content found (description or codeExamples required)
 *
 * EXTRACTION STRATEGY:
 *
 *   Component Name (REQUIRED):
 *     - Selector: main h1 (first)
 *     - Example: "Button", "Input", "Tooltip"
 *     - Returns null if missing
 *
 *   Description (with fallback):
 *     - Primary: First <p> immediately after <h1> (h1 + p)
 *     - Fallback: First non-empty <p> anywhere in <main>
 *     - Optional field
 *
 *   Code Examples (Milestone B):
 *     - Delegates to extractCodeExamples()
 *     - Applies quality filtering (see extractCodeExamples for details)
 *     - Optional field
 *
 *   Related Components (Milestone B):
 *     - Delegates to detectRelatedComponents()
 *     - Parses JSX tags from code examples
 *     - Excludes the component itself
 *     - Optional field
 *
 * VALIDATION:
 *   - Page MUST have <main> element (Chakra convention)
 *   - Page MUST have <h1> with component name
 *   - Page MUST have either description OR codeExamples
 *
 * RETURN:
 *   - ComponentDoc object with populated fields
 *   - null if page is not a valid component page
 *
 * SCHEMA: See RAGResultSchema.ts for ComponentDoc type definition
 *
 * Called by: crawler.ts during BFS traversal of Chakra UI docs
 */
export async function extractComponent(page: Page, url: string): Promise<ComponentDoc | null> {
  log('extractComponent - starting for URL:', url);

  // Validate page structure - Chakra uses <main> for docs content
  const main = page.locator("main");
  if (!(await main.count())) {
    log('extractComponent - no <main> element found');
    return null;
  }

  // Extract component name from h1 (REQUIRED)
  const componentName =
    (await main.locator("h1").first().textContent())?.trim() || "";
  if (!componentName) {
    log('extractComponent - no component name found');
    return null;
  }

  log('extractComponent - component:', componentName);

  // Extract description with fallback strategy
  // Primary: First paragraph immediately after h1 (CSS adjacent sibling selector)
  const firstParaAfterH1 = main.locator("h1 + p");
  let description =
    (await firstParaAfterH1.first().textContent())?.trim() || "";

  if (!description) {
    // Fallback: Search for first non-empty paragraph in entire <main>
    const paras = main.locator("p");
    const count = await paras.count();
    for (let i = 0; i < count; i++) {
      const t = (await paras.nth(i).textContent())?.trim();
      if (t) {
        description = t;
        break;
      }
    }
  }

  log('extractComponent - description length:', description?.length || 0);

  // Extract code examples with quality filtering AND import patterns
  const { examples, importPatterns, allImportPatterns } = await extractCodeExamples(page);
  log('extractComponent - code examples extracted:', examples.length);
  log('extractComponent - import patterns (accepted):', importPatterns.length);
  log('extractComponent - import patterns (all):', allImportPatterns.length);

  // Extract props from props tables (Milestone C)
  const props = await extractProps(page);
  log('extractComponent - props extracted:', props.length);

  // Detect related components from code examples (Milestone B)
  const relatedComponents = detectRelatedComponents(componentName, examples);
  log('extractComponent - related components:', relatedComponents);

  // Build ComponentDoc object (only include non-empty optional fields)
  const doc: ComponentDoc = {
    componentName,
    sourceUrl: url,
  };

  if (description) {
    doc.description = description;
  }

  if (examples.length > 0) {
    doc.codeExamples = examples;
  }

  if (props.length > 0) {
    doc.props = props;
  }

  if (relatedComponents.length > 0) {
    doc.relatedComponents = relatedComponents;
  }

  // NEW: Attach import patterns
  if (importPatterns.length > 0) {
    doc.importPatterns = importPatterns;
  }

  if (allImportPatterns.length > 0) {
    doc.allImportPatterns = allImportPatterns;
  }

  // Validation: Must have at least description OR codeExamples to be useful
  const hasUseful = Boolean(doc.description || doc.codeExamples);
  if (!hasUseful) {
    log('extractComponent - no useful content found');
    return null;
  }

  log('extractComponent - complete:', {
    componentName,
    hasDescription: !!doc.description,
    codeExamplesCount: examples.length,
    propsCount: props.length,
    relatedComponentsCount: relatedComponents.length,
    importPatternsCount: importPatterns.length,
    allImportPatternsCount: allImportPatterns.length,
  });

  return doc;
}

// =============================================================================
// Test Harness (Batches 1-3)
// =============================================================================
// Run with: DEBUG=true npx tsx src/steps/0-extract-docs/extractors.ts
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n🧪 Testing Batches 1-3 Functions\n');
  console.log('='.repeat(80));

  // Test Batch 1: Text Processing
  console.log('\n📦 BATCH 1: Text Processing Utilities\n');

  console.log('Test 1: cleanHeadingText');
  const dirtyHeading = '.css-vfo6uh{color:var(--chakra-colors-fg);}Usage';
  console.log('Result:', cleanHeadingText(dirtyHeading));
  console.log('Expected: "Usage"');

  console.log('\nTest 2: normalizeCode');
  const codeWithComments = `// This is a comment
const Demo = () => {
  return <Button>Click me</Button> // inline comment
}`;
  console.log('Result length:', normalizeCode(codeWithComments).length);
  console.log('(Comments should be removed)');

  console.log('\nTest 3: extractComponentTags');
  const jsxCode = '<Button onClick={fn}><Icon /><Text>Click</Text></Button>';
  console.log('Result:', extractComponentTags(jsxCode));
  console.log('Expected: ["Button", "Icon", "Text"]');

  // Test Batch 2: Code Quality Filters
  console.log('\n' + '='.repeat(80));
  console.log('\n📦 BATCH 2: Code Quality Filters\n');

  console.log('Test 4: isInExcludedSection');
  console.log('Installation:', isInExcludedSection('Installation'));
  console.log('Usage:', isInExcludedSection('Usage'));
  console.log('Expected: true, false');

  console.log('\nTest 5: isLowValueCode - Installation Command');
  const installCmd = 'npm install @chakra-ui/react';
  console.log('Result:', isLowValueCode(installCmd));
  console.log('Expected: true (should reject)');

  console.log('\nTest 6: isLowValueCode - Bare Import');
  const bareImport = 'import { Button } from "@chakra-ui/react"';
  console.log('Result:', isLowValueCode(bareImport));
  console.log('Expected: true (should reject)');

  console.log('\nTest 7: isLowValueCode - Good Component');
  const goodCode = `import { Button } from "@chakra-ui/react"

const Demo = () => {
  return <Button colorScheme="blue">Click me</Button>
}`;
  console.log('Result:', isLowValueCode(goodCode));
  console.log('Expected: false (should accept)');

  console.log('\nTest 8: getCompositionScore - Low Score (Trivial)');
  const lowScoreCode = '<Button>Click</Button>';
  const lowScoreResult = getCompositionScore(lowScoreCode);
  console.log('Result:', lowScoreResult);
  console.log('Expected: { score: 2, complexity: "trivial", breakdown: { jsx: 2, ... } }');

  console.log('\nTest 9: getCompositionScore - High Score (Advanced)');
  const highScoreCode = `const Demo = () => {
  const [count, setCount] = useState(0);
  return (
    <Button onClick={() => setCount(count + 1)} aria-label="Increment">
      <Icon /> Count: {count}
    </Button>
  );
}`;
  const highScoreResult = getCompositionScore(highScoreCode);
  console.log('Result:', highScoreResult);
  console.log('Expected: { score: ≥11, complexity: "advanced", breakdown: { ... } }');

  // Test Batch 3: Array Processing
  console.log('\n' + '='.repeat(80));
  console.log('\n📦 BATCH 3: Array Processing\n');

  console.log('Test 10: dedupeCodeExamples');
  const duplicateExamples: CodeExample[] = [
    { code: 'const x = 1; // comment' },
    { code: 'const x = 1; // different comment' }, // Should be deduped (comments removed)
    { code: 'const y = 2;' },
  ];
  const deduped = dedupeCodeExamples(duplicateExamples);
  console.log('Input count:', duplicateExamples.length);
  console.log('Output count:', deduped.length);
  console.log('Expected: 2 (first two should be treated as duplicates)');

  console.log('\nTest 11: detectRelatedComponents');
  const buttonExamples: CodeExample[] = [
    { code: '<Button><Icon /></Button>' },
    { code: '<ButtonGroup><Button /><Button /></ButtonGroup>' },
    { code: '<Form><Input /><Button /></Form>' },
  ];
  const related = detectRelatedComponents('Button', buttonExamples);
  console.log('Result:', related);
  console.log('Expected: ["ButtonGroup", "Form", "Icon", "Input"] (sorted, no "Button")');

  console.log('\n' + '='.repeat(80));
  console.log('\n📦 IMPORT PATTERN EXTRACTION TESTS\n');

  console.log('Test 12: extractImports - Named imports');
  const namedCode = 'import { Button, ButtonGroup } from "@chakra-ui/react"';
  const namedImports = extractImports(namedCode);
  console.log('Result:', JSON.stringify(namedImports, null, 2));
  console.log('Expected: [{ source: "@chakra-ui/react", imports: ["Button", "ButtonGroup"], type: "named", isChakra: true }]');

  console.log('\nTest 13: extractImports - Type imports');
  const typeCode = 'import type { ButtonProps } from "@chakra-ui/react"';
  const typeImports = extractImports(typeCode);
  console.log('Result:', JSON.stringify(typeImports, null, 2));
  console.log('Expected: type: "type"');

  console.log('\nTest 14: extractImports - Multiple sources');
  const mixedCode = `
import { Button } from "@chakra-ui/react"
import { useState, useEffect } from "react"
import { motion } from "framer-motion"
`;
  const mixedImports = extractImports(mixedCode);
  console.log('Result count:', mixedImports.length);
  console.log('Sources:', mixedImports.map(i => i.source));
  console.log('Expected: 3 patterns (Chakra, React, framer-motion)');
  console.log('isChakra flags:', mixedImports.map(i => i.isChakra));
  console.log('Expected: [true, false, false]');

  console.log('\nTest 15: extractImports - Default imports');
  const defaultCode = 'import React from "react"';
  const defaultImports = extractImports(defaultCode);
  console.log('Result:', JSON.stringify(defaultImports, null, 2));
  console.log('Expected: type: "default", imports: ["React"]');

  console.log('\nTest 16: extractImports - Namespace imports');
  const namespaceCode = 'import * as ChakraUI from "@chakra-ui/react"';
  const namespaceImports = extractImports(namespaceCode);
  console.log('Result:', JSON.stringify(namespaceImports, null, 2));
  console.log('Expected: type: "namespace", imports: ["ChakraUI"]');

  console.log('\nTest 17: dedupeImportPatterns');
  const dupePatterns: ImportPattern[] = [
    { source: 'react', imports: ['useState'], type: 'named', isChakra: false },
    { source: 'react', imports: ['useEffect'], type: 'named', isChakra: false },
    { source: '@chakra-ui/react', imports: ['Button'], type: 'named', isChakra: true },
    { source: '@chakra-ui/react', imports: ['Icon'], type: 'named', isChakra: true },
  ];
  const dedupedPatterns = dedupeImportPatterns(dupePatterns);
  console.log('Input count:', dupePatterns.length);
  console.log('Output count:', dedupedPatterns.length);
  console.log('Output:', JSON.stringify(dedupedPatterns, null, 2));
  console.log('Expected: 2 patterns (React imports merged, Chakra imports merged)');

  console.log('\nTest 18: extractImports - Mixed type imports');
  const mixedTypeCode = 'import { Button, type ButtonProps } from "@chakra-ui/react"';
  const mixedTypeImports = extractImports(mixedTypeCode);
  console.log('Result:', JSON.stringify(mixedTypeImports, null, 2));
  console.log('Expected: type: "named", imports should include both Button and ButtonProps (without "type" prefix)');

  console.log('\n' + '='.repeat(80));
  console.log('\n📦 NEW IMPORT PATTERN TESTS\n');

  console.log('Test 19: extractImports - Default + Named (CRITICAL)');
  const defaultNamedCode = 'import React, { useState, useEffect } from "react"';
  const defaultNamedImports = extractImports(defaultNamedCode);
  console.log('Result:', JSON.stringify(defaultNamedImports, null, 2));
  console.log('Expected: type: "default-named", defaultImport: "React", imports: ["useState", "useEffect"]');

  console.log('\nTest 20: extractImports - Side-effect imports');
  const sideEffectCode = 'import "@chakra-ui/react/dist/index.css"';
  const sideEffectImports = extractImports(sideEffectCode);
  console.log('Result:', JSON.stringify(sideEffectImports, null, 2));
  console.log('Expected: type: "side-effect", imports: [], source contains CSS path');

  console.log('\nTest 21: extractImports - Type default imports');
  const typeDefaultCode = 'import type React from "react"';
  const typeDefaultImports = extractImports(typeDefaultCode);
  console.log('Result:', JSON.stringify(typeDefaultImports, null, 2));
  console.log('Expected: type: "type-default", imports: ["React"]');

  console.log('\nTest 22: extractImports - Multiple patterns in one code block');
  const multiPatternCode = `
import React, { useState } from "react"
import { Button } from "@chakra-ui/react"
import "@chakra-ui/react/dist/index.css"
import type { ButtonProps } from "@chakra-ui/react"
`;
  const multiPatternImports = extractImports(multiPatternCode);
  console.log('Result count:', multiPatternImports.length);
  console.log('Types:', multiPatternImports.map(i => i.type));
  console.log('Expected: 4 patterns - default-named, named, side-effect, type');
  console.log('Full result:', JSON.stringify(multiPatternImports, null, 2));

  console.log('\nTest 23: extractImports - Real-world React example');
  const realWorldCode = `
import React, { useState, useEffect, useCallback } from 'react'
import { Button, Stack, Text } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import 'styles/global.css'
`;
  const realWorldImports = extractImports(realWorldCode);
  console.log('Result count:', realWorldImports.length);
  console.log('Summary:', realWorldImports.map(i => ({ source: i.source, type: i.type, count: i.imports.length })));
  console.log('Expected: React (default-named with 3), Chakra (named with 3), framer (named with 1), CSS (side-effect)');

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ All tests complete! Review results above.\n');
}