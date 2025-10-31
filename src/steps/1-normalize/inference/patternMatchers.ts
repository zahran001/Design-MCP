// =============================================================================
// Enhanced Pattern Matching Utilities
// =============================================================================
// Created: 2025-10-26 (Stage 3)
// Purpose: Advanced pattern matching for code analysis
//
// Provides utilities for:
// - Enhanced import detection (default, namespace, mixed)
// - Advanced prop extraction (template literals, expressions)
// - Prop value normalization
// - Composite component handling
//
// =============================================================================

/**
 * Import types
 */
export type ImportType = 'named' | 'default' | 'namespace' | 'mixed';

/**
 * Enhanced import statement with type information
 */
export interface EnhancedImport {
  source: string;                // Package name
  type: ImportType;              // Import style
  defaultImport?: string;        // Default import name (e.g., "React")
  namedImports?: string[];       // Named imports (e.g., ["Button", "HStack"])
  namespaceImport?: string;      // Namespace alias (e.g., "Chakra" in import * as Chakra)
}

/**
 * Prop value with metadata
 */
export interface PropValue {
  raw: string;                   // Original value as written
  normalized: string;            // Normalized value
  isDynamic: boolean;            // Is it an expression {...}?
  isTemplateLiteral: boolean;    // Is it a template literal?
}

/**
 * Extract all import types from code
 *
 * Handles:
 * - Named: import { Button } from '@chakra-ui/react'
 * - Default: import React from 'react'
 * - Namespace: import * as Chakra from '@chakra-ui/react'
 * - Mixed: import React, { useState } from 'react'
 *
 * @param code - Source code
 * @returns Array of enhanced imports
 */
export function extractAllImports(code: string): EnhancedImport[] {
  const imports: EnhancedImport[] = [];

  // Pattern 1: Named imports only
  // import { Button, HStack } from "@chakra-ui/react"
  const namedPattern = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  let match;

  while ((match = namedPattern.exec(code)) !== null) {
    const namedImports = match[1]
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    imports.push({
      source: match[2],
      type: 'named',
      namedImports
    });
  }

  // Pattern 2: Default imports only
  // import React from "react"
  const defaultPattern = /import\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g;
  defaultPattern.lastIndex = 0;

  while ((match = defaultPattern.exec(code)) !== null) {
    // Skip if this is actually a namespace import
    const before = code.substring(Math.max(0, match.index - 10), match.index);
    if (before.includes('* as')) continue;

    // Skip if this is part of a mixed import (check for comma before 'from')
    const importSection = code.substring(match.index, match.index + match[0].length);
    if (importSection.includes('{')) continue;

    imports.push({
      source: match[2],
      type: 'default',
      defaultImport: match[1]
    });
  }

  // Pattern 3: Namespace imports
  // import * as Chakra from "@chakra-ui/react"
  const namespacePattern = /import\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g;
  namespacePattern.lastIndex = 0;

  while ((match = namespacePattern.exec(code)) !== null) {
    imports.push({
      source: match[2],
      type: 'namespace',
      namespaceImport: match[1]
    });
  }

  // Pattern 4: Mixed imports (default + named)
  // import React, { useState, useEffect } from "react"
  const mixedPattern = /import\s+(\w+)\s*,\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  mixedPattern.lastIndex = 0;

  while ((match = mixedPattern.exec(code)) !== null) {
    const namedImports = match[2]
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    imports.push({
      source: match[3],
      type: 'mixed',
      defaultImport: match[1],
      namedImports
    });
  }

  return imports;
}

/**
 * Extract prop value with metadata
 *
 * Handles:
 * - Static strings: size="md"
 * - Expressions: variant={buttonVariant}
 * - Template literals: className={`btn-${size}`}
 * - Complex expressions: disabled={count > 0}
 *
 * @param propString - Raw prop string from JSX
 * @param propName - Name of the prop
 * @returns Prop value with metadata
 */
export function extractPropValue(propString: string, propName: string): PropValue | null {
  // Pattern 1: prop="value" or prop='value'
  const stringPattern = new RegExp(`${propName}=["']([^"']+)["']`);
  const stringMatch = stringPattern.exec(propString);

  if (stringMatch) {
    return {
      raw: stringMatch[1],
      normalized: normalizePropValue(stringMatch[1]),
      isDynamic: false,
      isTemplateLiteral: false
    };
  }

  // Pattern 2: prop={value} (expression)
  const exprPattern = new RegExp(`${propName}=\\{([^}]+)\\}`);
  const exprMatch = exprPattern.exec(propString);

  if (exprMatch) {
    const value = exprMatch[1].trim();
    const isTemplateLiteral = value.startsWith('`') && value.endsWith('`');

    return {
      raw: value,
      normalized: isTemplateLiteral ? extractTemplateLiteralValue(value) : value,
      isDynamic: true,
      isTemplateLiteral
    };
  }

  // Pattern 3: Boolean prop (prop without value means true)
  const boolPattern = new RegExp(`\\b${propName}\\b(?!=)`);
  if (boolPattern.test(propString)) {
    return {
      raw: 'true',
      normalized: 'true',
      isDynamic: false,
      isTemplateLiteral: false
    };
  }

  return null;
}

/**
 * Normalize prop values for comparison
 *
 * Handles:
 * - Size aliases: "md" → "medium", "sm" → "small", etc.
 * - Case normalization
 * - Trim whitespace
 *
 * @param value - Raw prop value
 * @returns Normalized value
 */
export function normalizePropValue(value: string): string {
  const trimmed = value.trim().toLowerCase();

  // Size normalization
  const sizeMap: Record<string, string> = {
    'xs': 'extra-small',
    'sm': 'small',
    'md': 'medium',
    'lg': 'large',
    'xl': 'extra-large',
    '2xl': '2x-large',
    '3xl': '3x-large',
    '4xl': '4x-large'
  };

  if (sizeMap[trimmed]) {
    return sizeMap[trimmed];
  }

  return trimmed;
}

/**
 * Extract static value from template literal if possible
 *
 * Example: `btn-${size}` → "btn-" (partial)
 * Example: `button-primary` → "button-primary" (full)
 *
 * @param templateLiteral - Template literal string
 * @returns Extracted value or original
 */
function extractTemplateLiteralValue(templateLiteral: string): string {
  // Remove backticks
  const inner = templateLiteral.slice(1, -1);

  // If no interpolations, return as-is
  if (!inner.includes('${')) {
    return inner;
  }

  // Extract static prefix (useful for className patterns)
  const parts = inner.split('${');
  return parts[0] || inner;
}

/**
 * Check if component is a composite/subcomponent
 *
 * Examples:
 * - Checkbox.Root → true (base: Checkbox)
 * - Menu.Item → true (base: Menu)
 * - Button → false
 *
 * @param componentName - Component name to check
 * @returns Composite info or null
 */
export function parseCompositeComponent(componentName: string): {
  base: string;
  sub: string;
} | null {
  const parts = componentName.split('.');

  if (parts.length === 2) {
    return {
      base: parts[0],
      sub: parts[1]
    };
  }

  return null;
}

/**
 * Extract all prop names from JSX tag
 *
 * More robust than regex - handles edge cases:
 * - Spread props: {...props}
 * - Boolean props: disabled
 * - Props with expressions: variant={value}
 *
 * @param tagContent - Content between < and >
 * @returns Array of prop names
 */
export function extractPropNames(tagContent: string): string[] {
  const propNames: string[] = [];

  // Clean up the tag content (remove only trailing / or >)
  // Note: tagContent is already just the props string (component name already removed by caller)
  const propsOnly = tagContent
    .replace(/\/?>?\s*$/, '');           // Remove closing / or >

  if (!propsOnly.trim()) return [];

  // Pattern for prop names (handles spread, boolean, and assigned props)
  const propPattern = /(?:\.\.\.)?(\w+)(?:=|(?=\s)|(?=$))/g;
  let match;

  while ((match = propPattern.exec(propsOnly)) !== null) {
    const propName = match[1];

    // Skip HTML-like attributes that aren't props
    if (propName === 'className' || propName === 'style' || propName === 'key' || propName === 'ref') {
      continue;
    }

    if (!propNames.includes(propName)) {
      propNames.push(propName);
    }
  }

  return propNames;
}

/**
 * Detect if code uses spread props
 *
 * Examples:
 * - <Button {...props} />
 * - <Input {...commonProps} />
 *
 * @param code - Source code
 * @returns True if spread props detected
 */
export function hasSpreadProps(code: string): boolean {
  return /\{\.\.\.[\w.]+\}/.test(code);
}

/**
 * Extract event handler prop names
 *
 * Matches: onClick, onChange, onSubmit, etc.
 *
 * @param props - Array of prop names
 * @returns Filtered event handler names
 */
export function filterEventHandlers(props: string[]): string[] {
  return props.filter(prop =>
    prop.startsWith('on') &&
    prop.length > 2 &&
    prop[2] === prop[2].toUpperCase()
  );
}

/**
 * Group imports by source
 *
 * Combines multiple import statements from the same source
 *
 * @param imports - Array of enhanced imports
 * @returns Grouped imports map (source → combined import)
 */
export function groupImportsBySource(imports: EnhancedImport[]): Map<string, EnhancedImport> {
  const grouped = new Map<string, EnhancedImport>();

  for (const imp of imports) {
    const existing = grouped.get(imp.source);

    if (!existing) {
      grouped.set(imp.source, imp);
      continue;
    }

    // Merge imports from same source
    const merged: EnhancedImport = {
      source: imp.source,
      type: 'mixed', // Combined type
      defaultImport: existing.defaultImport || imp.defaultImport,
      namedImports: [
        ...(existing.namedImports || []),
        ...(imp.namedImports || [])
      ],
      namespaceImport: existing.namespaceImport || imp.namespaceImport
    };

    // Deduplicate named imports
    if (merged.namedImports) {
      merged.namedImports = Array.from(new Set(merged.namedImports));
    }

    grouped.set(imp.source, merged);
  }

  return grouped;
}

/**
 * Check if prop value matches a specific pattern
 *
 * Useful for detecting specific patterns like:
 * - size="xs" | "sm" | "md" (union types)
 * - variant={isActive ? "solid" : "outline"}
 *
 * @param value - Prop value metadata
 * @param pattern - Pattern to check (e.g., "conditional", "union")
 * @returns True if pattern matches
 */
export function matchesValuePattern(value: PropValue, pattern: 'conditional' | 'union' | 'static'): boolean {
  if (pattern === 'static') {
    return !value.isDynamic && !value.isTemplateLiteral;
  }

  if (pattern === 'conditional') {
    return value.isDynamic && value.raw.includes('?');
  }

  if (pattern === 'union') {
    return value.raw.includes('|');
  }

  return false;
}
