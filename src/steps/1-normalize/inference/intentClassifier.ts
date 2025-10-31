// =============================================================================
// Intent Classification
// =============================================================================
// Created: 2025-10-22
// Reference: NORMALIZATION_GUIDE.md - Phase 1 POC
//
// Classifies the intent/purpose of code examples.
//
// Intent determines which template to use for natural language generation.
//
// INTENT TYPES:
// - sizing: Demonstrates size options
// - variants: Demonstrates visual style variants
// - states: Demonstrates component states (loading, disabled, error)
// - composition: Demonstrates component composition
// - interaction: Demonstrates user interaction handling
// - generic: Default/fallback intent
//
// =============================================================================

import type { CodeAnalysis } from './codeAnalyzer.js';

/**
 * Intent types (expanded in Stage 3)
 */
export type IntentType =
  | 'sizing'              // Demonstrates size options
  | 'variants'            // Demonstrates visual style variants
  | 'states'              // Demonstrates component states
  | 'composition'         // Demonstrates basic component composition
  | 'interaction'         // Demonstrates user interaction handling
  | 'theming'             // Demonstrates theming/color modes (NEW)
  | 'accessibility'       // Demonstrates accessibility features (NEW)
  | 'responsive'          // Demonstrates responsive design (NEW)
  | 'animation'           // Demonstrates animations/transitions (NEW)
  | 'forms'               // Demonstrates form integration/validation (NEW)
  | 'advanced-composition' // Demonstrates complex nested patterns (NEW)
  | 'hooks-integration'   // Demonstrates component hooks usage (NEW)
  | 'custom-styling'      // Demonstrates custom CSS/sx prop (NEW)
  | 'generic';            // Default/fallback intent

/**
 * Intent classification result
 */
export interface IntentClassification {
  intent: IntentType;
  confidence: number;      // 0.0-1.0
  indicators: string[];    // What led to this classification (for debugging)
}

/**
 * Classify the intent/purpose of a code example
 *
 * Uses priority-ordered checks based on:
 * - Prop usage patterns from CodeAnalysis
 * - Code content patterns
 * - Section title hints
 *
 * @param code - Source code
 * @param analysis - Code analysis result
 * @param sectionTitle - Inferred section title (provides context)
 * @returns Intent classification with confidence
 *
 * @example
 * const code = `<Button size="xs">...</Button><Button size="lg">...</Button>`;
 * const analysis = analyzeCode(code);
 * const result = classifyIntent(code, analysis, "Size Variants");
 * // Returns: {
 * //   intent: "sizing",
 * //   confidence: 0.95,
 * //   indicators: ["multiple_size_values"]
 * // }
 */
export function classifyIntent(
  code: string,
  analysis: CodeAnalysis,
  sectionTitle: string
): IntentClassification {
  const indicators: string[] = [];

  // Priority 1: Sizing intent (HIGHEST CONFIDENCE)
  const sizeProps = analysis.props.filter(p => p.prop === 'size');
  if (sizeProps.length > 0 && sizeProps[0].values.length >= 2) {
    indicators.push('multiple_size_values');
    return {
      intent: 'sizing',
      confidence: 0.95,
      indicators
    };
  }

  // Priority 2: Variants intent (HIGH CONFIDENCE)
  const variantProps = analysis.props.filter(p => p.prop === 'variant');
  if (variantProps.length > 0 && variantProps[0].values.length >= 2) {
    indicators.push('multiple_variant_values');
    return {
      intent: 'variants',
      confidence: 0.95,
      indicators
    };
  }

  // Priority 3: States intent (MEDIUM-HIGH CONFIDENCE)
  // Check for state-related props
  const stateProps = analysis.props.filter(p =>
    ['loading', 'isLoading', 'disabled', 'isDisabled', 'error', 'invalid', 'isInvalid', 'readOnly', 'isReadOnly'].includes(p.prop)
  );

  if (stateProps.length > 0) {
    indicators.push(`state_prop_${stateProps[0].prop}`);
    return {
      intent: 'states',
      confidence: 0.9,
      indicators
    };
  }

  // Check for state-related keywords in code
  if (code.match(/\b(loading|disabled|error|invalid|readOnly)\b/)) {
    indicators.push('state_keyword_in_code');
    return {
      intent: 'states',
      confidence: 0.85,
      indicators
    };
  }

  // Priority 4: Composition intent (MEDIUM CONFIDENCE)
  // Multiple components used together
  if (analysis.components.length >= 3) {
    indicators.push(`${analysis.components.length}_components_used`);
    return {
      intent: 'composition',
      confidence: 0.8,
      indicators
    };
  }

  // Subcomponent composition (e.g., Checkbox.Root, Checkbox.Control)
  const subcomponents = analysis.components.filter(c => c.includes('.'));
  if (subcomponents.length >= 2) {
    indicators.push('subcomponent_composition');
    return {
      intent: 'composition',
      confidence: 0.85,
      indicators
    };
  }

  // Priority 5: Interaction intent (MEDIUM CONFIDENCE)
  // Event handlers + state management
  if (analysis.hasInteractivity && analysis.hasState) {
    indicators.push('event_handlers_with_state');
    return {
      intent: 'interaction',
      confidence: 0.8,
      indicators
    };
  }

  // Just event handlers without state
  if (analysis.hasInteractivity) {
    indicators.push('event_handlers_only');
    return {
      intent: 'interaction',
      confidence: 0.65,
      indicators
    };
  }

  // =========================================================================
  // NEW INTENT CLASSIFICATIONS (Stage 3 Enhancement)
  // =========================================================================

  // Priority 6: Accessibility intent (HIGH CONFIDENCE)
  if (code.match(/\b(aria-|ariaLabel|ariaDescribedBy|role=|screenReader|keyboardNav|tabIndex)/)) {
    indicators.push('accessibility_attributes');
    return {
      intent: 'accessibility',
      confidence: 0.9,
      indicators
    };
  }

  // Priority 7: Theming intent (MEDIUM-HIGH CONFIDENCE)
  if (code.match(/\b(theme|createTheme|useTheme|ThemeProvider|colorMode|darkMode|lightMode)/)) {
    indicators.push('theming_api_usage');
    return {
      intent: 'theming',
      confidence: 0.85,
      indicators
    };
  }

  // Priority 8: Responsive design intent (MEDIUM CONFIDENCE)
  const responsiveProps = analysis.props.filter(p =>
    p.prop.match(/^(base|sm|md|lg|xl|2xl|breakpoint|hideBelow|hideFrom)$/)
  );
  if (responsiveProps.length > 0 || code.match(/\b(responsive|breakpoint|mobile|desktop)/)) {
    indicators.push('responsive_props_or_keywords');
    return {
      intent: 'responsive',
      confidence: 0.8,
      indicators
    };
  }

  // Priority 9: Forms/Validation intent (MEDIUM-HIGH CONFIDENCE)
  if (code.match(/\b(validation|validator|useForm|register|handleSubmit|isInvalid|required)/)) {
    indicators.push('form_validation_keywords');
    return {
      intent: 'forms',
      confidence: 0.85,
      indicators
    };
  }

  // Priority 10: Animation intent (MEDIUM CONFIDENCE)
  if (code.match(/\b(animation|transition|keyframes|animate|motion|framer)/)) {
    indicators.push('animation_keywords');
    return {
      intent: 'animation',
      confidence: 0.8,
      indicators
    };
  }

  // Priority 11: Component hooks integration (MEDIUM-HIGH CONFIDENCE)
  const componentHooks = analysis.hooks.filter(h => h.startsWith('use') && h !== 'useState' && h !== 'useEffect' && h !== 'useReducer' && h !== 'useCallback' && h !== 'useMemo' && h !== 'useRef');
  if (componentHooks.length > 0) {
    indicators.push(`component_hook_${componentHooks[0]}`);
    return {
      intent: 'hooks-integration',
      confidence: 0.85,
      indicators
    };
  }

  // Priority 12: Custom styling intent (MEDIUM CONFIDENCE)
  if (code.match(/\bsx=\{|css=\{|styled\(/)) {
    indicators.push('custom_styling_api');
    return {
      intent: 'custom-styling',
      confidence: 0.8,
      indicators
    };
  }

  // Priority 13: Advanced composition (MEDIUM CONFIDENCE)
  // Complex patterns: 4+ components OR 3+ subcomponents OR nested composition
  const hasNestedComposition = code.match(/<\w+[^>]*>\s*<\w+[^>]*>\s*<\w+[^>]*>/);
  if (analysis.components.length >= 4 || subcomponents.length >= 3 || hasNestedComposition) {
    indicators.push('advanced_composition_pattern');
    return {
      intent: 'advanced-composition',
      confidence: 0.75,
      indicators
    };
  }

  // Priority 14: Check section title for hints (LOW-MEDIUM CONFIDENCE)
  // This catches cases where patterns didn't match but section title is semantic
  const titleLower = sectionTitle.toLowerCase();

  if (titleLower.includes('size')) {
    indicators.push('size_in_title');
    return {
      intent: 'sizing',
      confidence: 0.7,
      indicators
    };
  }

  if (titleLower.includes('variant') || titleLower.includes('style')) {
    indicators.push('variant_in_title');
    return {
      intent: 'variants',
      confidence: 0.7,
      indicators
    };
  }

  if (titleLower.includes('state') || titleLower.includes('loading') || titleLower.includes('disabled')) {
    indicators.push('state_in_title');
    return {
      intent: 'states',
      confidence: 0.7,
      indicators
    };
  }

  if (titleLower.includes('composition') || titleLower.includes('structure')) {
    indicators.push('composition_in_title');
    return {
      intent: 'composition',
      confidence: 0.7,
      indicators
    };
  }

  if (titleLower.includes('interactive') || titleLower.includes('click')) {
    indicators.push('interaction_in_title');
    return {
      intent: 'interaction',
      confidence: 0.7,
      indicators
    };
  }

  // NEW: Title hints for new intent types
  if (titleLower.includes('accessibility') || titleLower.includes('aria') || titleLower.includes('keyboard')) {
    indicators.push('accessibility_in_title');
    return {
      intent: 'accessibility',
      confidence: 0.7,
      indicators
    };
  }

  if (titleLower.includes('theme') || titleLower.includes('color mode') || titleLower.includes('dark mode')) {
    indicators.push('theming_in_title');
    return {
      intent: 'theming',
      confidence: 0.7,
      indicators
    };
  }

  if (titleLower.includes('responsive') || titleLower.includes('breakpoint') || titleLower.includes('mobile')) {
    indicators.push('responsive_in_title');
    return {
      intent: 'responsive',
      confidence: 0.7,
      indicators
    };
  }

  if (titleLower.includes('animation') || titleLower.includes('transition')) {
    indicators.push('animation_in_title');
    return {
      intent: 'animation',
      confidence: 0.7,
      indicators
    };
  }

  if (titleLower.includes('form') || titleLower.includes('validation')) {
    indicators.push('forms_in_title');
    return {
      intent: 'forms',
      confidence: 0.7,
      indicators
    };
  }

  if (titleLower.includes('hook')) {
    indicators.push('hooks_in_title');
    return {
      intent: 'hooks-integration',
      confidence: 0.7,
      indicators
    };
  }

  if (titleLower.includes('styling') || titleLower.includes('custom') || titleLower.includes('sx')) {
    indicators.push('custom_styling_in_title');
    return {
      intent: 'custom-styling',
      confidence: 0.7,
      indicators
    };
  }

  if (titleLower.includes('advanced') || titleLower.includes('complex') || titleLower.includes('nested')) {
    indicators.push('advanced_in_title');
    return {
      intent: 'advanced-composition',
      confidence: 0.7,
      indicators
    };
  }

  // Fallback to generic (LOW CONFIDENCE)
  indicators.push('no_specific_pattern_matched');
  return {
    intent: 'generic',
    confidence: 0.4,
    indicators
  };
}
