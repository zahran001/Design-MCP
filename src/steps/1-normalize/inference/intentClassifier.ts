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
 * Intent classification result
 */
export interface IntentClassification {
  intent: 'sizing' | 'variants' | 'states' | 'composition' | 'interaction' | 'generic';
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

  // Priority 6: Check section title for hints (LOW-MEDIUM CONFIDENCE)
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

  // Fallback to generic (LOW CONFIDENCE)
  indicators.push('no_specific_pattern_matched');
  return {
    intent: 'generic',
    confidence: 0.4,
    indicators
  };
}
