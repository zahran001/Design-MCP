// =============================================================================
// Week 1 Extractors - Component Documentation
// =============================================================================
// Updated: 2025-10-15
// Reference: docs/week1/IMPLEMENTATION_PLAN.md
//
// This file contains extraction logic for Chakra UI component documentation.
// Implements Milestone B (Code Examples) and Milestone C (Props Tables).
// =============================================================================

import type { Page } from 'playwright';
import type { ComponentDoc, CodeExample } from '../../schemas/RAGResultSchema.js';

// Enable debug logging (set to false in production)
const DEBUG = process.env.DEBUG === 'true';

function log(...args: any[]) {
  if (DEBUG) console.log('[extractors]', ...args);
}

// =============================================================================
// Batch 1: Text Processing Utilities
// =============================================================================

/**
 * Clean CSS class pollution from heading text
 * Example: ".css-vfo6uh{color:...}Usage" → "Usage"
 */
function cleanHeadingText(text: string): string {
  log('cleanHeadingText - input:', text);

  // Remove CSS class definitions (pattern: .css-xxx{...})
  const cleaned = text.replace(/\.css-[a-z0-9]+\{[^}]*\}/gi, '').trim();

  log('cleanHeadingText - output:', cleaned);
  return cleaned;
}

/**
 * Normalize code for deduplication
 * Removes comments, collapses whitespace, normalizes strings
 */
function normalizeCode(code: string): string {
  log('normalizeCode - input length:', code.length);

  const normalized = code
    .replace(/\/\/.*$/gm, '') // Remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/["']([^"']+)["']/g, '""') // Normalize string literals
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();

  log('normalizeCode - output length:', normalized.length);
  log('normalized code preview:', normalized.slice(0, 100) + (normalized.length > 100 ? '...' : ''));
  return normalized;
}

/**
 * Extract component tags from code examples
 * Finds JSX tags like <Button>, <Input>, etc.
 */
function extractComponentTags(code: string): string[] {
  log('extractComponentTags - analyzing code...');

  const tagPattern = /<([A-Z][A-Za-z0-9]*)/g;
  const found = new Set<string>();

  const matches = code.matchAll(tagPattern);
  for (const match of matches) {
    found.add(match[1]);
  }

  const tags = Array.from(found).sort();
  log('extractComponentTags - found tags:', tags);

  return tags;
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
 * Higher score = more valuable for LLM training
 * Threshold: ≥5 points to keep
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

// =============================================================================
// Batch 4: Playwright Interaction
// =============================================================================

/**
 * Find the heading that precedes a code block
 * Returns { section, found } where section is the heading text or empty string
 *
 * From exploration: Only 40% success rate, so we use multiple strategies with fallbacks
 */
async function findPrecedingHeading(codeBlock: Page['locator'] extends (...args: any[]) => infer R ? R : never): Promise<{ section: string; found: boolean }> {
  try {
    log('findPrecedingHeading - searching for heading...');

    // Strategy 1: Walk backwards through siblings (up to 20 elements)
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
    const parentResult = await codeBlock.evaluate((el) => {
      let parentEl = el.parentElement;
      let level = 0;

      while (parentEl && level < 5) {
        const headings = parentEl.querySelectorAll('h1, h2, h3, h4, h5, h6');
        for (let i = headings.length - 1; i >= 0; i--) {
          const heading = headings[i];
          if (heading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
            return {
              found: true,
              text: heading.textContent?.trim() || '',
              method: 'parent-search',
              level,
            };
          }
        }
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
 * Main orchestrator function that uses all helpers from Batches 1-4
 */
async function extractCodeExamples(page: Page): Promise<CodeExample[]> {
  log('extractCodeExamples - starting extraction...');

  const main = page.locator('main');
  const codeBlocks = main.locator('pre');
  const count = await codeBlocks.count();

  log('extractCodeExamples - found', count, 'code blocks');

  const examples: CodeExample[] = [];
  let filtered = {
    excluded: 0,
    lowValue: 0,
    lowScore: 0,
    accepted: 0,
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

  // Deduplicate
  const deduped = dedupeCodeExamples(examples);

  log('extractCodeExamples - complete:', deduped.length, 'examples extracted');
  return deduped;
}

// =============================================================================
// Batch 6: Integration (Updated extractComponent)
// =============================================================================

/**
 * Extract component documentation from a page
 * Updated to include code examples and related components (Milestone B)
 */
export async function extractComponent(page: Page, url: string): Promise<ComponentDoc | null> {
  log('extractComponent - starting for URL:', url);

  // main content region (Chakra uses <main> for docs)
  const main = page.locator("main");
  if (!(await main.count())) {
    log('extractComponent - no <main> element found');
    return null;
  }

  // Title (component name)
  const componentName =
    (await main.locator("h1").first().textContent())?.trim() || "";
  if (!componentName) {
    log('extractComponent - no component name found');
    return null;
  }

  log('extractComponent - component:', componentName);

  // Description: first paragraph after h1; fallback to first non-empty <p> in main
  const firstParaAfterH1 = main.locator("h1 + p");
  let description =
    (await firstParaAfterH1.first().textContent())?.trim() || "";

  if (!description) {
    // fallback: first non-empty paragraph in main
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

  // NEW (Milestone B): Extract code examples
  const codeExamples = await extractCodeExamples(page);
  log('extractComponent - code examples extracted:', codeExamples.length);

  // NEW (Milestone B): Detect related components
  const relatedComponents = detectRelatedComponents(componentName, codeExamples);
  log('extractComponent - related components:', relatedComponents);

  // Build doc with all fields
  const doc: ComponentDoc = {
    componentName,
    sourceUrl: url,
  };

  if (description) {
    doc.description = description;
  }

  if (codeExamples.length > 0) {
    doc.codeExamples = codeExamples;
  }

  if (relatedComponents.length > 0) {
    doc.relatedComponents = relatedComponents;
  }

  // Must have at least description OR codeExamples to be useful
  const hasUseful = Boolean(doc.description || doc.codeExamples);
  if (!hasUseful) {
    log('extractComponent - no useful content found');
    return null;
  }

  log('extractComponent - complete:', {
    componentName,
    hasDescription: !!doc.description,
    codeExamplesCount: codeExamples.length,
    relatedComponentsCount: relatedComponents.length,
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
  console.log('\n✅ All tests complete! Review results above.\n');
}