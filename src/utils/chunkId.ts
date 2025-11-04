// =============================================================================
// Chunk ID Generation Utility
// =============================================================================
// Created: 2025-10-19
// Reference: NORMALIZATION_GUIDE.md
//
// Generates stable, semantic IDs for normalized chunks.
//
// FORMAT: {component}-{type}-{descriptor}-v{version}
// EXAMPLES:
//   - button-example-size-variants-v1
//   - checkbox-prop-root-size-v1
//   - colorpicker-pattern-portal-composition-v1
//
// DESIGN DECISIONS:
// - Lowercase for consistency
// - Hyphens for readability (URL-friendly)
// - Version suffix for schema migration support
// - Semantic descriptor (not just index numbers)
//
// =============================================================================

import type { ChunkType } from '../schemas/NormalizedChunkSchema.js';

/**
 * Generate a stable chunk ID
 *
 * @param componentName - Component name (e.g., "Button", "ColorPicker")
 * @param chunkType - Type of chunk (e.g., "code-example", "prop-reference")
 * @param descriptor - Semantic descriptor (e.g., "size-variants", "loading-state")
 * @param version - Schema version (default: "1")
 * @returns Stable chunk ID
 *
 * @example
 * generateChunkId("Button", "code-example", "size-variants", "1")
 * // Returns: "button-example-size-variants-v1"
 *
 * @example
 * generateChunkId("ColorPicker", "composition-pattern", "portal-usage", "1")
 * // Returns: "colorpicker-pattern-portal-usage-v1"
 */
export function generateChunkId(
  componentName: string,
  chunkType: ChunkType,
  descriptor: string,
  version: string = '1'
): string {
  // Normalize component name to lowercase
  const component = componentName.toLowerCase().replace(/\s+/g, '-');

  // Shorten chunk type for brevity
  const typeAbbrev = abbreviateChunkType(chunkType);

  // Sanitize descriptor (keep alphanumeric and hyphens only)
  const cleanDescriptor = descriptor
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')  // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Trim hyphens from start/end

  return `${component}-${typeAbbrev}-${cleanDescriptor}-v${version}`;
}

/**
 * Abbreviate chunk type for shorter IDs
 *
 * Keeps IDs readable while reducing length
 */
function abbreviateChunkType(chunkType: ChunkType): string {
  const abbreviations: Record<ChunkType, string> = {
    'component-overview': 'overview',
    'capability-reference': 'capability',
    'code-example': 'example',
    'prop-reference': 'prop',
    'prop-group': 'propgroup',
    'composition-pattern': 'pattern',
    'api-reference': 'api'
  };

  return abbreviations[chunkType];
}

/**
 * Create descriptor from section title or intent
 *
 * Converts human-readable titles into URL-friendly descriptors
 *
 * @example
 * createDescriptor("Button with Multiple Sizes")
 * // Returns: "button-with-multiple-sizes"
 *
 * @example
 * createDescriptor("Loading States")
 * // Returns: "loading-states"
 */
export function createDescriptor(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')          // Replace spaces with hyphens
    .replace(/-+/g, '-')           // Collapse multiple hyphens
    .replace(/^-|-$/g, '')         // Trim hyphens
    .substring(0, 50);             // Limit length
}

/**
 * Parse chunk ID into components
 *
 * Useful for debugging and analytics
 *
 * @example
 * parseChunkId("button-example-size-variants-v1")
 * // Returns: {
 * //   component: "button",
 * //   type: "example",
 * //   descriptor: "size-variants",
 * //   version: "1"
 * // }
 */
export function parseChunkId(chunkId: string): {
  component: string;
  type: string;
  descriptor: string;
  version: string;
} | null {
  const pattern = /^([a-z0-9-]+)-(overview|capability|example|prop|propgroup|pattern|api)-(.+)-v(\d+)$/;
  const match = chunkId.match(pattern);

  if (!match) {
    return null;
  }

  return {
    component: match[1],
    type: match[2],
    descriptor: match[3],
    version: match[4]
  };
}

/**
 * Generate sequential IDs for chunks without semantic descriptors
 *
 * Use this as a fallback when you can't infer a meaningful descriptor
 *
 * @example
 * generateSequentialId("Button", "prop-reference", 0)
 * // Returns: "button-prop-001-v1"
 */
export function generateSequentialId(
  componentName: string,
  chunkType: ChunkType,
  index: number,
  version: string = '1'
): string {
  const component = componentName.toLowerCase().replace(/\s+/g, '-');
  const typeAbbrev = abbreviateChunkType(chunkType);
  const paddedIndex = String(index + 1).padStart(3, '0');

  return `${component}-${typeAbbrev}-${paddedIndex}-v${version}`;
}

/**
 * Generate chunk ID with collision handling
 *
 * If the generated ID already exists in the Set, appends a counter suffix
 *
 * @param componentName - Component name
 * @param chunkType - Type of chunk
 * @param descriptor - Semantic descriptor
 * @param existingIds - Set of already used IDs
 * @param version - Schema version (default: "1")
 * @returns Unique chunk ID
 *
 * @example
 * const ids = new Set(["button-example-size-variants-v1"]);
 * generateUniqueChunkId("Button", "code-example", "size-variants", ids)
 * // Returns: "button-example-size-variants-v1-2" (collision handled)
 */
export function generateUniqueChunkId(
  componentName: string,
  chunkType: ChunkType,
  descriptor: string,
  existingIds: Set<string>,
  version: string = '1'
): string {
  const baseId = generateChunkId(componentName, chunkType, descriptor, version);

  // No collision - return base ID
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  // Collision detected - append counter
  let counter = 2;
  let uniqueId = `${baseId}-${counter}`;

  while (existingIds.has(uniqueId)) {
    counter++;
    uniqueId = `${baseId}-${counter}`;
  }

  return uniqueId;
}
