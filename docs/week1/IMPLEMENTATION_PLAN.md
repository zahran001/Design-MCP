# Week 1 Implementation Plan

**Generated:** 2025-10-15
**Based on:** [CODE_BLOCK_EXPLORATION.md](CODE_BLOCK_EXPLORATION.md) findings
**Reference:** [../../WEEK1_IMPLEMENTATION.md](../../WEEK1_IMPLEMENTATION.md)

---

## Overview

This document provides a **step-by-step implementation roadmap** for Week 1, informed by our exploration of actual Chakra UI documentation structure.

### Implementation Order

We'll implement milestones in this order for maximum confidence:

1. ~~**Milestone D** - Page Context Detection~~ **[SKIPPED]** - See exploration findings below
2. **Milestone B** - Code Examples Extraction (core value, informed by exploration)
3. **Milestone C** - Props Table Extraction (complementary to code examples)
4. **Milestone A** - Crawler Resilience (polish after extraction works)
5. **Milestone E** - Error Logging (infrastructure for production)
6. **Milestone F** - Per-File Output (optional debugging aid)

**Rationale:** Start with high-value extraction features that we can test immediately, then add resilience and infrastructure.

---

### 📊 Milestone D Skipped - Exploration Findings

**Finding:** After exploring 7 Chakra UI components (Button, Input, Box, Dialog, Select, Skeleton, Stat), we discovered that **all component documentation is single-page**.

**URLs Found:**
- `https://chakra-ui.com/docs/components/button`
- `https://chakra-ui.com/docs/components/input`
- etc.

**Pattern:** All content (Usage, Examples, Props) exists as sections with heading IDs on a single page (e.g., `#usage`, `#examples`). There are **no separate** `/button/usage`, `/button/theming`, or `/button/migration` pages.

**Decision:** Skip `pageContext` field. The original Week 1 plan assumed multi-page documentation structure that doesn't exist in current Chakra UI.

**Future Consideration:** If multi-page docs are encountered (Chakra v4+ or other libraries), we can add this field in Week 2+ by parsing existing `sourceUrl` field without re-crawling.

**Reference:** See [CODE_BLOCK_EXPLORATION.md](CODE_BLOCK_EXPLORATION.md) for detailed findings.

---

## Pre-Implementation Setup

### 1. Update Schema First

All milestones depend on the schema, so update it before starting extraction work.

**File:** `src/schemas/RAGResultSchema.ts`

```typescript
import { z } from "zod";

// Code example schema
export const CodeExampleSchema = z.object({
  code: z.string().min(1),
  language: z.string().optional(),
  title: z.string().optional(),
  section: z.string().optional(),
});

export type CodeExample = z.infer<typeof CodeExampleSchema>;

// Prop schema
export const PropSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  defaultValue: z.string().optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

export type Prop = z.infer<typeof PropSchema>;

// Main component doc schema
export const ComponentDocSchema = z.object({
  componentName: z.string().min(1),
  sourceUrl: z.string().url(),
  description: z.string().min(1).optional(),

  // Code examples (Milestone B)
  codeExamples: z.array(CodeExampleSchema).optional(),

  // Related components (Milestone B)
  relatedComponents: z.array(z.string()).optional(),

  // Props (Milestone C)
  props: z.array(PropSchema).optional(),
});

export type ComponentDoc = z.infer<typeof ComponentDocSchema>;
```

**Test:** After updating, run `npm run build` to ensure no type errors.

---

## ~~Milestone D: Page Context Detection~~ [SKIPPED]

**Skipped** - See "Milestone D Skipped - Exploration Findings" section above.

---

## Milestone B: Code Examples Extraction

**Why second?** Core value proposition, informed by exploration findings.

### Strategy Based on Exploration

From [CODE_BLOCK_EXPLORATION.md](CODE_BLOCK_EXPLORATION.md):

**Key Findings:**
- ✅ HTML structure is consistent: `<div> → <pre> → <code>`
- ⚠️ Heading detection only 40% successful (use fallbacks)
- ✅ Can classify code blocks effectively
- ✅ 60% of blocks are high-value, 30% are low-value

**Approach:**
1. Find all `main pre code` elements
2. For each code block:
   - Get code text
   - Try to find preceding heading (fallback to empty string)
   - Classify code (skip low-value)
   - Score composition quality
   - Keep if score ≥ 5 OR has multi-component composition
3. Deduplicate by normalized code
4. Extract related components

### Implementation

**File:** `src/steps/0-extract-docs/extractors.ts`

Add these helper functions:

```typescript
import type { Page, Locator } from 'playwright';
import type { ComponentDoc, CodeExample, PageContext } from '../../schemas/RAGResultSchema.js';

/**
 * Find the heading that precedes a code block
 * Returns { section, found } where section is the heading text or empty string
 */
async function findPrecedingHeading(codeBlock: Locator): Promise<{ section: string; found: boolean }> {
  try {
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
          };
        }
        current = current.previousElementSibling;
        distance++;
      }
      return { found: false, text: '' };
    });

    if (siblingResult.found) {
      // Clean CSS class pollution from heading text
      const cleaned = cleanHeadingText(siblingResult.text);
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
            };
          }
        }
        parentEl = parentEl.parentElement;
        level++;
      }
      return { found: false, text: '' };
    });

    if (parentResult.found) {
      const cleaned = cleanHeadingText(parentResult.text);
      return { section: cleaned, found: true };
    }

    return { section: '', found: false };
  } catch (error) {
    return { section: '', found: false };
  }
}

/**
 * Clean CSS class pollution from heading text
 * Example: ".css-vfo6uh{...}Usage" → "Usage"
 */
function cleanHeadingText(text: string): string {
  // Remove CSS class definitions (pattern: .css-xxx{...})
  const cleaned = text.replace(/\.css-[a-z0-9]+\{[^}]*\}/gi, '');
  return cleaned.trim();
}

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
  return excluded.some(ex => lower.includes(ex));
}

/**
 * Check if code is low-value based on content heuristics
 */
function isLowValueCode(code: string): boolean {
  const trimmed = code.trim();
  const lines = trimmed.split('\n');

  // Skip if < 3 lines
  if (lines.length < 3) return true;

  // Skip installation commands
  if (/(npm|yarn|pnpm|bun) (install|add|i)/.test(trimmed)) return true;

  // Skip bare import statements
  if (lines.length <= 3 && /^import\s+.*from\s+['"]/.test(trimmed)) return true;

  // Skip package.json snippets
  if (/["']dependencies["']|["']devDependencies["']/.test(trimmed)) return true;

  // Skip config files
  if (/["']compilerOptions["']|["']include["']/.test(trimmed)) return true;

  // Skip bare JSX without function wrapper (< 5 lines)
  if (lines.length < 5 && /^<[A-Z]/.test(trimmed) && !/^(function|const|export)/.test(trimmed)) {
    return true;
  }

  return false;
}

/**
 * Score code block for composition quality
 * Higher score = more valuable for LLM training
 */
function getCompositionScore(code: string): number {
  let score = 0;

  // JSX/TSX usage: +2
  if (/<[A-Z]/.test(code)) score += 2;

  // Multiple props: +2
  if (/\w+={[^}]*}.*\w+={/.test(code)) score += 2;

  // Function definition: +3
  if (/(function|const)\s+\w+\s*=.*=>|function\s+\w+\s*\(/.test(code)) score += 3;

  // Multiple components: +3
  const componentMatches = code.match(/<[A-Z]\w+/g) || [];
  if (componentMatches.length > 2) score += 3;

  // Event handlers: +1
  if (/on[A-Z]\w+={/.test(code)) score += 1;

  // Hooks (useState, etc.): +2
  if (/use[A-Z]\w+/.test(code)) score += 2;

  // Accessibility attributes: +2
  if (/(aria-|role=|alt=)/.test(code)) score += 2;

  return score;
}

/**
 * Normalize code for deduplication
 * Removes comments, collapses whitespace, normalizes strings
 */
function normalizeCode(code: string): string {
  return code
    .replace(/\/\/.*$/gm, '') // Remove line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove block comments
    .replace(/["']([^"']+)["']/g, '""') // Normalize string literals
    .replace(/\s+/g, ' ') // Collapse whitespace
    .trim();
}

/**
 * Deduplicate code examples by normalized content
 */
function dedupeCodeExamples(examples: CodeExample[]): CodeExample[] {
  const seen = new Set<string>();
  const unique: CodeExample[] = [];

  for (const example of examples) {
    const normalized = normalizeCode(example.code);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(example);
    }
  }

  return unique;
}

/**
 * Extract component tags from code examples for related components tracking
 */
function detectRelatedComponents(componentName: string, codeExamples: CodeExample[]): string[] {
  const found = new Set<string>();

  for (const example of codeExamples) {
    // Find JSX tags like <Button>, <Input>
    const tagPattern = /<([A-Z][A-Za-z0-9]*)/g;
    const matches = example.code.matchAll(tagPattern);

    for (const match of matches) {
      const tag = match[1];
      // Don't include the component itself
      if (tag !== componentName) {
        found.add(tag);
      }
    }
  }

  return Array.from(found).sort();
}

/**
 * Extract all code examples from the page with quality filtering
 */
async function extractCodeExamples(page: Page): Promise<CodeExample[]> {
  const main = page.locator('main');
  const codeBlocks = main.locator('pre');
  const count = await codeBlocks.count();

  const examples: CodeExample[] = [];

  for (let i = 0; i < count; i++) {
    const block = codeBlocks.nth(i);

    // Get code text
    const codeElement = block.locator('code').first();
    const code = (await codeElement.textContent())?.trim() || '';

    if (!code) continue;

    // Find preceding heading
    const { section, found } = await findPrecedingHeading(block);

    // Section-based filtering
    if (found && isInExcludedSection(section)) {
      continue; // Skip code in Installation, Import, etc. sections
    }

    // Content heuristics filtering
    if (isLowValueCode(code)) {
      continue; // Skip installation commands, bare imports, etc.
    }

    // Composition scoring
    const score = getCompositionScore(code);
    if (score < 5) {
      continue; // Skip low-composition-value code
    }

    // Extract language from class attribute if present
    const language = await codeElement.evaluate((el) => {
      const classes = el.className || '';
      const match = classes.match(/language-(\w+)/);
      return match ? match[1] : undefined;
    });

    // Build code example object
    const example: CodeExample = { code };

    if (language) example.language = language;
    if (section) example.section = section;

    examples.push(example);
  }

  // Deduplicate
  return dedupeCodeExamples(examples);
}
```

### Update `extractComponent()` for Code Examples

```typescript
export async function extractComponent(page: Page, url: string): Promise<ComponentDoc | null> {
  const main = page.locator("main");
  if (!(await main.count())) return null;

  const componentName = (await main.locator("h1").first().textContent())?.trim() || "";
  if (!componentName) return null;

  // Description (existing logic)
  const firstParaAfterH1 = main.locator("h1 + p");
  let description = (await firstParaAfterH1.first().textContent())?.trim() || "";

  if (!description) {
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

  // NEW: Extract code examples
  const codeExamples = await extractCodeExamples(page);

  // NEW: Detect related components
  const relatedComponents = detectRelatedComponents(componentName, codeExamples);

  // Build doc
  const doc: ComponentDoc = {
    componentName,
    sourceUrl: url,
  };

  if (description) doc.description = description;
  if (codeExamples.length > 0) doc.codeExamples = codeExamples;
  if (relatedComponents.length > 0) doc.relatedComponents = relatedComponents;

  // Must have at least description OR codeExamples to be useful
  if (!doc.description && !doc.codeExamples) return null;

  return doc;
}
```

### Test Milestone B

```bash
npm run build
npm run cli -- 0-extract-docs -m 5
```

**Verify in output:**
- ✅ Code examples extracted (check `out/docs.jsonl`)
- ✅ Low-value code filtered out (no bare imports, installation commands)
- ✅ High-quality examples kept (function definitions, composition)
- ✅ Related components detected (e.g., Dialog should show Portal, Button, etc.)
- ✅ Average 5-15 code examples per component (not 18-27)

---

## Milestone C: Props Table Extraction

**Why third?** Complementary to code examples, similar extraction patterns.

### Strategy

From exploration and Week 1 plan:
- Detect props tables by header pattern (must have "prop/name" AND "type")
- Dynamic column mapping (don't assume order)
- Detect required props (asterisks, "required" text)
- Dedupe within page

### Implementation

**File:** `src/steps/0-extract-docs/extractors.ts`

Add these functions:

```typescript
import type { Prop } from '../../schemas/RAGResultSchema.js';

/**
 * Normalize table cell text (remove extra whitespace, newlines)
 */
function normalizeCell(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Check if prop is marked as required
 * Looks for asterisks (*) or "required" text
 */
function isRequired(nameCell: string, typeCell: string): boolean {
  const combined = `${nameCell} ${typeCell}`.toLowerCase();
  return combined.includes('*') || combined.includes('required');
}

/**
 * Clean prop name by removing required indicators
 */
function cleanPropName(name: string): string {
  return name.replace(/\*/g, '').trim();
}

/**
 * Detect if a table is a props table
 * Must have columns for "prop/name" AND "type"
 */
async function isPropsTable(table: Locator): Promise<{ isProps: boolean; columnMap: Map<string, number> }> {
  const columnMap = new Map<string, number>();

  try {
    // Get header row
    const headerCells = table.locator('thead th, thead td');
    const headerCount = await headerCells.count();

    if (headerCount === 0) return { isProps: false, columnMap };

    // Parse header to build column map
    for (let i = 0; i < headerCount; i++) {
      const headerText = ((await headerCells.nth(i).textContent()) || '').toLowerCase().trim();

      if (headerText.includes('prop') || headerText.includes('name')) {
        columnMap.set('name', i);
      } else if (headerText.includes('type')) {
        columnMap.set('type', i);
      } else if (headerText.includes('default')) {
        columnMap.set('default', i);
      } else if (headerText.includes('description')) {
        columnMap.set('description', i);
      }
    }

    // Must have at least name and type columns
    const hasNameCol = columnMap.has('name');
    const hasTypeCol = columnMap.has('type');

    return { isProps: hasNameCol && hasTypeCol, columnMap };
  } catch (error) {
    return { isProps: false, columnMap };
  }
}

/**
 * Extract props from a single table
 */
async function extractPropsFromTable(table: Locator, columnMap: Map<string, number>): Promise<Prop[]> {
  const props: Prop[] = [];

  try {
    const rows = table.locator('tbody tr');
    const rowCount = await rows.count();

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const cells = row.locator('td');
      const cellCount = await cells.count();

      if (cellCount === 0) continue;

      // Extract cell values based on column map
      const nameIdx = columnMap.get('name');
      const typeIdx = columnMap.get('type');
      const defaultIdx = columnMap.get('default');
      const descIdx = columnMap.get('description');

      if (nameIdx === undefined || typeIdx === undefined) continue;

      const nameCell = normalizeCell((await cells.nth(nameIdx).textContent()) || '');
      const typeCell = normalizeCell((await cells.nth(typeIdx).textContent()) || '');

      if (!nameCell || !typeCell) continue;

      // Build prop object
      const prop: Prop = {
        name: cleanPropName(nameCell),
        type: typeCell,
      };

      // Optional fields
      if (defaultIdx !== undefined) {
        const defaultValue = normalizeCell((await cells.nth(defaultIdx).textContent()) || '');
        if (defaultValue && defaultValue !== '-' && defaultValue !== 'none') {
          prop.defaultValue = defaultValue;
        }
      }

      if (descIdx !== undefined) {
        const description = normalizeCell((await cells.nth(descIdx).textContent()) || '');
        if (description) {
          prop.description = description;
        }
      }

      // Detect if required
      const required = isRequired(nameCell, typeCell);
      if (required) {
        prop.required = true;
      }

      props.push(prop);
    }
  } catch (error) {
    // Skip table on error
  }

  return props;
}

/**
 * Deduplicate props by name, merging data
 * Merge strategy:
 * - Type: prefer longer (more specific union types)
 * - Description: prefer non-empty, first wins
 * - Default: prefer non-empty
 * - Required: logical OR
 */
function dedupeProps(props: Prop[]): Prop[] {
  const propMap = new Map<string, Prop>();

  for (const prop of props) {
    const existing = propMap.get(prop.name);

    if (!existing) {
      propMap.set(prop.name, { ...prop });
    } else {
      // Merge: prefer longer type
      if (prop.type.length > existing.type.length) {
        existing.type = prop.type;
      }

      // Merge: prefer non-empty description (first wins)
      if (prop.description && !existing.description) {
        existing.description = prop.description;
      }

      // Merge: prefer non-empty default
      if (prop.defaultValue && !existing.defaultValue) {
        existing.defaultValue = prop.defaultValue;
      }

      // Merge: logical OR for required
      if (prop.required) {
        existing.required = true;
      }
    }
  }

  return Array.from(propMap.values());
}

/**
 * Extract all props from all props tables on the page
 */
async function extractProps(page: Page): Promise<Prop[]> {
  const main = page.locator('main');
  const tables = main.locator('table');
  const tableCount = await tables.count();

  const allProps: Prop[] = [];

  for (let i = 0; i < tableCount; i++) {
    const table = tables.nth(i);

    // Check if this is a props table
    const { isProps, columnMap } = await isPropsTable(table);

    if (!isProps) continue;

    // Extract props from this table
    const tableProps = await extractPropsFromTable(table, columnMap);
    allProps.push(...tableProps);
  }

  // Deduplicate across all tables on the page
  return dedupeProps(allProps);
}
```

### Update `extractComponent()` for Props

```typescript
export async function extractComponent(page: Page, url: string): Promise<ComponentDoc | null> {
  const main = page.locator("main");
  if (!(await main.count())) return null;

  const componentName = (await main.locator("h1").first().textContent())?.trim() || "";
  if (!componentName) return null;

  // Description
  const firstParaAfterH1 = main.locator("h1 + p");
  let description = (await firstParaAfterH1.first().textContent())?.trim() || "";

  if (!description) {
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

  // Code examples
  const codeExamples = await extractCodeExamples(page);
  const relatedComponents = detectRelatedComponents(componentName, codeExamples);

  // NEW: Extract props
  const props = await extractProps(page);

  // Build doc
  const doc: ComponentDoc = {
    componentName,
    sourceUrl: url,
  };

  if (description) doc.description = description;
  if (codeExamples.length > 0) doc.codeExamples = codeExamples;
  if (relatedComponents.length > 0) doc.relatedComponents = relatedComponents;
  if (props.length > 0) doc.props = props;

  // Must have at least description OR codeExamples OR props
  if (!doc.description && !doc.codeExamples && !doc.props) return null;

  return doc;
}
```

### Test Milestone C

```bash
npm run build
npm run cli -- 0-extract-docs -m 5
```

**Verify in output:**
- ✅ Props extracted from tables
- ✅ Required props detected
- ✅ Duplicate props merged (check Button component)
- ✅ Type unions preserved (e.g., `"sm" | "md" | "lg"`)
- ✅ Description and default values captured

---

## Testing Milestones B + C Together

At this point, you have core extraction working. Test with more pages:

```bash
npm run build
npm run cli -- 0-extract-docs -m 10
```

**Expected output in `out/docs.jsonl`:**
- 10 component docs
- Most have `description`
- Most have `codeExamples` (5-15 each)
- Most have `props` (10-20 each)
- Some have `relatedComponents`

**Quality check manually:**
- Open `out/docs.jsonl`
- Find Button component
- Verify code examples are high-quality (not just imports)
- Verify props are correct
- Verify related components make sense

---

## Next Steps

After Milestones B, C, and D are working:

1. **Milestone A** - Add crawler resilience (throttling, retries, circuit breaker)
2. **Milestone E** - Add error logging infrastructure
3. **Milestone F** - Add per-file output option

Would you like me to continue with the implementation plans for Milestones A, E, and F?

---

## Quick Reference: Function Call Order

When `extractComponent()` is called:

1. ✅ Extract component name and description (existing)
2. ✅ Extract code examples (Milestone B)
   - Find code blocks
   - Filter by section
   - Filter by content heuristics
   - Score composition
   - Deduplicate
3. ✅ Detect related components (Milestone B)
4. ✅ Extract props (Milestone C)
   - Find props tables
   - Map columns dynamically
   - Parse rows
   - Deduplicate
5. ✅ Return complete `ComponentDoc`

---

## Debugging Tips

**If code examples aren't extracted:**
- Check console for errors in `extractCodeExamples()`
- Lower the composition score threshold temporarily (try 3 instead of 5)
- Comment out section-based filtering to see all code blocks

**If props aren't extracted:**
- Check if tables exist on the page (manually inspect)
- Print `isPropsTable()` results to see if detection works
- Check column header text matches patterns

**If related components are empty:**
- Check if code examples have JSX tags
- Print matched tags to console in `detectRelatedComponents()`

---

**Ready to implement?** Start with updating the schema, then Milestone D (simplest), then B and C together.
