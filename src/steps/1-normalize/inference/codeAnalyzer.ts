// =============================================================================
// Code Analysis Utility
// =============================================================================
// Created: 2025-10-22
// Reference: NORMALIZATION_GUIDE.md - Phase 1 POC
//
// Extracts structural information from code examples:
// - Import statements
// - JSX components used
// - Prop usage patterns
// - React hooks
// - Event handlers
//
// This provides the raw material for inference and template generation.
//
// =============================================================================

/**
 * Import statement extracted from code
 */
export interface ImportStatement {
  source: string;      // Package name (e.g., "@chakra-ui/react")
  imports: string[];   // Imported items (e.g., ["Button", "HStack"])
}

/**
 * Prop usage pattern extracted from JSX
 */
export interface PropUsage {
  component: string;   // Component name (e.g., "Button", "HStack")
  prop: string;        // Prop name (e.g., "size", "variant")
  values: string[];    // All values found for this prop (e.g., ["xs", "sm", "md"])
}

/**
 * Complete code analysis result
 */
export interface CodeAnalysis {
  imports: ImportStatement[];
  components: string[];         // All JSX components found
  props: PropUsage[];           // All prop usage patterns
  hooks: string[];              // React hooks used
  eventHandlers: string[];      // Event handler names (onClick, onChange, etc.)
  hasInteractivity: boolean;    // Has event handlers?
  hasState: boolean;            // Uses state hooks?
}

/**
 * Analyze code structure and extract key information
 *
 * @param code - Source code to analyze
 * @returns Structured analysis of the code
 *
 * @example
 * const code = `
 *   import { Button, HStack } from "@chakra-ui/react"
 *
 *   const Demo = () => {
 *     return (
 *       <HStack gap="6">
 *         <Button size="xs">Small</Button>
 *         <Button size="sm">Medium</Button>
 *       </HStack>
 *     )
 *   }
 * `;
 *
 * const analysis = analyzeCode(code);
 * // Returns: {
 * //   imports: [{ source: "@chakra-ui/react", imports: ["Button", "HStack"] }],
 * //   components: ["HStack", "Button"],
 * //   props: [
 * //     { component: "HStack", prop: "gap", values: ["6"] },
 * //     { component: "Button", prop: "size", values: ["xs", "sm"] }
 * //   ],
 * //   hooks: [],
 * //   eventHandlers: [],
 * //   hasInteractivity: false,
 * //   hasState: false
 * // }
 */
export function analyzeCode(code: string): CodeAnalysis {
  // Extract imports
  const imports = extractImports(code);

  // Extract JSX components
  const components = extractComponents(code);

  // Extract prop usage
  const props = extractProps(code);

  // Extract hooks
  const hooks = extractHooks(code);

  // Extract event handlers from props
  const eventHandlers = props
    .filter(p => p.prop.startsWith('on') && p.prop[2] === p.prop[2].toUpperCase())
    .map(p => p.prop);

  // Deduplicate event handlers
  const uniqueHandlers = Array.from(new Set(eventHandlers));

  return {
    imports,
    components,
    props,
    hooks,
    eventHandlers: uniqueHandlers,
    hasInteractivity: uniqueHandlers.length > 0,
    hasState: hooks.some(h => h === 'useState' || h === 'useReducer')
  };
}

/**
 * Extract import statements from code
 *
 * Matches patterns like:
 * - import { Button, HStack } from "@chakra-ui/react"
 * - import { useState } from "react"
 *
 * @param code - Source code
 * @returns Array of import statements
 */
function extractImports(code: string): ImportStatement[] {
  // Regex: import { imports } from "source"
  const regex = /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g;
  const results: ImportStatement[] = [];
  let match;

  while ((match = regex.exec(code)) !== null) {
    const imports = match[1]
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    results.push({
      source: match[2],
      imports
    });
  }

  return results;
}

/**
 * Extract JSX component names from code
 *
 * Matches opening tags like:
 * - <Button>
 * - <HStack>
 * - <Checkbox.Root>
 *
 * @param code - Source code
 * @returns Array of unique component names
 */
function extractComponents(code: string): string[] {
  // Regex: <ComponentName or <Component.SubComponent
  const regex = /<([A-Z]\w+(?:\.\w+)*)/g;
  const components = new Set<string>();
  let match;

  while ((match = regex.exec(code)) !== null) {
    components.add(match[1]);
  }

  return Array.from(components);
}

/**
 * Extract prop usage patterns from JSX
 *
 * Matches patterns like:
 * - <Button size="xs">
 * - <HStack gap="6">
 * - <Button onClick={handleClick}>
 *
 * Groups by component.prop and collects all values
 *
 * @param code - Source code
 * @returns Array of prop usage patterns
 */
function extractProps(code: string): PropUsage[] {
  const propMap = new Map<string, Set<string>>();

  // First, find all opening tags with props
  // Matches: <ComponentName props...>
  const tagRegex = /<(\w+(?:\.\w+)*)\s+([^>]+)>/g;
  let tagMatch;

  while ((tagMatch = tagRegex.exec(code)) !== null) {
    const component = tagMatch[1];
    const propsString = tagMatch[2];

    // Extract all props from this tag's prop string
    // Matches: propName="value" or propName={value} or propName (boolean)
    const propRegex = /(\w+)(?:=(?:{([^}]+)}|"([^"]+)"|'([^']+)'))?/g;
    let propMatch;

    while ((propMatch = propRegex.exec(propsString)) !== null) {
      const prop = propMatch[1];
      const value = propMatch[2] || propMatch[3] || propMatch[4] || '';

      // Skip if this looks like a closing tag marker or other non-prop text
      if (prop === 'wrap' && !value && propsString.includes('wrap="wrap"')) {
        continue;
      }

      const key = `${component}.${prop}`;

      if (!propMap.has(key)) {
        propMap.set(key, new Set());
      }

      // Add value if not empty
      if (value.trim().length > 0) {
        propMap.get(key)!.add(value.trim());
      }
    }
  }

  // Convert map to array
  return Array.from(propMap.entries()).map(([key, values]) => {
    const [component, prop] = key.split('.');
    return {
      component,
      prop,
      values: Array.from(values)
    };
  });
}

/**
 * Extract React hooks from code
 *
 * Matches hook calls like:
 * - useState(
 * - useEffect(
 * - useCallback(
 *
 * @param code - Source code
 * @returns Array of unique hook names
 */
function extractHooks(code: string): string[] {
  // Regex: use[A-Z]hookName(
  const regex = /\b(use[A-Z]\w+)\s*\(/g;
  const hooks = new Set<string>();
  let match;

  while ((match = regex.exec(code)) !== null) {
    hooks.add(match[1]);
  }

  return Array.from(hooks);
}
