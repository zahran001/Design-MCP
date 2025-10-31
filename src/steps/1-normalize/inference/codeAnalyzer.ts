// =============================================================================
// Code Analysis Utility
// =============================================================================
// Created: 2025-10-22
// Updated: 2025-10-27 (Stage 3: Enhanced pattern matching integration)
// Reference: NORMALIZATION_GUIDE.md - Phase 1 POC
//
// Extracts structural information from code examples:
// - Import statements (all types: named, default, namespace, mixed)
// - JSX components used
// - Prop usage patterns with value metadata
// - React hooks
// - Event handlers
// - Composite component relationships
//
// This provides the raw material for inference and template generation.
//
// =============================================================================

import {
  type EnhancedImport,
  type PropValue,
  extractAllImports,
  extractPropValue,
  parseCompositeComponent,
  hasSpreadProps,
  filterEventHandlers,
  extractPropNames
} from './patternMatchers.js';

// Re-export types for external use
export type { EnhancedImport, PropValue };

/**
 * Import statement extracted from code
 * @deprecated Use EnhancedImport for better type support
 */
export interface ImportStatement {
  source: string;      // Package name (e.g., "@chakra-ui/react")
  imports: string[];   // Imported items (e.g., ["Button", "HStack"])
}

/**
 * Prop usage pattern extracted from JSX with value metadata
 */
export interface PropUsage {
  component: string;        // Component name (e.g., "Button", "HStack")
  prop: string;             // Prop name (e.g., "size", "variant")
  values: PropValue[];      // All values found with metadata
  rawValues?: string[];     // Legacy: raw string values (for backward compatibility)
}

/**
 * Composite component structure
 */
export interface CompositeInfo {
  base: string;             // Base component (e.g., "Checkbox" in "Checkbox.Root")
  subcomponents: string[];  // All subcomponents found (e.g., ["Root", "Label", "Control"])
}

/**
 * Complete code analysis result
 */
export interface CodeAnalysis {
  imports: EnhancedImport[];        // Enhanced import statements with type info
  components: string[];             // All JSX components found
  props: PropUsage[];               // All prop usage patterns with metadata
  hooks: string[];                  // React hooks used
  eventHandlers: string[];          // Event handler names (onClick, onChange, etc.)
  hasInteractivity: boolean;        // Has event handlers?
  hasState: boolean;                // Uses state hooks?
  hasSpreadProps: boolean;          // Uses spread operator in props?
  compositeComponents: CompositeInfo[]; // Composite component relationships
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
 * //   imports: [{ source: "@chakra-ui/react", type: "named", namedImports: ["Button", "HStack"] }],
 * //   components: ["HStack", "Button"],
 * //   props: [
 * //     { component: "HStack", prop: "gap", values: [{raw: "6", normalized: "6", isDynamic: false, isTemplateLiteral: false}] },
 * //     { component: "Button", prop: "size", values: [{raw: "xs", ...}, {raw: "sm", ...}] }
 * //   ],
 * //   hooks: [],
 * //   eventHandlers: [],
 * //   hasInteractivity: false,
 * //   hasState: false,
 * //   hasSpreadProps: false,
 * //   compositeComponents: []
 * // }
 */
export function analyzeCode(code: string): CodeAnalysis {
  // Extract imports using enhanced pattern matching
  const imports = extractAllImports(code);

  // Extract JSX components
  const components = extractComponents(code);

  // Extract prop usage with enhanced value metadata
  const props = extractPropsEnhanced(code);

  // Extract hooks
  const hooks = extractHooks(code);

  // Extract event handler names from props
  const propNames = props.map(p => p.prop);
  const eventHandlers = filterEventHandlers(propNames);

  // Detect spread props usage
  const spreadPropsDetected = hasSpreadProps(code);

  // Detect composite component structures
  const compositeComponents = detectCompositeComponents(components);

  return {
    imports,
    components,
    props,
    hooks,
    eventHandlers,
    hasInteractivity: eventHandlers.length > 0,
    hasState: hooks.some(h => h === 'useState' || h === 'useReducer'),
    hasSpreadProps: spreadPropsDetected,
    compositeComponents
  };
}

/**
 * Detect composite component structures
 *
 * Groups components like Checkbox.Root, Checkbox.Label, Checkbox.Control
 * into a single composite structure
 *
 * @param components - Array of component names
 * @returns Array of composite component info
 */
function detectCompositeComponents(components: string[]): CompositeInfo[] {
  const compositeMap = new Map<string, Set<string>>();

  for (const component of components) {
    const composite = parseCompositeComponent(component);

    if (composite) {
      if (!compositeMap.has(composite.base)) {
        compositeMap.set(composite.base, new Set());
      }
      compositeMap.get(composite.base)!.add(composite.sub);
    }
  }

  return Array.from(compositeMap.entries()).map(([base, subs]) => ({
    base,
    subcomponents: Array.from(subs)
  }));
}

/**
 * Extract prop usage patterns with enhanced value metadata
 *
 * Uses enhanced pattern matching to extract:
 * - Static string values: size="md"
 * - Dynamic expressions: variant={buttonVariant}
 * - Template literals: className={`btn-${size}`}
 * - Boolean props: disabled
 *
 * @param code - Source code
 * @returns Array of prop usage patterns with metadata
 */
function extractPropsEnhanced(code: string): PropUsage[] {
  const propMap = new Map<string, PropValue[]>();

  // Find all opening tags with props
  const tagRegex = /<(\w+(?:\.\w+)*)\s+([^>]+)>/g;
  let tagMatch;

  while ((tagMatch = tagRegex.exec(code)) !== null) {
    const component = tagMatch[1];
    const propsString = tagMatch[2];

    // Extract prop names first
    const propNames = extractPropNames(propsString);

    // For each prop, extract its value with metadata
    for (const propName of propNames) {
      const propValue = extractPropValue(propsString, propName);

      if (propValue) {
        const key = `${component}.${propName}`;

        if (!propMap.has(key)) {
          propMap.set(key, []);
        }

        // Only add if not already present (check by raw value)
        const existing = propMap.get(key)!;
        if (!existing.some(v => v.raw === propValue.raw)) {
          existing.push(propValue);
        }
      }
    }
  }

  // Convert map to PropUsage array
  return Array.from(propMap.entries()).map(([key, values]) => {
    const [component, prop] = key.split('.');

    // Also provide rawValues for backward compatibility
    const rawValues = values.map(v => v.raw);

    return {
      component,
      prop,
      values,
      rawValues
    };
  });
}

/**
 * Extract import statements from code
 * @deprecated Use extractAllImports from patternMatchers.ts
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
 * @deprecated Use extractPropsEnhanced for better prop value metadata
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

  // Convert map to array, wrapping strings in PropValue objects for compatibility
  return Array.from(propMap.entries()).map(([key, values]) => {
    const [component, prop] = key.split('.');
    const rawValues = Array.from(values);
    const propValues: PropValue[] = rawValues.map(v => ({
      raw: v,
      normalized: v,
      isDynamic: false,
      isTemplateLiteral: false
    }));

    return {
      component,
      prop,
      values: propValues,
      rawValues
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
