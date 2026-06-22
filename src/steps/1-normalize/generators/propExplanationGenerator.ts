// =============================================================================
// PropExplanation Generator
// =============================================================================
// Created: 2025-12-28
// Purpose: Generate natural language explanations for props
//
// Converts parsed prop metadata (category, typeInfo, name) into human-readable
// content optimized for embeddings. Accuracy-first principle: prefer honest
// guidance that admits uncertainty over assumptions that might be wrong.
//
// Key responsibilities:
// 1. Generate descriptions (template lookup + type-aware fallback)
// 2. Explain types in human-readable form (8 type kinds)
// 3. Provide semantic WHY/WHEN usage guidance
// 4. Explain default behavior (honest, no assumptions)
//
// Design: Pure functions, no side effects, safe fallbacks for all edge cases.
// All functions handle missing/malformed input gracefully.
// =============================================================================

import type { PropCategory, TypeInfo } from '../../../schemas/NormalizedChunkSchema.js';
import { COMMON_PROP_DESCRIPTIONS, COMMON_USAGE_GUIDANCE } from '../config/prop-templates.js';

/**
 * Content structure returned by generatePropContent
 * All fields are guaranteed to be defined (no undefined).
 */
export interface PropContent {
  description: string;
  typeExplanation: string;
  usageGuidance: string | undefined;
  defaultBehavior: string;
}

/**
 * Main orchestrator: Generate all content for a prop
 *
 * Coordinates the 4 generator functions below to produce complete
 * content for a PropReferenceChunk. All returned fields are safe to use.
 *
 * @param propName - Prop name (e.g., "size", "disabled")
 * @param category - Prop category from Phase 1 categorization
 * @param typeInfo - Parsed type information from Phase 1
 * @param rawDescription - Optional description from extracted docs
 * @param defaultValue - Optional default value from extracted docs
 * @param required - Whether prop is required
 * @param componentName - Optional component name for semantic-aware guidance (Phase 3+)
 * @returns Complete content ready for embedding and validation
 *
 * @example
 * const content = generatePropContent(
 *   "size",
 *   "appearance",
 *   { kind: "union", options: ["xs", "sm", "md"], raw: "'xs' | 'sm' | 'md'" },
 *   "Controls the button size",
 *   "md",
 *   false,
 *   "Button"
 * );
 * // Returns: { description, typeExplanation, usageGuidance, defaultBehavior }
 */
export function generatePropContent(
  propName: string,
  category: PropCategory,
  typeInfo: TypeInfo,
  rawDescription?: string,
  defaultValue?: string,
  required?: boolean,
  componentName?: string
): PropContent {
  return {
    description: generateDescription(propName, category, rawDescription, typeInfo),
    typeExplanation: generateTypeExplanation(typeInfo),
    usageGuidance: generateUsageGuidance(propName, category, componentName),
    defaultBehavior: generateDefaultBehavior(defaultValue, required, typeInfo)
  };
}

// =============================================================================
// FUNCTION 1: generateDescription()
// =============================================================================

/**
 * Generate description for a prop
 *
 * Strategy:
 * 1. If rawDescription provided: use it (source of truth)
 * 2. If prop in template map: use template (high quality)
 * 3. Otherwise: use type-aware fallback (safe, semantic)
 *
 * Always returns a description (never undefined).
 *
 * @param propName - Prop name
 * @param category - Prop category (for fallback generation)
 * @param rawDescription - Optional description from extracted docs
 * @param typeInfo - Type info (for intelligent fallback)
 * @returns Description string
 */
export function generateDescription(
  propName: string,
  category: PropCategory,
  rawDescription?: string,
  typeInfo?: TypeInfo
): string {
  // Priority 1: Use extracted description if available
  if (rawDescription && rawDescription.trim().length > 0) {
    return rawDescription.trim();
  }

  // Priority 2: Use template if prop is known
  const template = COMMON_PROP_DESCRIPTIONS[propName];
  if (template) {
    return template;
  }

  // Priority 3: Type-aware fallback for unknown props
  if (typeInfo) {
    return generateTypeAwareFallback(propName, category, typeInfo);
  }

  // Fallback: Generic safe default
  return `Controls the ${propName} property. Behavior depends on the component's internal implementation.`;
}

/**
 * Generate type-aware fallback description for unknown props
 * Uses the type information to create a semantic description that improves embedding quality
 *
 * @param propName - Prop name
 * @param category - Prop category for context
 * @param typeInfo - Type information
 * @returns Semantic description
 */
function generateTypeAwareFallback(propName: string, category: PropCategory, typeInfo: TypeInfo): string {
  const categoryHint = (() => {
    switch (category) {
      case 'appearance':
        return 'visual appearance';
      case 'state':
        return 'component state';
      case 'events':
        return 'component events';
      case 'accessibility':
        return 'accessibility';
      case 'composition':
        return 'component composition';
      case 'behavior':
        return 'component behavior';
    }
  })();

  const typeHint = (() => {
    switch (typeInfo.kind) {
      case 'primitive':
        return typeInfo.raw;
      case 'union':
        return `one of: ${typeInfo.options?.slice(0, 3).join(', ') || 'multiple values'}`;
      case 'array':
        return 'array of values';
      case 'function':
        return 'function handler';
      case 'object':
        return 'object configuration';
      default:
        return 'specific value';
    }
  })();

  return `Configures the ${propName} property (${categoryHint}, accepts ${typeHint}).`;
}

// =============================================================================
// FUNCTION 2: generateTypeExplanation()
// =============================================================================

/**
 * Generate human-readable explanation of a type
 *
 * Transforms TypeScript types into natural language that developers understand.
 * Handles 8 type kinds. Implements Refinement A: union truncation for large enums.
 *
 * @param typeInfo - Parsed type information from Phase 1
 * @returns Single, clear sentence explaining the type
 *
 * @example
 * generateTypeExplanation({ kind: "union", options: ["xs", "sm", "md"], raw: "'xs' | 'sm' | 'md'" })
 * // Returns: "Accepts one of: xs, sm, md"
 *
 * @example
 * // Large union (50 options)
 * generateTypeExplanation({ kind: "union", options: [51 items], raw: "..." })
 * // Returns: "Accepts one of 51 predefined values: xs, sm, md, lg, xl...and 46 others"
 */
export function generateTypeExplanation(typeInfo: TypeInfo): string {
  switch (typeInfo.kind) {
    case 'primitive':
      return `Accepts ${typeInfo.raw} values.`;

    case 'union': {
      const options = typeInfo.options || [];

      if (options.length === 0) {
        return 'Union type (values not specified).';
      }

      // REFINEMENT A: Truncate large unions to prevent token explosion
      if (options.length <= 10) {
        // For compact unions, list all options
        return `Accepts one of: ${options.join(', ')}.`;
      }

      // For large unions (> 10), list first 5 + "...and X others"
      const shown = options.slice(0, 5).join(', ');
      const remaining = options.length - 5;
      return `Accepts one of ${options.length} predefined values: ${shown}...and ${remaining} others.`;
    }

    case 'array':
      return `Accepts an array of values (${typeInfo.raw}).`;

    case 'function': {
      const returnType = typeInfo.returnType || 'void';
      return `Function type that receives arguments and returns ${returnType}.`;
    }

    case 'object':
      return 'Accepts an object with specific properties.';

    case 'complex':
    default:
      return `Complex type: ${typeInfo.raw}.`;
  }
}

// =============================================================================
// FUNCTION 3: generateUsageGuidance()
// =============================================================================

/**
 * Generate semantic WHY/WHEN guidance for a prop
 *
 * Returns undefined for unknown props (optional field).
 * Never assumes; only includes guidance we're confident about.
 *
 * SEMANTIC AWARENESS (Phase 3+):
 * This function supports component-specific guidance via the optional componentName parameter.
 * When provided, it first tries to find component-scoped templates (e.g., "Button:size")
 * before falling back to generic prop templates (e.g., "size").
 *
 * This prevents semantic pollution: the "size" prop has different meanings across components:
 * - Button.size → "Use md for primary actions" (visual hierarchy)
 * - Heading.size → "Use xl for page titles" (typography)
 * - Avatar.size → "Use md (40px) for standard avatars" (dimensions)
 *
 * Phase 2a: Framework in place, no component-specific templates yet
 * Phase 3: Add critical component templates (Button:size, Heading:size, etc.)
 *
 * @param propName - Prop name
 * @param category - Prop category (for context)
 * @param componentName - Optional component name for context-aware guidance (Phase 3+)
 * @returns Guidance string if available, undefined otherwise
 */
export function generateUsageGuidance(
  propName: string,
  _category: PropCategory, // Kept for signature compatibility; may be used in Phase 3+ for category-based guidance
  componentName?: string
): string | undefined {
  // Try component-specific first (Phase 3+)
  if (componentName) {
    const componentKey = `${componentName}:${propName}`;
    const componentSpecific = COMMON_USAGE_GUIDANCE[componentKey];
    if (componentSpecific) return componentSpecific;
  }

  // Fallback to generic prop template
  return COMMON_USAGE_GUIDANCE[propName];
}

// =============================================================================
// FUNCTION 4: generateDefaultBehavior()
// =============================================================================

/**
 * Generate explanation of default behavior
 *
 * REFINEMENT B: Accurate default handling - never assume.
 *
 * Strategy (in priority order):
 * 1. If required: explain requirement
 * 2. If explicit default provided: use it
 * 3. If boolean without explicit default: admit uncertainty
 * 4. Otherwise: provide generic safe fallback
 *
 * Core principle: Honesty over polish. Wrong defaults corrupt embeddings.
 * Admitting uncertainty is better than claiming false knowledge.
 *
 * @param defaultValue - Optional explicit default value
 * @param required - Whether prop is required
 * @param typeInfo - Type information (for boolean detection)
 * @returns Default behavior explanation
 */
export function generateDefaultBehavior(
  defaultValue?: string,
  required?: boolean,
  typeInfo?: TypeInfo
): string {
  // Priority 1: Required props
  if (required) {
    return 'Required. Component will not render without this prop.';
  }

  // Priority 2: Explicit default value (most trustworthy)
  if (defaultValue !== undefined) {
    return `Defaults to ${defaultValue} if not specified.`;
  }

  // Priority 3: Honest guidance for booleans (admit uncertainty, don't assume)
  if (typeInfo?.kind === 'primitive' && typeInfo.raw === 'boolean') {
    return 'Optional boolean prop. Refer to component examples for default behavior.';
  }

  // Priority 4: Generic safe fallback
  return 'Optional. Component uses internal defaults if not provided.';
}
