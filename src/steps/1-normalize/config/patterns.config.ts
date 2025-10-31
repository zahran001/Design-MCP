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
 * Compiled regex patterns for section inference (25 patterns total)
 */
export const SECTION_PATTERNS = {
  // Original patterns (10)
  size: {
    prop: new RegExp(patternsData.sections.size.prop),
    multipleValues: new RegExp(patternsData.sections.size.multipleValues, 'g'),
    title: patternsData.sections.size.title,
    confidence: patternsData.sections.size.confidence
  },
  variant: {
    prop: new RegExp(patternsData.sections.variant.prop),
    multipleValues: new RegExp(patternsData.sections.variant.multipleValues, 'g'),
    title: patternsData.sections.variant.title,
    confidence: patternsData.sections.variant.confidence
  },
  color: {
    prop: new RegExp(patternsData.sections.color.prop),
    multipleValues: new RegExp(patternsData.sections.color.multipleValues, 'g'),
    title: patternsData.sections.color.title,
    confidence: patternsData.sections.color.confidence
  },
  loading: {
    pattern: new RegExp(patternsData.sections.loading.pattern),
    title: patternsData.sections.loading.title,
    confidence: patternsData.sections.loading.confidence
  },
  disabled: {
    pattern: new RegExp(patternsData.sections.disabled.pattern),
    title: patternsData.sections.disabled.title,
    confidence: patternsData.sections.disabled.confidence
  },
  invalid: {
    pattern: new RegExp(patternsData.sections.invalid.pattern),
    title: patternsData.sections.invalid.title,
    confidence: patternsData.sections.invalid.confidence
  },
  icon: {
    pattern: new RegExp(patternsData.sections.icon.pattern),
    title: patternsData.sections.icon.title,
    confidence: patternsData.sections.icon.confidence
  },
  interactive: {
    pattern: new RegExp(patternsData.sections.interactive.pattern),
    title: patternsData.sections.interactive.title,
    confidence: patternsData.sections.interactive.confidence
  },
  form: {
    pattern: new RegExp(patternsData.sections.form.pattern),
    title: patternsData.sections.form.title,
    confidence: patternsData.sections.form.confidence
  },
  composition: {
    pattern: new RegExp(patternsData.sections.composition.pattern),
    title: patternsData.sections.composition.title,
    confidence: patternsData.sections.composition.confidence
  },

  // New patterns (15) - Stage 3 Enhancement
  accessibility: {
    pattern: new RegExp(patternsData.sections.accessibility.pattern),
    title: patternsData.sections.accessibility.title,
    confidence: patternsData.sections.accessibility.confidence
  },
  responsive: {
    pattern: new RegExp(patternsData.sections.responsive.pattern),
    title: patternsData.sections.responsive.title,
    confidence: patternsData.sections.responsive.confidence
  },
  formValidation: {
    pattern: new RegExp(patternsData.sections.formValidation.pattern),
    title: patternsData.sections.formValidation.title,
    confidence: patternsData.sections.formValidation.confidence
  },
  theming: {
    pattern: new RegExp(patternsData.sections.theming.pattern),
    title: patternsData.sections.theming.title,
    confidence: patternsData.sections.theming.confidence
  },
  customStyling: {
    pattern: new RegExp(patternsData.sections.customStyling.pattern),
    title: patternsData.sections.customStyling.title,
    confidence: patternsData.sections.customStyling.confidence
  },
  animation: {
    pattern: new RegExp(patternsData.sections.animation.pattern),
    title: patternsData.sections.animation.title,
    confidence: patternsData.sections.animation.confidence
  },
  controlled: {
    pattern: new RegExp(patternsData.sections.controlled.pattern),
    title: patternsData.sections.controlled.title,
    confidence: patternsData.sections.controlled.confidence
  },
  uncontrolled: {
    pattern: new RegExp(patternsData.sections.uncontrolled.pattern),
    title: patternsData.sections.uncontrolled.title,
    confidence: patternsData.sections.uncontrolled.confidence
  },
  componentHooks: {
    pattern: new RegExp(patternsData.sections.componentHooks.pattern),
    title: patternsData.sections.componentHooks.title,
    confidence: patternsData.sections.componentHooks.confidence
  },
  refForwarding: {
    pattern: new RegExp(patternsData.sections.refForwarding.pattern),
    title: patternsData.sections.refForwarding.title,
    confidence: patternsData.sections.refForwarding.confidence
  },
  indeterminate: {
    pattern: new RegExp(patternsData.sections.indeterminate.pattern),
    title: patternsData.sections.indeterminate.title,
    confidence: patternsData.sections.indeterminate.confidence
  },
  conditionalRendering: {
    pattern: new RegExp(patternsData.sections.conditionalRendering.pattern),
    title: patternsData.sections.conditionalRendering.title,
    confidence: patternsData.sections.conditionalRendering.confidence
  },
  dataMapping: {
    pattern: new RegExp(patternsData.sections.dataMapping.pattern),
    title: patternsData.sections.dataMapping.title,
    confidence: patternsData.sections.dataMapping.confidence
  },
  eventHandling: {
    pattern: new RegExp(patternsData.sections.eventHandling.pattern),
    title: patternsData.sections.eventHandling.title,
    confidence: patternsData.sections.eventHandling.confidence
  },
  readOnly: {
    pattern: new RegExp(patternsData.sections.readOnly.pattern),
    title: patternsData.sections.readOnly.title,
    confidence: patternsData.sections.readOnly.confidence
  },
  requiredFields: {
    pattern: new RegExp(patternsData.sections.requiredFields.pattern),
    title: patternsData.sections.requiredFields.title,
    confidence: patternsData.sections.requiredFields.confidence
  }
} as const;

/**
 * State prop mappings
 */
export const STATE_PROPS = patternsData.states;

/**
 * Intent metadata (14 intent types)
 */
export const INTENT_METADATA = patternsData.intents;

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
    sectionPatterns: Object.keys(SECTION_PATTERNS).length,
    intentTypes: Object.keys(INTENT_METADATA).length
  };
}
