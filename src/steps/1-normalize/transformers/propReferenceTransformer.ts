// =============================================================================
// PropReferenceChunk Transformer
// =============================================================================
// Created: 2025-12-28
// Purpose: Transform raw component props into semantic PropReferenceChunks
//
// Transforms raw prop definitions from extracted JSON into embedding-optimized
// chunks that answer "What's the X prop?" questions.
//
// Key responsibilities:
// 1. Categorize props by name patterns (appearance, events, state, etc.)
// 2. Parse TypeScript type strings robustly (handles 8+ edge cases)
// 3. Find related props from static mapping
// 4. Assemble PropReferenceChunk with all metadata
//
// Design: Each function handles a specific aspect and can be tested independently.
// All parsing functions have safe fallbacks (never throw, always return valid values).
// =============================================================================

import type { Prop } from '../../../schemas/RAGResultSchema.js';
import type {
  PropReferenceChunk,
  PropCategory,
  TypeInfo
} from '../../../schemas/NormalizedChunkSchema.js';
import { generateChunkId } from '../../../utils/chunkId.js';
import { getCategoryFromComponent } from '../config/categories.config.js';
import { generatePropContent } from '../generators/propExplanationGenerator.js';

/**
 * Transform a raw prop into a PropReferenceChunk
 *
 * This is the main entry point for prop transformation. It coordinates:
 * 1. Categorizing the prop
 * 2. Parsing its type
 * 3. Finding related props
 * 4. Generating content (delegated to separate generator module)
 * 5. Assembling the complete chunk
 *
 * @param rawProp - Raw prop from extracted JSON
 * @param componentName - Component this prop belongs to
 * @param sourceUrl - Documentation URL
 * @param allProps - All props for this component (for finding relationships)
 * @returns Complete PropReferenceChunk ready for validation and storage
 *
 * @throws Never - Uses safe fallbacks for all edge cases
 *
 * @example
 * const prop = { name: "size", type: "'xs' | 'sm' | 'md'", description: "..." }
 * const chunk = transformProp(prop, "Button", "https://chakra-ui.com/docs/components/button", [prop])
 * // Returns: PropReferenceChunk with all metadata, content, and apiReference populated
 */
export function transformProp(
  rawProp: Prop,
  componentName: string,
  sourceUrl: string,
  allProps: Prop[]
): PropReferenceChunk {
  // Step 1: Categorize prop
  const category = categorizeProp(rawProp.name);

  // Step 2: Parse type (with robust error handling)
  const typeInfo = parsePropertyType(rawProp.type);

  // Step 3: Find related props
  const relatedProps = findRelatedProps(rawProp.name, allProps);

  // Step 4: Generate unique chunk ID using prop name as semantic descriptor
  const chunkId = generateChunkId(componentName, 'prop-reference', rawProp.name, '1');

  // Step 5: Generate tags for retrieval
  const tags = [
    'prop',
    category.toLowerCase(),
    rawProp.name.toLowerCase()
  ];

  // Step 6: Get component category
  const componentCategory = getCategoryFromComponent(componentName);

  // Step 7: Generate content using Phase 2a natural language generator
  const content = generatePropContent(
    rawProp.name,
    category,
    typeInfo,
    rawProp.description,
    rawProp.defaultValue,
    rawProp.required,
    componentName
  );

  // Step 8: Assemble and return complete chunk
  return {
    metadata: {
      chunkId,
      chunkType: 'prop-reference',
      componentName,
      sourceUrl,
      version: '3.27.1',
      tags,
      category: componentCategory,
      complexity: 'simple',
      relatedChunks: []
    },

    prop: {
      fullName: rawProp.name,
      component: undefined, // TODO: Handle composite components (Phase 2)
      name: rawProp.name,
      category
    },

    content,

    apiReference: {
      type: typeInfo,
      defaultValue: rawProp.defaultValue,
      required: rawProp.required || false,
      relatedProps: relatedProps.length > 0 ? relatedProps : undefined
    }
  };
}

/**
 * Categorize prop by name pattern
 *
 * Uses priority-ordered regex patterns to classify props into 6 categories:
 * 1. Appearance (visual styling) - checked first
 * 2. Events (event handlers)
 * 3. State (component state)
 * 4. Accessibility (a11y attributes)
 * 5. Composition (component structure)
 * 6. Behavior (runtime behavior) - fallback default
 *
 * Order is critical: must check accessibility BEFORE state to avoid
 * "aria-disabled" being misclassified as "disabled" (state).
 *
 * Examples of categorization:
 * - "size", "variant", "colorPalette" → "appearance"
 * - "onClick", "onChange", "onBlur" → "events"
 * - "disabled", "loading", "invalid", "readOnly" → "state"
 * - "aria-label", "aria-disabled", "role" → "accessibility"
 * - "as", "asChild", "ref", "className", "style" → "composition"
 * - "lazyMount", "closeOnSelect", "delay" → "behavior"
 * - Unknown props → "behavior" (safe fallback)
 *
 * @param propName - Property name to categorize
 * @returns PropCategory (one of 6 values)
 *
 * @example
 * categorizeProp('size') // Returns: 'appearance'
 * categorizeProp('onClick') // Returns: 'events'
 * categorizeProp('disabled') // Returns: 'state'
 * categorizeProp('unknownProp') // Returns: 'behavior'
 */
export function categorizeProp(propName: string): PropCategory {
  const lowerName = propName.toLowerCase();

  // Accessibility props (aria-* and role attributes) - CHECK FIRST to avoid conflicts
  // This must be checked before state because "aria-disabled" contains "disabled"
  // Also check for camelCase aria props like "ariaLabel" or "AriaLabel"
  if (/^aria-/.test(lowerName) || /^aria[A-Z]/i.test(propName) || lowerName === 'role') {
    return 'accessibility';
  }

  // Appearance props (visual styling)
  // Use ^ and $ anchors for exact matches, accounting for camelCase (e.g., colorPalette, colorScheme)
  // This avoids false positives like "fullSize" matching "size" or "primaryColor" matching "color"
  if (/^(size|width|height|padding|margin|color|variant|border|radius|shadow|opacity|bg|gradient|theme|background|display|flex|grid|position)$/.test(lowerName) ||
      /^(colorPalette|colorScheme)$/.test(propName)) {
    return 'appearance';
  }

  // Event handlers (must start with "on" followed by uppercase)
  if (/^on[A-Z]/.test(propName)) {
    return 'events';
  }

  // State props (component state/condition)
  // Use camelCase-aware matching: exact match OR camelCase prefix (e.g., "defaultChecked")
  // Avoid false positives like "isDisabled" (has prefix), "disabledProp" (has suffix)
  if (/^(disabled|loading|invalid|readonly|checked|selected|open|closed|error|expanded|active|focused|required)$/.test(lowerName) ||
      /^(readOnly|defaultChecked|defaultSelected)$/.test(propName)) {
    return 'state';
  }

  // Composition props (component structure/layout)
  // CRITICAL: Use exact match anchors to avoid "hasError" matching "as", "baseline" matching "as", etc.
  if (/^(as|asChild|ref|className|style|children)$/.test(propName)) {
    return 'composition';
  }

  // Behavior props (runtime/interaction behavior)
  // Default fallback for unknown props
  return 'behavior';
}

/**
 * Parse TypeScript type string and extract structured type information
 *
 * Robust parsing that handles 8+ edge cases without throwing (exported for testing):
 *
 * ✅ Union types:
 *   - Quoted with spacing: "'xs' | 'sm' | 'md'"
 *   - Unquoted with spacing: "xs | sm | md"
 *   - No spacing: "'xs'|'sm'|'md'"
 *   - Mixed quotes: "string | 'literal'"
 *
 * ✅ Primitive types:
 *   - Basic: "string", "number", "boolean"
 *   - Advanced: "any", "unknown", "void"
 *
 * ✅ Complex types:
 *   - Array: "string[]", "Array<T>"
 *   - Function: "(e: Event) => void", "() => void"
 *   - Object: "{ prop: string }", "Record<string, T>"
 *   - Generic: "Map<K, V>", "Promise<T>"
 *
 * ✅ Edge cases:
 *   - Empty/whitespace
 *   - Malformed types
 *   - Unknown syntaxes
 *
 * Always returns valid TypeInfo object - never throws.
 * Worst case: `{ kind: 'complex', raw: originalString }`
 *
 * @param typeStr - TypeScript type string to parse
 * @returns Structured TypeInfo with kind and optional type-specific fields
 *
 * @example
 * parsePropertyType("'xs' | 'sm' | 'md'")
 * // Returns: { kind: 'union', raw: "'xs' | 'sm' | 'md'", options: ['xs', 'sm', 'md'] }
 *
 * @example
 * parsePropertyType("(e: MouseEvent) => void")
 * // Returns: { kind: 'function', raw: "(e: MouseEvent) => void", returnType: 'void' }
 *
 * @example
 * parsePropertyType("Record<string, unknown>")
 * // Returns: { kind: 'complex', raw: "Record<string, unknown>" }
 */
export function parsePropertyType(typeStr: string): TypeInfo {
  const trimmed = typeStr.trim();

  // Handle empty/whitespace input
  if (!trimmed) {
    return { kind: 'complex', raw: trimmed };
  }

  try {
    // FUNCTION TYPES: Contains => (arrow function syntax) - CHECK FIRST!
    // Must check BEFORE union detection to avoid misclassifying "(e: Event) => string | number" as union
    if (trimmed.includes('=>')) {
      try {
        const returnMatch = trimmed.match(/=>\s*(.+?)$/);
        return {
          kind: 'function',
          raw: trimmed,
          returnType: returnMatch ? returnMatch[1].trim() : undefined
        };
      } catch (e) {
        // Fall through to complex
      }
    }

    // PRIMITIVE TYPES: Must be exact match (case-sensitive)
    if (['string', 'number', 'boolean', 'any', 'unknown', 'void', 'bigint', 'symbol', 'undefined', 'null'].includes(trimmed)) {
      return {
        kind: 'primitive',
        raw: trimmed
      };
    }

    // ARRAY TYPES: string[], number[], Component[], etc. (concrete types with [])
    // Array<T> is always an array
    if (/^Array</.test(trimmed)) {
      return {
        kind: 'array',
        raw: trimmed
      };
    }

    // Check for concrete array notation: string[], Component[], MyType[]
    // But NOT single-letter generics like T[], K[], V[] (which are placeholders)
    // Explicit check: if base type is a single uppercase letter, it's a generic placeholder
    if (trimmed.endsWith('[]')) {
      const baseType = trimmed.slice(0, -2); // Remove []
      // Exclude single-letter generics (T, K, V, U, etc.)
      if (!/^[A-Z]$/.test(baseType)) {
        return {
          kind: 'array',
          raw: trimmed
        };
      }
      // Single-letter generic → fall through to complex
    }

    // OBJECT TYPES: Starts with { (object literal)
    if (trimmed.startsWith('{')) {
      return {
        kind: 'object',
        raw: trimmed
      };
    }

    // GENERIC TYPES: Contains < > (Record<K,V>, Map<K,V>, Promise<T>, etc.)
    // Check BEFORE union to avoid misclassifying "Record<string, A | B>" as union
    if (/</.test(trimmed)) {
      return {
        kind: 'complex',
        raw: trimmed
      };
    }

    // UNION TYPE: Check for pipe character (handles all spacing/quoting variations)
    // Only treat as union if it's NOT a function (already checked above) and NOT generic (already checked above)
    if (trimmed.includes('|')) {
      const options = trimmed
        .split('|')
        .map(s => s.trim())
        .map(s => s.replace(/^['"`]|['"`]$/g, '')) // Remove all quote types (single, double, backtick)
        .filter(s => s.length > 0);

      // Only return union if we got valid options (2+ items)
      if (options.length > 1) {
        return {
          kind: 'union',
          raw: trimmed,
          options
        };
      }
    }
  } catch (e) {
    // Silently fall through to complex type - parsing should never crash
  }

  // SAFE FALLBACK: Complex/unknown type
  // This is always a valid TypeInfo that won't crash downstream
  return {
    kind: 'complex',
    raw: trimmed
  };
}

/**
 * Find related props that commonly pair together
 *
 * Returns only props that ACTUALLY EXIST in the component (filters against allProps).
 * If no pairings exist for a prop, returns empty array (safe fallback).
 *
 * This is a static mapping for MVP (acceptable for initial release).
 * Phase 2 can add ML-based inference using code example analysis.
 *
 * Common pairings include:
 * - Appearance: size ↔ variant ↔ colorPalette ↔ colorScheme
 * - State: disabled ↔ loading, checked ↔ defaultChecked
 * - Behavior: closeOnSelect ↔ closeOnBlur
 * - Form: placeholder ↔ defaultValue ↔ value
 * - Events: onClick ↔ onDoubleClick, onChange ↔ onBlur
 *
 * Examples:
 * - "size" → ["variant", "colorPalette", "colorScheme"] (if they exist)
 * - "loading" → ["disabled"] (if it exists)
 * - "invalid" → ["required"] (if it exists)
 * - "unknownProp" → [] (empty, safe fallback, no error)
 *
 * @param propName - Property name to find relations for
 * @param allProps - All props in this component
 * @returns Array of related prop names that exist in this component
 *
 * @example
 * const props = [
 *   { name: 'size', type: 'string' },
 *   { name: 'variant', type: 'string' },
 *   { name: 'disabled', type: 'boolean' }
 * ]
 * findRelatedProps('size', props)
 * // Returns: ['variant'] (colorPalette not included because it doesn't exist)
 *
 * @example
 * findRelatedProps('unknownProp', props)
 * // Returns: [] (empty array, safe fallback)
 */
export function findRelatedProps(propName: string, allProps: Prop[]): string[] {
  // Static mapping of commonly paired properties (MVP approach)
  // IMPORTANT: Keys are LOWERCASE to handle casing variations (readOnly vs readonly, onClick vs onclick)
  const commonPairings: Record<string, string[]> = {
    // Appearance props often paired together
    'size': ['variant', 'colorpalette', 'colorscheme', 'width', 'height'],
    'variant': ['size', 'colorpalette', 'colorscheme'],
    'colorpalette': ['variant', 'size', 'colorscheme'],
    'colorscheme': ['variant', 'colorpalette', 'size'],
    'theme': ['colorscheme', 'colorpalette'],
    'width': ['height', 'size'],
    'height': ['width', 'size'],

    // State props often paired
    'disabled': ['loading', 'readonly'],
    'loading': ['disabled'],
    'invalid': ['required'],
    'required': ['invalid'],
    'readonly': ['disabled'],
    'checked': ['defaultchecked'],
    'selected': ['defaultselected'],
    'open': ['onopenchang'],
    'expanded': ['ontoggle'],

    // Behavior props often paired
    'closeonselect': ['closeonblur'],
    'closeonblur': ['closeonselect'],
    'lazymount': ['closeonselect'],

    // Form props often paired
    'placeholder': ['defaultvalue'],
    'defaultvalue': ['placeholder', 'value'],
    'value': ['defaultvalue', 'onchange'],

    // Event handlers often paired
    'onclick': ['ondoubleclick'],
    'onchange': ['onblur'],
    'onfocus': ['onblur'],
    'onopenchang': ['open'],
    'ontoggle': ['expanded']
  };

  // Normalize prop name for lookup (case-insensitive)
  const lookupKey = propName.toLowerCase();
  const pairings = commonPairings[lookupKey] || [];

  // Build maps for both exact and case-insensitive lookups
  const allPropsByName = new Map<string, string>(); // lowercase → original casing
  for (const prop of allProps) {
    allPropsByName.set(prop.name.toLowerCase(), prop.name);
  }

  // Filter to only return props that ACTUALLY EXIST in this component
  // Match using case-insensitive lookup, but return original casing from actual prop
  return pairings
    .map(relatedPropLower => allPropsByName.get(relatedPropLower))
    .filter((prop): prop is string => prop !== undefined);
}



