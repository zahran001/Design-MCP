/**
 * Code quality analysis utilities
 * Scoring, filtering, classification logic
 *
 * EXTRACTED 2025-10-21: From extractors.ts Batch 2
 * Pure business logic - no Playwright dependencies
 */

/**
 * Composition score result with detailed breakdown
 *
 * Used to classify code examples by complexity
 */
export interface CompositionScoreResult {
  score: number;
  complexity: 'trivial' | 'basic' | 'intermediate' | 'advanced';
  breakdown: {
    jsx: number;
    props: number;
    functions: number;
    components: number;
    events: number;
    hooks: number;
    accessibility: number;
  };
}

/**
 * Score code block for composition quality
 *
 * PURPOSE: Classify code examples by complexity for downstream processing
 *
 * STRATEGY: Award points for complexity indicators
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
 * COMPLEXITY MAPPING:
 *   0-2 points  → trivial (basic JSX, shows API patterns)
 *   3-6 points  → basic (props + simple function)
 *   7-10 points → intermediate (hooks + events)
 *   11+ points  → advanced (full composition)
 *
 * EXAMPLES:
 *   "<Button variant="primary">Click</Button>"
 *   → Score: 2 (JSX only) → trivial → KEPT (shows API)
 *
 *   "const Demo = () => { return <Button colorScheme="blue">Click</Button> }"
 *   → Score: 5 (JSX + Function + Props) → basic → KEPT
 *
 *   "const Demo = () => { const [count, setCount] = useState(0); return <Button onClick={() => setCount(count + 1)} aria-label="Increment">Count: {count}</Button> }"
 *   → Score: 13 (JSX + Function + Props + Hooks + Event + Accessibility) → advanced → KEPT
 *
 * CHANGE: All examples now KEPT, just classified differently
 */
export function getCompositionScore(code: string): CompositionScoreResult {
  let score = 0;
  const breakdown = {
    jsx: 0,
    props: 0,
    functions: 0,
    components: 0,
    events: 0,
    hooks: 0,
    accessibility: 0,
  };

  // JSX/TSX usage: +2
  if (/<[A-Z]/.test(code)) {
    score += 2;
    breakdown.jsx = 2;
  }

  // Multiple props: +2
  if (/\w+={[^}]*}.*\w+={/.test(code)) {
    score += 2;
    breakdown.props = 2;
  }

  // Function definition: +3
  if (/(function|const)\s+\w+\s*=.*=>|function\s+\w+\s*\(/.test(code)) {
    score += 3;
    breakdown.functions = 3;
  }

  // Multiple components: +3
  const componentMatches = code.match(/<[A-Z]\w+/g) || [];
  if (componentMatches.length > 2) {
    score += 3;
    breakdown.components = 3;
  }

  // Event handlers: +1
  if (/on[A-Z]\w+={/.test(code)) {
    score += 1;
    breakdown.events = 1;
  }

  // Hooks (useState, etc.): +2
  if (/use[A-Z]\w+/.test(code)) {
    score += 2;
    breakdown.hooks = 2;
  }

  // Accessibility attributes: +2
  if (/(aria-|role=|alt=)/.test(code)) {
    score += 2;
    breakdown.accessibility = 2;
  }

  // Map score to complexity level
  const complexity: CompositionScoreResult['complexity'] =
    score >= 11 ? 'advanced' :
    score >= 7 ? 'intermediate' :
    score >= 3 ? 'basic' : 'trivial';

  return { score, complexity, breakdown };
}

/**
 * Check if code block is in an excluded section
 *
 * Sections like "Installation", "Import", etc. are low-value for learning
 * component patterns, so we skip code blocks in these sections.
 */
export function isInExcludedSection(sectionName: string): boolean {
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
 *
 * Filters out:
 * - Installation commands (npm install, yarn add)
 * - Bare import statements (< 3 lines, just imports)
 * - package.json snippets
 * - Config files (tsconfig.json, etc.)
 * - Bare JSX without function wrapper (< 5 lines)
 */
export function isLowValueCode(code: string): boolean {
  const trimmed = code.trim();
  const lines = trimmed.split('\n');
  const lineCount = lines.length;

  // Too short
  if (lineCount < 3) {
    return true;
  }

  // Installation commands
  if (/(npm|yarn|pnpm|bun) (install|add|i)/.test(trimmed)) {
    return true;
  }

  // Bare import statements
  if (lineCount <= 3 && /^import\s+.*from\s+['"]/.test(trimmed)) {
    return true;
  }

  // package.json snippets
  if (/["']dependencies["']|["']devDependencies["']/.test(trimmed)) {
    return true;
  }

  // Config files
  if (/["']compilerOptions["']|["']include["']/.test(trimmed)) {
    return true;
  }

  // Bare JSX without function wrapper (< 5 lines)
  if (lineCount < 5 && /^<[A-Z]/.test(trimmed) && !/^(function|const|export)/.test(trimmed)) {
    return true;
  }

  return false;
}
