// =============================================================================
// Pattern Configuration
// =============================================================================
// Created: 2025-10-26
// Purpose: Centralized regex patterns for code analysis
//
// Loads pattern strings from patterns.json and compiles them into RegExp
// objects for use in code analysis and inference.
//
// =============================================================================

import patternsData from './patterns.json' with { type: 'json' };

/**
 * Compiled regex patterns for import detection
 */
export const IMPORT_PATTERNS = {
  named: new RegExp(patternsData.imports.named, 'g'),
  default: new RegExp(patternsData.imports.default, 'g'),
  namespace: new RegExp(patternsData.imports.namespace, 'g'),
  mixed: new RegExp(patternsData.imports.mixed, 'g')
} as const;

/**
 * Compiled regex patterns for component detection
 */
export const COMPONENT_PATTERNS = {
  jsx: new RegExp(patternsData.components.jsx, 'g'),
  composite: new RegExp(patternsData.components.composite, 'g')
} as const;

/**
 * Compiled regex patterns for prop extraction
 */
export const PROP_PATTERNS = {
  stringLiteral: new RegExp(patternsData.props.stringLiteral, 'g'),
  expression: new RegExp(patternsData.props.expression, 'g'),
  boolean: new RegExp(patternsData.props.boolean, 'g'),
  templateLiteral: new RegExp(patternsData.props.templateLiteral, 'g')
} as const;

/**
 * Compiled regex patterns for hook detection
 */
export const HOOK_PATTERNS = {
  pattern: new RegExp(patternsData.hooks.pattern, 'g'),
  state: new RegExp(patternsData.hooks.state),
  effect: new RegExp(patternsData.hooks.effect)
} as const;

/**
 * Compiled regex patterns for event handler detection
 */
export const EVENT_HANDLER_PATTERNS = {
  pattern: new RegExp(patternsData.eventHandlers.pattern, 'g'),
  commonHandlers: patternsData.eventHandlers.common
} as const;

/**
 * Compiled regex patterns for section inference
 */
export const SECTION_PATTERNS = {
  size: {
    prop: new RegExp(patternsData.sections.size.prop),
    multipleValues: new RegExp(patternsData.sections.size.multipleValues, 'g')
  },
  variant: {
    prop: new RegExp(patternsData.sections.variant.prop),
    multipleValues: new RegExp(patternsData.sections.variant.multipleValues, 'g')
  },
  color: {
    prop: new RegExp(patternsData.sections.color.prop),
    multipleValues: new RegExp(patternsData.sections.color.multipleValues, 'g')
  },
  loading: new RegExp(patternsData.sections.loading),
  disabled: new RegExp(patternsData.sections.disabled),
  invalid: new RegExp(patternsData.sections.invalid),
  icon: new RegExp(patternsData.sections.icon),
  interactive: new RegExp(patternsData.sections.interactive),
  form: new RegExp(patternsData.sections.form)
} as const;

/**
 * State prop mappings
 */
export const STATE_PROPS = patternsData.states;

/**
 * Helper function to check if code has multiple values for a prop
 *
 * @param code - Source code
 * @param propName - Prop name ("size", "variant", etc.)
 * @returns True if multiple distinct values found
 */
export function hasMultipleValues(code: string, propName: 'size' | 'variant' | 'color'): boolean {
  const pattern = SECTION_PATTERNS[propName].multipleValues;
  const values = new Set<string>();
  let match;

  // Reset regex lastIndex
  pattern.lastIndex = 0;

  while ((match = pattern.exec(code)) !== null) {
    // For size and variant, value is in capture group 1
    // For color, value is in capture group 2
    const value = propName === 'color' ? match[2] : match[1];
    if (value) {
      values.add(value);
    }
  }

  return values.size >= 2;
}

/**
 * Helper function to test a pattern against code
 *
 * @param code - Source code
 * @param pattern - RegExp pattern
 * @returns True if pattern matches
 */
export function testPattern(code: string, pattern: RegExp): boolean {
  // Create a new regex to avoid mutation of global pattern
  const testRegex = new RegExp(pattern.source, pattern.flags.replace('g', ''));
  return testRegex.test(code);
}

/**
 * Get pattern configuration metadata
 *
 * @returns Pattern config metadata
 */
export function getPatternConfigMetadata() {
  return {
    version: patternsData.version,
    description: patternsData.description,
    importPatterns: Object.keys(IMPORT_PATTERNS).length,
    componentPatterns: Object.keys(COMPONENT_PATTERNS).length,
    propPatterns: Object.keys(PROP_PATTERNS).length,
    hookPatterns: Object.keys(HOOK_PATTERNS).length,
    sectionPatterns: Object.keys(SECTION_PATTERNS).length
  };
}
