// =============================================================================
// Week 1 Extractors - Component Documentation
// =============================================================================
// Updated: 2025-10-15
// Reference: docs/week1/IMPLEMENTATION_PLAN.md
//
// This file contains extraction logic for Chakra UI component documentation.
// Implements Milestone B (Code Examples) and Milestone C (Props Tables).
//
// ARCHITECTURE:
// This file is organized into 6 functional batches that build upon each other:
//
//   Batch 1: Text Processing Utilities
//            Low-level string manipulation (cleaning, normalizing, parsing)
//
//   Batch 2: Code Quality Filters
//            Business logic to determine if code examples are valuable
//
//   Batch 3: Array Processing
//            Deduplication and relationship detection across code examples
//
//   Batch 4: Playwright Interaction
//            Browser DOM queries to extract context (headings, structure)
//
//   Batch 5: Main Extraction
//            Orchestration layer that combines Batches 1-4 to extract code
//
//   Batch 6: Integration
//            Public API (extractComponent) that produces final ComponentDoc
//
// FLOW:
// 1. extractComponent() is called with a Playwright page + URL
// 2. Extract basic metadata (component name, description)
// 3. Call extractCodeExamples() to get all code blocks with quality filtering
// 4. Call detectRelatedComponents() to find cross-component relationships
// 5. Return structured ComponentDoc or null if page has no useful content
//
// QUALITY STRATEGY:
// We use a multi-stage filtering approach to only keep high-value code:
//   - Section filtering: Skip installation/import sections
//   - Content heuristics: Skip package.json, bare imports, install commands
//   - Composition scoring: Only keep code with ≥5 points (see getCompositionScore)
//   - Deduplication: Remove semantically identical code blocks
//
// =============================================================================

import type { Page } from 'playwright';
import type { ComponentDoc, CodeExample, Prop, ImportPattern } from '../../schemas/RAGResultSchema.js';

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
// Batch 1: Text Processing Utilities
// =============================================================================

/**
 * Clean CSS class pollution from heading text
 *
 * PROBLEM: Chakra UI's MDX renderer sometimes injects inline CSS into text nodes
 * Example raw text: ".css-vfo6uh{color:var(--chakra-colors-fg);}Usage"
 *
 * SOLUTION: Use regex to strip out any .css-xxx{...} patterns
 * Result: "Usage"
 *
 * WHY: We need clean section names for:
 *   1. Filtering excluded sections (e.g., "Installation")
 *   2. Storing in CodeExample.section field
 *   3. Human-readable debug logs
 */
function cleanHeadingText(text: string): string {
  log('cleanHeadingText - input:', text);

  // Remove CSS class definitions (pattern: .css-xxx{...})
  // Regex breakdown: \.css-[a-z0-9]+ matches class name, \{[^}]*\} matches style rules
  const cleaned = text.replace(/\.css-[a-z0-9]+\{[^}]*\}/gi, '').trim();

  log('cleanHeadingText - output:', cleaned);
  return cleaned;
}

/**
 * Normalize code for deduplication
 *
 * PROBLEM: Same code example may appear multiple times with minor differences:
 *   - Different comments: "// Example 1" vs "// Demo code"
 *   - Different string content: "Click me" vs "Submit form"
 *   - Different whitespace/formatting
 *
 * SOLUTION: Create a canonical form by removing/normalizing non-structural elements
 *
 * TRANSFORMATIONS:
 *   1. Strip line comments (//)
 *   2. Strip block comments (slash-star ... star-slash)
 *   3. Normalize all string literals to "" (preserves structure, ignores content)
 *   4. Collapse all whitespace to single spaces
 *
 * EXAMPLE:
 *   Input:  const Demo = () => { // Comment  return <Button>Click</Button> }
 *   Output: const Demo = () => { return <Button>""</Button> }
 *
 * Used by: dedupeCodeExamples() to detect semantic duplicates
 */
function normalizeCode(code: string): string {
  log('normalizeCode - input length:', code.length);

  const normalized = code
    .replace(/\/\/.*$/gm, '')             // Remove line comments (// ...)
    .replace(/\/\*[\s\S]*?\*\//g, '')     // Remove block comments
    .replace(/["']([^"']+)["']/g, '""')   // Normalize all strings to ""
    .replace(/\s+/g, ' ')                  // Collapse whitespace
    .trim();

  log('normalizeCode - output length:', normalized.length);
  log('normalized code preview:', normalized.slice(0, 100) + (normalized.length > 100 ? '...' : ''));
  return normalized;
}

/**
 * Extract component tags from code examples
 *
 * PURPOSE: Parse JSX code to find all React component usages
 *
 * HOW IT WORKS:
 *   1. Use regex to match JSX opening tags that start with uppercase letters
 *   2. Capture the component name (excluding HTML tags like <div>, <span>)
 *   3. Return unique, sorted list of component names
 *
 * REGEX PATTERN: /<([A-Z][A-Za-z0-9]*)/g
 *   - < = literal less-than (JSX tag start)
 *   - ([A-Z][A-Za-z0-9]*) = capture group: uppercase letter + alphanumeric
 *   - /g = global flag (find all matches)
 *
 * EXAMPLES:
 *   Input:  "<Button><Icon /><Text>Hello</Text></Button>"
 *   Output: ["Button", "Icon", "Text"]
 *
 *   Input:  "<div><button>HTML</button></div>"
 *   Output: [] (no uppercase components)
 *
 * Used by: detectRelatedComponents() to build component relationship graph
 */
function extractComponentTags(code: string): string[] {
  log('extractComponentTags - analyzing code...');

  const tagPattern = /<([A-Z][A-Za-z0-9]*)/g;
  const found = new Set<string>();

  const matches = code.matchAll(tagPattern);
  for (const match of matches) {
    found.add(match[1]);  // match[1] is the captured component name
  }

  const tags = Array.from(found).sort();
  log('extractComponentTags - found tags:', tags);

  return tags;
}

/**
 * Extract import patterns from code
 *
 * PURPOSE: Parse all import statements to understand dependency patterns
 *
 * PATTERNS DETECTED:
 *   - Named: import { A, B } from 'pkg'
 *   - Default: import X from 'pkg'
 *   - Namespace: import * as X from 'pkg'
 *   - Default+Named: import X, { A, B } from 'pkg'  [CRITICAL - very common in React]
 *   - Type: import type { X } from 'pkg'
 *   - Type Default: import type X from 'pkg'
 *   - Side-effect: import 'pkg'  [CSS, polyfills]
 *
 * CATEGORIZATION:
 *   - isChakra: true if source contains 'chakra'
 *   - Tracks third-party deps: React, framer-motion, react-hook-form, etc.
 *
 * Used by: extractCodeExamples() to build global import patterns
 */
function extractImports(code: string, section?: string): ImportPattern[] {
  log('extractImports - analyzing code for imports...');

  const patterns: ImportPattern[] = [];

  // Pattern 1: Default + Named imports - import X, { A, B } from 'pkg'
  // CRITICAL: Must be checked FIRST (most specific pattern)
  // Example: import React, { useState, useEffect } from 'react'
  const defaultNamedRegex = /import\s+(\w+)\s*,\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]/g;
  for (const match of code.matchAll(defaultNamedRegex)) {
    const defaultImport = match[1];
    const rawNamedImports = match[2];
    const source = match[3];

    // Parse named imports (handles "type X" syntax)
    const namedImports = rawNamedImports
      .split(',')
      .map(s => s.trim())
      .filter(s => s && s !== 'type')
      .map(s => s.replace(/^type\s+/, ''));

    patterns.push({
      source,
      imports: namedImports,
      type: 'default-named',
      section,
      isChakra: source.includes('chakra'),
      defaultImport,
    });
  }

  // Pattern 2: Type-only imports - import type { X } from 'pkg'
  // Must be checked BEFORE regular named imports
  const typeRegex = /import\s+type\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]/g;
  for (const match of code.matchAll(typeRegex)) {
    const imports = match[1].split(',').map(s => s.trim()).filter(Boolean);
    const source = match[2];

    // Skip if already captured as default+named
    if (patterns.some(p => p.source === source && p.type === 'default-named')) {
      continue;
    }

    patterns.push({
      source,
      imports,
      type: 'type',
      section,
      isChakra: source.includes('chakra'),
    });
  }

  // Pattern 3: Type default imports - import type X from 'pkg'
  const typeDefaultRegex = /^import\s+type\s+(\w+)\s+from\s*['"]([^'"]+)['"]/gm;
  for (const match of code.matchAll(typeDefaultRegex)) {
    const importName = match[1];
    const source = match[2];

    // Skip if already captured
    if (patterns.some(p => p.source === source)) {
      continue;
    }

    patterns.push({
      source,
      imports: [importName],
      type: 'type-default',
      section,
      isChakra: source.includes('chakra'),
    });
  }

  // Pattern 4: Named imports - import { A, B } from 'pkg'
  const namedRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"]([^'"]+)['"]/g;
  for (const match of code.matchAll(namedRegex)) {
    const rawImports = match[1];
    const source = match[2];

    // Skip if already captured
    if (patterns.some(p => p.source === source)) {
      continue;
    }

    // Parse individual imports (handles "type X" syntax in mixed imports)
    const imports = rawImports
      .split(',')
      .map(s => s.trim())
      .filter(s => s && s !== 'type')
      .map(s => s.replace(/^type\s+/, ''));

    if (imports.length > 0) {
      patterns.push({
        source,
        imports,
        type: 'named',
        section,
        isChakra: source.includes('chakra'),
      });
    }
  }

  // Pattern 5: Namespace imports - import * as X from 'pkg'
  const namespaceRegex = /import\s*\*\s*as\s+(\w+)\s*from\s*['"]([^'"]+)['"]/g;
  for (const match of code.matchAll(namespaceRegex)) {
    const source = match[2];

    // Skip if already captured
    if (patterns.some(p => p.source === source)) {
      continue;
    }

    patterns.push({
      source: match[2],
      imports: [match[1]],
      type: 'namespace',
      section,
      isChakra: match[2].includes('chakra'),
    });
  }

  // Pattern 6: Default imports - import X from 'pkg'
  const defaultRegex = /^import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/gm;
  for (const match of code.matchAll(defaultRegex)) {
    const importName = match[1];
    const source = match[2];

    // Skip if already captured
    if (patterns.some(p => p.source === source)) {
      continue;
    }

    patterns.push({
      source,
      imports: [importName],
      type: 'default',
      section,
      isChakra: source.includes('chakra'),
    });
  }

  // Pattern 7: Side-effect imports - import 'pkg'
  const sideEffectRegex = /^import\s+['"]([^'"]+)['"]/gm;
  for (const match of code.matchAll(sideEffectRegex)) {
    const source = match[1];

    // Skip if already captured (avoid double-counting)
    if (patterns.some(p => p.source === source)) {
      continue;
    }

    patterns.push({
      source,
      imports: [],  // No imports for side-effect only
      type: 'side-effect',
      section,
      isChakra: source.includes('chakra'),
    });
  }

  log('extractImports - found', patterns.length, 'import patterns');
  return patterns;
}

// =============================================================================
// Batch 2: Code Quality Filters
// =============================================================================

/**
 * Check if code block is in an excluded section (low-value content)
 */
function isInExcludedSection(sectionName: string): boolean {
  const excluded = [
    'installation',
    'import',
    'setup',
    'getting started',
    'prerequisites',
    'migration',
  ];

  const lower = sectionName.toLowerCase();
  const isExcluded = excluded.some(ex => lower.includes(ex));

  log('isInExcludedSection - section:', sectionName, '- excluded:', isExcluded);
  return isExcluded;
}

/**
 * Check if code is low-value based on content heuristics
 */
function isLowValueCode(code: string): boolean {
  const trimmed = code.trim();
  const lines = trimmed.split('\n');
  const lineCount = lines.length;

  log('isLowValueCode - analyzing', lineCount, 'lines');

  // Skip if < 3 lines
  if (lineCount < 3) {
    log('isLowValueCode - REJECT: too short (<3 lines)');
    return true;
  }

  // Skip installation commands
  if (/(npm|yarn|pnpm|bun) (install|add|i)/.test(trimmed)) {
    log('isLowValueCode - REJECT: installation command');
    return true;
  }

  // Skip bare import statements
  if (lineCount <= 3 && /^import\s+.*from\s+['"]/.test(trimmed)) {
    log('isLowValueCode - REJECT: bare import statement');
    return true;
  }

  // Skip package.json snippets
  if (/["']dependencies["']|["']devDependencies["']/.test(trimmed)) {
    log('isLowValueCode - REJECT: package.json snippet');
    return true;
  }

  // Skip config files
  if (/["']compilerOptions["']|["']include["']/.test(trimmed)) {
    log('isLowValueCode - REJECT: config file');
    return true;
  }

  // Skip bare JSX without function wrapper (< 5 lines)
  if (lineCount < 5 && /^<[A-Z]/.test(trimmed) && !/^(function|const|export)/.test(trimmed)) {
    log('isLowValueCode - REJECT: bare JSX without wrapper');
    return true;
  }

  log('isLowValueCode - ACCEPT: passed all filters');
  return false;
}

/**
 * Score code block for composition quality
 *
 * PURPOSE: Determine if a code example is valuable enough to include
 *
 * STRATEGY: Award points for complexity indicators that make examples useful
 * for LLM training and developer reference
 *
 * SCORING CRITERIA:
 *   +2 points: Contains JSX/TSX (React components)
 *   +2 points: Uses multiple props (shows component configuration)
 *   +3 points: Defines a function (complete, executable example)
 *   +3 points: Uses 3+ different components (composition patterns)
 *   +1 point:  Has event handlers (interactivity)
 *   +2 points: Uses React hooks (useState, useEffect, etc.)
 *   +2 points: Includes accessibility attrs (aria-*, role, alt)
 *
 * THRESHOLD: Code must score ≥5 points to be kept
 *
 * EXAMPLES:
 *   "<Button>Click</Button>"
 *   → Score: 2 (JSX only) → REJECTED
 *
 *   "const Demo = () => { const [count, setCount] = useState(0); return <Button onClick={() => setCount(count + 1)} aria-label="Increment">Count: {count}</Button> }"
 *   → Score: 13 (JSX + Function + Props + Hooks + Event + Accessibility) → ACCEPTED
 *
 * WHY: Filters out trivial snippets while keeping rich, educational examples
 */
function getCompositionScore(code: string): number {
  log('block to analyze for composition score:\n', code, '\n---');
  let score = 0;
  const checks: string[] = [];

  // JSX/TSX usage: +2
  if (/<[A-Z]/.test(code)) {
    score += 2;
    checks.push('JSX (+2)');
  }

  // Multiple props: +2
  if (/\w+={[^}]*}.*\w+={/.test(code)) {
    score += 2;
    checks.push('Multiple props (+2)');
  }

  // Function definition: +3
  if (/(function|const)\s+\w+\s*=.*=>|function\s+\w+\s*\(/.test(code)) {
    score += 3;
    checks.push('Function definition (+3)');
  }

  // Multiple components: +3
  const componentMatches = code.match(/<[A-Z]\w+/g) || [];
  if (componentMatches.length > 2) {
    score += 3;
    checks.push(`Multiple components (${componentMatches.length}) (+3)`);
  }

  // Event handlers: +1
  if (/on[A-Z]\w+={/.test(code)) {
    score += 1;
    checks.push('Event handlers (+1)');
  }

  // Hooks (useState, etc.): +2
  if (/use[A-Z]\w+/.test(code)) {
    score += 2;
    checks.push('Hooks (+2)');
  }

  // Accessibility attributes: +2
  if (/(aria-|role=|alt=)/.test(code)) {
    score += 2;
    checks.push('Accessibility (+2)');
  }

  log('getCompositionScore - score:', score, '- checks:', checks.join(', '));
  return score;
}

// =============================================================================
// Batch 3: Array Processing
// =============================================================================

/**
 * Deduplicate code examples by normalized content
 */
function dedupeCodeExamples(examples: CodeExample[]): CodeExample[] {
  log('dedupeCodeExamples - input count:', examples.length);

  const seen = new Set<string>();
  const unique: CodeExample[] = [];

  for (const example of examples) {
    const normalized = normalizeCode(example.code);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(example);
    } else {
      log('dedupeCodeExamples - skipping duplicate');
    }
  }

  log('dedupeCodeExamples - output count:', unique.length, '(removed', examples.length - unique.length, 'duplicates)');
  return unique;
}

/**
 * Extract component tags from code examples for related components tracking
 */
function detectRelatedComponents(componentName: string, codeExamples: CodeExample[]): string[] {
  log('detectRelatedComponents - component:', componentName, '- examples:', codeExamples.length);

  const found = new Set<string>();

  for (const example of codeExamples) {
    const tags = extractComponentTags(example.code);

    for (const tag of tags) {
      // Don't include the component itself
      if (tag !== componentName) {
        found.add(tag);
      }
    }
  }

  const related = Array.from(found).sort();
  log('detectRelatedComponents - found:', related);

  return related;
}

/**
 * Deduplicate import patterns by source and type
 *
 * PURPOSE: Merge imports from the same package/source
 *
 * STRATEGY:
 *   - Group by source + type (e.g., "@chakra-ui/react:named")
 *   - Merge import lists
 *   - Remove duplicates
 *   - Sort for consistency
 *
 * EXAMPLE:
 *   Input:
 *     [{ source: 'react', imports: ['useState'], type: 'named' },
 *      { source: 'react', imports: ['useEffect'], type: 'named' }]
 *
 *   Output:
 *     [{ source: 'react', imports: ['useEffect', 'useState'], type: 'named' }]
 */
function dedupeImportPatterns(patterns: ImportPattern[]): ImportPattern[] {
  log('dedupeImportPatterns - input count:', patterns.length);

  const map = new Map<string, ImportPattern>();

  for (const pattern of patterns) {
    // Key: source + type (section is intentionally excluded for grouping)
    const key = `${pattern.source}:${pattern.type}`;
    const existing = map.get(key);

    if (existing) {
      // Merge imports from same source+type
      const combinedImports = new Set([...existing.imports, ...pattern.imports]);
      existing.imports = Array.from(combinedImports).sort();

      // Keep section if present
      if (!existing.section && pattern.section) {
        existing.section = pattern.section;
      }
    } else {
      map.set(key, {
        ...pattern,
        imports: [...pattern.imports].sort(), // Sort for consistency
      });
    }
  }

  const deduped = Array.from(map.values());
  log('dedupeImportPatterns - output count:', deduped.length, '(removed', patterns.length - deduped.length, 'duplicates)');

  return deduped;
}

// =============================================================================
// Batch 4: Playwright Interaction
// =============================================================================

/**
 * Find the heading that precedes a code block in the DOM
 *
 * PURPOSE: Extract section context for code examples (e.g., "Usage", "Props", "Installation")
 *
 * CHALLENGE: Chakra UI's MDX structure is unpredictable - headings may be:
 *   - Direct siblings of code blocks
 *   - Wrapped in different container elements
 *   - Nested at varying depths
 *
 * From exploration: Simple sibling-only search succeeds ~40% of the time
 *
 * SOLUTION: Multi-strategy fallback approach
 *
 * STRATEGY 1: Sibling Walk (fastest, works 40% of time)
 *   - Start from code block's parent
 *   - Walk backwards through previous siblings (max 20 elements)
 *   - Return first h1-h6 element found
 *
 * STRATEGY 2: Parent Tree Search (slower, catches remaining cases)
 *   - Walk up parent tree (max 5 levels)
 *   - At each level, find all h1-h6 elements
 *   - Search backwards through headings
 *   - Return first heading that appears BEFORE the code block in document order
 *   - Uses compareDocumentPosition() to check ordering
 *
 * DOCUMENT_POSITION_FOLLOWING: Bitmask flag indicating an element comes after another
 *
 * RETURN: { section: string, found: boolean }
 *   - section: Cleaned heading text (see cleanHeadingText)
 *   - found: true if a heading was found, false otherwise
 *
 * Used by: extractCodeExamples() to populate CodeExample.section field
 */
async function findPrecedingHeading(codeBlock: Page['locator'] extends (...args: any[]) => infer R ? R : never): Promise<{ section: string; found: boolean }> {
  try {
    log('findPrecedingHeading - searching for heading...');

    // Strategy 1: Walk backwards through siblings (up to 20 elements)
    // This is the fast path - works when heading and code are at the same nesting level
    const siblingResult = await codeBlock.evaluate((el) => {
      let current = el.parentElement?.previousElementSibling;
      let distance = 0;

      while (current && distance < 20) {
        const tag = current.tagName.toLowerCase();
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
          return {
            found: true,
            text: current.textContent?.trim() || '',
            method: 'sibling',
            distance,
          };
        }
        current = current.previousElementSibling;
        distance++;
      }
      return { found: false, text: '', method: 'sibling', distance };
    });

    if (siblingResult.found) {
      const cleaned = cleanHeadingText(siblingResult.text);
      log('findPrecedingHeading - found via sibling walk:', cleaned, `(${siblingResult.distance} siblings away)`);
      return { section: cleaned, found: true };
    }

    // Strategy 2: Walk up parent tree and search backwards
    // This is the fallback for nested/wrapped structures
    const parentResult = await codeBlock.evaluate((el) => {
      let parentEl = el.parentElement;
      let level = 0;

      while (parentEl && level < 5) {
        // Get all headings within this parent
        const headings = parentEl.querySelectorAll('h1, h2, h3, h4, h5, h6');

        // Search backwards through headings (reverse order)
        for (let i = headings.length - 1; i >= 0; i--) {
          const heading = headings[i];

          // Check if heading comes BEFORE the code block in document order
          // DOCUMENT_POSITION_FOLLOWING = heading appears after code block = heading comes first
          if (heading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
            return {
              found: true,
              text: heading.textContent?.trim() || '',
              method: 'parent-search',
              level,
            };
          }
        }

        // Move up one level in the tree
        parentEl = parentEl.parentElement;
        level++;
      }
      return { found: false, text: '', method: 'parent-search', level };
    });

    if (parentResult.found) {
      const cleaned = cleanHeadingText(parentResult.text);
      log('findPrecedingHeading - found via parent search:', cleaned, `(${parentResult.level} levels up)`);
      return { section: cleaned, found: true };
    }

    log('findPrecedingHeading - no heading found');
    return { section: '', found: false };
  } catch (error) {
    log('findPrecedingHeading - error:', error);
    return { section: '', found: false };
  }
}

// =============================================================================
// Batch 5: Main Extraction
// =============================================================================

/**
 * Extract all code examples from the page with quality filtering
 *
 * PURPOSE: Main orchestrator that combines all extraction logic from Batches 1-4
 *
 * UPDATED: Now also extracts import patterns from ALL code blocks
 *
 * EXECUTION FLOW:
 *   1. Find all <pre> elements in <main> (Chakra's code block container)
 *   2. For each code block:
 *      a. Extract code text from nested <code> element
 *      b. Find preceding heading using findPrecedingHeading()
 *      c. Extract imports (ALWAYS, even if code will be filtered)
 *      d. Apply 3-stage filtering pipeline (see below)
 *      e. Extract language from class attribute (e.g., "language-tsx")
 *      f. Build CodeExample object with code, language, section
 *   3. Deduplicate examples using normalizeCode()
 *   4. Deduplicate import patterns by source+type
 *   5. Return filtered examples + import patterns
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
 *   Stage 3: Composition scoring
 *            Skip if score < 5 points
 *            (see getCompositionScore for scoring rubric)
 *
 * METRICS: Tracks counts for debugging:
 *   - excluded: Filtered by section
 *   - lowValue: Filtered by content heuristics
 *   - lowScore: Filtered by composition score
 *   - accepted: Passed all filters
 *
 * RETURN: Object containing:
 *   - examples: Deduplicated high-quality code examples
 *   - importPatterns: Imports from accepted examples only
 *   - allImportPatterns: Imports from ALL blocks (including filtered)
 */
async function extractCodeExamples(page: Page): Promise<{
  examples: CodeExample[];
  importPatterns: ImportPattern[];
  allImportPatterns: ImportPattern[];
}> {
  log('extractCodeExamples - starting extraction...');

  const main = page.locator('main');
  const codeBlocks = main.locator('pre');
  const count = await codeBlocks.count();

  log('extractCodeExamples - found', count, 'code blocks');

  const examples: CodeExample[] = [];
  const allImports: ImportPattern[] = [];      // From ALL blocks
  const acceptedImports: ImportPattern[] = []; // From accepted blocks only

  let filtered = {
    excluded: 0,   // Rejected due to section (Installation, Import, etc.)
    lowValue: 0,   // Rejected due to content heuristics
    lowScore: 0,   // Rejected due to composition score < 5
    accepted: 0,   // Passed all filters
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

    // Find preceding heading
    const { section, found } = await findPrecedingHeading(block);

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

    // Composition scoring
    const score = getCompositionScore(code);
    if (score < 5) {
      log(`extractCodeExamples - block ${i + 1}: FILTERED (score ${score} < 5)`);
      filtered.lowScore++;
      continue;
    }

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

    // Build code example object
    const example: CodeExample = { code };

    if (language) {
      example.language = language;
      log(`extractCodeExamples - block ${i + 1}: detected language: ${language}`);
    }
    if (section) {
      example.section = section;
    }

    examples.push(example);
    filtered.accepted++;
    log(`extractCodeExamples - block ${i + 1}: ACCEPTED (score ${score})`);
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

  console.log('\nTest 8: getCompositionScore - Low Score');
  const lowScoreCode = '<Button>Click</Button>';
  console.log('Result:', getCompositionScore(lowScoreCode));
  console.log('Expected: 2 (just JSX, below threshold of 5)');

  console.log('\nTest 9: getCompositionScore - High Score');
  const highScoreCode = `const Demo = () => {
  const [count, setCount] = useState(0);
  return (
    <Button onClick={() => setCount(count + 1)} aria-label="Increment">
      <Icon /> Count: {count}
    </Button>
  );
}`;
  console.log('Result:', getCompositionScore(highScoreCode));
  console.log('Expected: ≥5 (JSX+Function+Props+Hooks+Event+Accessibility = 13)');

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