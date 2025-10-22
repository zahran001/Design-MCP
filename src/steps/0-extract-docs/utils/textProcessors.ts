/**
 * Pure text processing utilities
 * No dependencies, easily testable
 *
 * EXTRACTED 2025-10-21: From extractors.ts Batch 1
 * These functions have no side effects and don't depend on Playwright
 */

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
export function cleanHeadingText(text: string): string {
  // Remove CSS class definitions (pattern: .css-xxx{...})
  // Regex breakdown: \.css-[a-z0-9]+ matches class name, \{[^}]*\} matches style rules
  return text.replace(/\.css-[a-z0-9]+\{[^}]*\}/gi, '').trim();
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
export function normalizeCode(code: string): string {
  return code
    .replace(/\/\/.*$/gm, '')             // Remove line comments (// ...)
    .replace(/\/\*[\s\S]*?\*\//g, '')     // Remove block comments
    .replace(/["']([^"']+)["']/g, '""')   // Normalize all strings to ""
    .replace(/\s+/g, ' ')                 // Collapse whitespace
    .trim();
}

/**
 * Extract React component tags from JSX code
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
export function extractComponentTags(code: string): string[] {
  const tagPattern = /<([A-Z][A-Za-z0-9]*)/g;
  const found = new Set<string>();

  const matches = code.matchAll(tagPattern);
  for (const match of matches) {
    found.add(match[1]);  // match[1] is the captured component name
  }

  return Array.from(found).sort();
}
