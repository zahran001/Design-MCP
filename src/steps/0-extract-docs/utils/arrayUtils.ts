/**
 * Array processing utilities
 * Deduplication and relationship detection
 *
 * EXTRACTED 2025-10-21: From extractors.ts Batch 3
 * Pure array operations - no side effects
 */

import type { CodeExample, ImportPattern } from '../../../schemas/RAGResultSchema.js';
import { normalizeCode } from './textProcessors.js';
import { extractComponentTags } from './textProcessors.js';

/**
 * Deduplicate code examples by normalized content
 *
 * Uses normalizeCode() to detect semantic duplicates:
 * - Same structure but different comments → deduplicated
 * - Same structure but different string content → deduplicated
 * - Same structure but different whitespace → deduplicated
 *
 * Example:
 *   Input: [
 *     { code: "const x = 1; // comment A" },
 *     { code: "const x = 1; // comment B" }  // Different comment
 *   ]
 *   Output: [
 *     { code: "const x = 1; // comment A" }  // First one kept
 *   ]
 */
export function dedupeCodeExamples(examples: CodeExample[]): CodeExample[] {
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
 * Detect related components from code examples
 *
 * Parses JSX tags from all code examples to find which components
 * are used together. This builds a component relationship graph.
 *
 * Returns sorted list of component names (excludes the component itself)
 *
 * Example:
 *   componentName: "Button"
 *   codeExamples: [
 *     { code: "<Button><Icon /></Button>" },
 *     { code: "<Form><Input /><Button /></Form>" }
 *   ]
 *   Returns: ["Form", "Icon", "Input"]  // "Button" excluded
 */
export function detectRelatedComponents(
  componentName: string,
  codeExamples: CodeExample[]
): string[] {
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

  return Array.from(found).sort();
}

/**
 * Deduplicate import patterns by source and type
 *
 * Merges imports from the same package to reduce redundancy.
 *
 * Groups by: source + type (e.g., "react:named")
 * Merges: import lists
 * Result: Single entry per source+type with combined imports
 *
 * Example:
 *   Input: [
 *     { source: 'react', imports: ['useState'], type: 'named' },
 *     { source: 'react', imports: ['useEffect'], type: 'named' }
 *   ]
 *   Output: [
 *     { source: 'react', imports: ['useEffect', 'useState'], type: 'named' }
 *   ]
 */
export function dedupeImportPatterns(patterns: ImportPattern[]): ImportPattern[] {
  const map = new Map<string, ImportPattern>();

  for (const pattern of patterns) {
    // Key: source + type (section is intentionally excluded for grouping)
    const key = `${pattern.source}:${pattern.type}`;
    const existing = map.get(key);

    if (existing) {
      // Merge imports from same source+type
      const combinedImports = new Set([...existing.imports, ...pattern.imports]);
      existing.imports = Array.from(combinedImports).sort();

      // Keep section if present (use first one encountered)
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

  return Array.from(map.values());
}
