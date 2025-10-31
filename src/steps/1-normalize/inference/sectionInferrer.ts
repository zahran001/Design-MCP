// =============================================================================
// Section Title Inference
// =============================================================================
// Created: 2025-10-22
// Updated: 2025-10-30 (Phase 3 - Migrated to centralized patterns)
// Reference: NORMALIZATION_GUIDE.md - Phase 1 POC
//
// Infers semantic section titles from code patterns.
//
// CHALLENGE: 60% of code examples have no section or generic "Usage" title
// SOLUTION: Pattern matching on code content to infer semantic titles
//
// CONFIDENCE SCORING:
// - 0.9-1.0: Strong pattern match (multiple indicators)
// - 0.7-0.9: Medium pattern match (single clear indicator)
// - 0.5-0.7: Weak pattern match or existing section
// - 0.3-0.5: Fallback to generic title
//
// =============================================================================

import { SECTION_PATTERNS, hasMultipleValues, testPattern } from '../config/patterns.config.js';

/**
 * Section inference result with confidence score
 */
export interface SectionInference {
  title: string;                                           // Inferred section title
  confidence: number;                                      // 0.0-1.0
  method: 'pattern_match' | 'existing_section' | 'fallback'; // How was it inferred?
  matchedPattern?: string;                                 // For debugging
}

/**
 * Infer semantic section title from code patterns
 *
 * Uses priority-ordered pattern matching to determine what the code demonstrates.
 * Falls back to existing section or generic title if no patterns match.
 *
 * @param code - Source code to analyze
 * @param existingSection - Section from raw extract (optional)
 * @param componentName - Component name for context (optional)
 * @returns Section inference with confidence score
 *
 * @example
 * const code = `<Button size="xs">Small</Button><Button size="lg">Large</Button>`;
 * const result = inferSectionTitle(code);
 * // Returns: {
 * //   title: "Size Variants",
 * //   confidence: 0.95,
 * //   method: "pattern_match",
 * //   matchedPattern: "multiple_size_values"
 * // }
 */
export function inferSectionTitle(
  code: string,
  existingSection?: string,
  componentName?: string
): SectionInference {
  // Pattern 1: Multiple size values (HIGH CONFIDENCE)
  if (hasMultipleValues(code, 'size')) {
    return {
      title: 'Size Variants',
      confidence: 0.95,
      method: 'pattern_match',
      matchedPattern: 'multiple_size_values'
    };
  }

  // Pattern 2: Multiple variant values (HIGH CONFIDENCE)
  if (hasMultipleValues(code, 'variant')) {
    return {
      title: 'Visual Variants',
      confidence: 0.95,
      method: 'pattern_match',
      matchedPattern: 'multiple_variant_values'
    };
  }

  // Pattern 3: Multiple colorPalette/colorScheme values (HIGH CONFIDENCE)
  if (hasMultipleValues(code, 'color')) {
    return {
      title: SECTION_PATTERNS.color.title,
      confidence: SECTION_PATTERNS.color.confidence,
      method: 'pattern_match',
      matchedPattern: 'multiple_color_values'
    };
  }

  // Pattern 4: Loading state (MEDIUM CONFIDENCE)
  if (testPattern(code, SECTION_PATTERNS.loading.pattern)) {
    return {
      title: SECTION_PATTERNS.loading.title,
      confidence: SECTION_PATTERNS.loading.confidence,
      method: 'pattern_match',
      matchedPattern: 'loading_indicator'
    };
  }

  // Pattern 5: Disabled state (MEDIUM CONFIDENCE)
  if (testPattern(code, SECTION_PATTERNS.disabled.pattern)) {
    return {
      title: SECTION_PATTERNS.disabled.title,
      confidence: SECTION_PATTERNS.disabled.confidence,
      method: 'pattern_match',
      matchedPattern: 'disabled_prop'
    };
  }

  // Pattern 6: Error/Invalid state (MEDIUM CONFIDENCE)
  if (testPattern(code, SECTION_PATTERNS.invalid.pattern)) {
    return {
      title: SECTION_PATTERNS.invalid.title,
      confidence: SECTION_PATTERNS.invalid.confidence,
      method: 'pattern_match',
      matchedPattern: 'error_state'
    };
  }

  // Pattern 7: With icons (MEDIUM CONFIDENCE)
  if (testPattern(code, SECTION_PATTERNS.icon.pattern)) {
    const title = componentName
      ? `${componentName} with Icons`
      : SECTION_PATTERNS.icon.title;
    return {
      title,
      confidence: SECTION_PATTERNS.icon.confidence,
      method: 'pattern_match',
      matchedPattern: 'icon_usage'
    };
  }

  // Pattern 8: Interactive/onClick (LOW-MEDIUM CONFIDENCE)
  // Note: Using separate checks instead of combined pattern because useState
  // may appear before or after onClick in the code
  if (code.includes('onClick') && /\buseState\b/.test(code)) {
    return {
      title: SECTION_PATTERNS.interactive.title,
      confidence: SECTION_PATTERNS.interactive.confidence,
      method: 'pattern_match',
      matchedPattern: 'interactive_with_state'
    };
  }

  // Pattern 9: Form integration (LOW-MEDIUM CONFIDENCE)
  if (testPattern(code, SECTION_PATTERNS.form.pattern)) {
    const title = componentName
      ? `${componentName} in Forms`
      : SECTION_PATTERNS.form.title;
    return {
      title,
      confidence: SECTION_PATTERNS.form.confidence,
      method: 'pattern_match',
      matchedPattern: 'form_usage'
    };
  }

  // Pattern 10: Composition (multiple subcomponents)
  if (componentName && (code.match(new RegExp(`${componentName}\\.\\w+`, 'g'))?.length ?? 0) > 2) {
    return {
      title: 'Composition Structure',
      confidence: 0.75,
      method: 'pattern_match',
      matchedPattern: 'subcomponent_composition'
    };
  }

  // =========================================================================
  // NEW PATTERNS (Stage 3 Enhancement)
  // =========================================================================

  // Pattern 11: Accessibility features (HIGH PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.accessibility.pattern)) {
    return {
      title: SECTION_PATTERNS.accessibility.title,
      confidence: SECTION_PATTERNS.accessibility.confidence,
      method: 'pattern_match',
      matchedPattern: 'accessibility_features'
    };
  }

  // Pattern 12: Responsive design (MEDIUM PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.responsive.pattern)) {
    return {
      title: SECTION_PATTERNS.responsive.title,
      confidence: SECTION_PATTERNS.responsive.confidence,
      method: 'pattern_match',
      matchedPattern: 'responsive_props'
    };
  }

  // Pattern 13: Form validation (MEDIUM PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.formValidation.pattern)) {
    return {
      title: SECTION_PATTERNS.formValidation.title,
      confidence: SECTION_PATTERNS.formValidation.confidence,
      method: 'pattern_match',
      matchedPattern: 'form_validation'
    };
  }

  // Pattern 14: Theming/Custom styling (MEDIUM PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.theming.pattern)) {
    return {
      title: SECTION_PATTERNS.theming.title,
      confidence: SECTION_PATTERNS.theming.confidence,
      method: 'pattern_match',
      matchedPattern: 'theming_customization'
    };
  }

  // Pattern 15: Custom styling with sx prop (MEDIUM PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.customStyling.pattern)) {
    return {
      title: SECTION_PATTERNS.customStyling.title,
      confidence: SECTION_PATTERNS.customStyling.confidence,
      method: 'pattern_match',
      matchedPattern: 'sx_prop_styling'
    };
  }

  // Pattern 16: Animation/Transitions (LOW-MEDIUM PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.animation.pattern)) {
    return {
      title: SECTION_PATTERNS.animation.title,
      confidence: SECTION_PATTERNS.animation.confidence,
      method: 'pattern_match',
      matchedPattern: 'animation_transition'
    };
  }

  // Pattern 17: Controlled vs Uncontrolled (MEDIUM PRIORITY)
  const hasControlled = testPattern(code, SECTION_PATTERNS.controlled.pattern);
  const hasUncontrolled = testPattern(code, SECTION_PATTERNS.uncontrolled.pattern);

  if (hasControlled && !hasUncontrolled) {
    return {
      title: SECTION_PATTERNS.controlled.title,
      confidence: SECTION_PATTERNS.controlled.confidence,
      method: 'pattern_match',
      matchedPattern: 'controlled_pattern'
    };
  } else if (hasUncontrolled && !hasControlled) {
    return {
      title: SECTION_PATTERNS.uncontrolled.title,
      confidence: SECTION_PATTERNS.uncontrolled.confidence,
      method: 'pattern_match',
      matchedPattern: 'uncontrolled_pattern'
    };
  }

  // Pattern 18: Component hooks usage (MEDIUM PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.componentHooks.pattern)) {
    return {
      title: SECTION_PATTERNS.componentHooks.title,
      confidence: SECTION_PATTERNS.componentHooks.confidence,
      method: 'pattern_match',
      matchedPattern: 'component_hooks'
    };
  }

  // Pattern 19: Ref forwarding (LOW PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.refForwarding.pattern)) {
    return {
      title: SECTION_PATTERNS.refForwarding.title,
      confidence: SECTION_PATTERNS.refForwarding.confidence,
      method: 'pattern_match',
      matchedPattern: 'ref_usage'
    };
  }

  // Pattern 20: Indeterminate state (LOW PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.indeterminate.pattern)) {
    return {
      title: SECTION_PATTERNS.indeterminate.title,
      confidence: SECTION_PATTERNS.indeterminate.confidence,
      method: 'pattern_match',
      matchedPattern: 'indeterminate_state'
    };
  }

  // Pattern 21: Conditional rendering (LOW PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.conditionalRendering.pattern)) {
    return {
      title: SECTION_PATTERNS.conditionalRendering.title,
      confidence: SECTION_PATTERNS.conditionalRendering.confidence,
      method: 'pattern_match',
      matchedPattern: 'conditional_render'
    };
  }

  // Pattern 22: Data mapping/rendering (MEDIUM PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.dataMapping.pattern)) {
    return {
      title: SECTION_PATTERNS.dataMapping.title,
      confidence: SECTION_PATTERNS.dataMapping.confidence,
      method: 'pattern_match',
      matchedPattern: 'data_mapping'
    };
  }

  // Pattern 23: Event handling (MEDIUM PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.eventHandling.pattern)) {
    return {
      title: SECTION_PATTERNS.eventHandling.title,
      confidence: SECTION_PATTERNS.eventHandling.confidence,
      method: 'pattern_match',
      matchedPattern: 'event_handlers'
    };
  }

  // Pattern 24: Read-only state (LOW PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.readOnly.pattern)) {
    return {
      title: SECTION_PATTERNS.readOnly.title,
      confidence: SECTION_PATTERNS.readOnly.confidence,
      method: 'pattern_match',
      matchedPattern: 'readonly_state'
    };
  }

  // Pattern 25: Required fields (MEDIUM PRIORITY)
  if (testPattern(code, SECTION_PATTERNS.requiredFields.pattern)) {
    return {
      title: SECTION_PATTERNS.requiredFields.title,
      confidence: SECTION_PATTERNS.requiredFields.confidence,
      method: 'pattern_match',
      matchedPattern: 'required_fields'
    };
  }

  // Use existing section if provided and not generic
  if (existingSection && !isGenericSection(existingSection)) {
    return {
      title: existingSection,
      confidence: 0.6,
      method: 'existing_section'
    };
  }

  // Fallback to generic title
  return {
    title: 'Usage Example',
    confidence: 0.3,
    method: 'fallback'
  };
}

/**
 * Check if a section title is generic/non-semantic
 *
 * Generic sections don't provide meaningful context:
 * - "Usage"
 * - "Example"
 * - "Example 1", "Example 2", etc.
 *
 * @param section - Section title to check
 * @returns True if section is generic
 */
function isGenericSection(section: string): boolean {
  const genericPatterns = [
    /^usage$/i,
    /^example$/i,
    /^example\s+\d+$/i,
    /^demo$/i,
    /^basic$/i
  ];

  return genericPatterns.some(pattern => pattern.test(section));
}
