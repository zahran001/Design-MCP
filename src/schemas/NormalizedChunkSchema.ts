// =============================================================================
// Normalized Chunk Schema - Week 2 Advanced Normalization
// =============================================================================
// Created: 2025-10-19
// Reference: NORMALIZATION_GUIDE.md
//
// This schema defines the structure for semantically rich, intent-based chunks
// optimized for LLM retrieval. Each chunk type maps to a specific user question
// pattern and contains both natural language (for embedding) and structured
// metadata (for LLM accuracy).
//
// DESIGN PHILOSOPHY:
// - Dual Content Strategy: Natural language for embeddings + structured for accuracy
// - Self-Contained: Each chunk answers ONE question completely
// - Intent-Based: Chunk types map to user question patterns
// - Optimal Size: 200-500 tokens for embedding models
//
// CHUNK TYPES:
// 1. ComponentOverviewChunk     - "What is X?"
// 2. CapabilityReferenceChunk   - "What can X do?"
// 3. CodeExampleChunk           - "How do I...?"
// 4. PropReferenceChunk         - "What's the X prop?"
// 5. PropGroupChunk             - "What appearance props are there?"
// 6. CompositionPatternChunk    - "How to combine X with Y?"
// 7. APIReferenceChunk          - "Complete API reference for X"
//
// =============================================================================

import { z } from 'zod';

// =============================================================================
// Base Types - Shared across all chunk types
// =============================================================================

/**
 * Component category classification
 * Used for filtering and semantic grouping
 */
export const ComponentCategorySchema = z.enum([
  'form-controls',
  'layout',
  'typography',
  'data-display',
  'feedback',
  'overlay',
  'disclosure',
  'navigation',
  'media',
  'other'
]);

export type ComponentCategory = z.infer<typeof ComponentCategorySchema>;

/**
 * Discriminator for chunk type
 * Used for type narrowing and retrieval routing
 */
export const ChunkTypeSchema = z.enum([
  'component-overview',
  'capability-reference',
  'code-example',
  'prop-reference',
  'prop-group',
  'composition-pattern',
  'api-reference'
]);

export type ChunkType = z.infer<typeof ChunkTypeSchema>;

/**
 * Base metadata shared by all chunks
 *
 * Design decisions:
 * - chunkId: Stable, semantic IDs for cross-referencing
 * - tags: Multi-dimensional tagging for retrieval
 * - complexity: Helps match user skill level
 * - relatedChunks: Enable graph-based retrieval
 */
export const ChunkMetadataSchema = z.object({
  chunkId: z.string(),                    // Stable ID: "button-example-size-variants-v1"
  chunkType: ChunkTypeSchema,              // Discriminator for chunk type
  componentName: z.string(),               // "Button", "Checkbox", etc.
  sourceUrl: z.string().url(),             // Original documentation URL
  version: z.string().default('3.27.1'),    // Schema version for migration

  // Semantic metadata for retrieval
  tags: z.array(z.string()),               // ["sizing", "variants", "form-controls"]
  category: ComponentCategorySchema,       // Component category
  complexity: z.enum(['simple', 'intermediate', 'advanced']),

  // Relationships for graph-based retrieval
  relatedChunks: z.array(z.string()).default([]), // IDs of related chunks
  prerequisites: z.array(z.string()).optional(),   // Required knowledge chunks
});

export type ChunkMetadata = z.infer<typeof ChunkMetadataSchema>;

// =============================================================================
// Supporting Types - Used across multiple chunk types
// =============================================================================

/**
 * Parsed import statement from code
 *
 * Examples:
 * - { source: "@chakra-ui/react", imports: ["Button", "HStack"], type: "named" }
 * - { source: "react", imports: ["default"], type: "default" }
 */
export const ImportStatementSchema = z.object({
  source: z.string(),                     // Package name: "@chakra-ui/react"
  imports: z.array(z.string()),           // Imported items: ["Button", "HStack"]
  type: z.enum(['default', 'named', 'namespace'])
});

export type ImportStatement = z.infer<typeof ImportStatementSchema>;

/**
 * Prop usage extracted from code
 *
 * Example:
 * From: <Button size="xs" variant="solid">
 * To: { component: "Button", prop: "size", values: ["xs"] }
 */
export const PropUsageSchema = z.object({
  component: z.string(),                  // "Button"
  prop: z.string(),                       // "size"
  values: z.array(z.string())             // ["xs", "sm", "md"] - all values used
});

export type PropUsage = z.infer<typeof PropUsageSchema>;

/**
 * Structured type information
 *
 * Enables better type understanding and natural language generation
 */
export const TypeInfoSchema = z.object({
  kind: z.enum(['primitive', 'union', 'object', 'array', 'function', 'complex']),
  raw: z.string(),                        // Original TypeScript type string
  options: z.array(z.string()).optional(), // For unions: ["xs", "sm", "md"]
  shape: z.record(z.string()).optional(),  // For objects: { prop: "type" }
  returnType: z.string().optional()        // For functions: return type
});

export type TypeInfo = z.infer<typeof TypeInfoSchema>;

/**
 * Prop category classification
 * Used for grouping and semantic understanding
 */
export const PropCategorySchema = z.enum([
  'appearance',      // size, variant, colorPalette
  'state',           // disabled, invalid, readOnly, loading
  'events',          // onClick, onValueChange
  'composition',     // as, asChild, ref
  'behavior',        // closeOnSelect, lazyMount
  'accessibility'    // aria-*, role
]);

export type PropCategory = z.infer<typeof PropCategorySchema>;

// =============================================================================
// Chunk Type 1: Component Overview
// =============================================================================
// Answers: "What is X?"
// Example query: "What is Button?"
// Target size: 200-300 tokens
// =============================================================================

export const ComponentOverviewChunkSchema = z.object({
  metadata: ChunkMetadataSchema.extend({
    chunkType: z.literal('component-overview')
  }),

  // Natural language content for embedding (200-300 tokens)
  content: z.object({
    description: z.string(),              // "Button is used to trigger actions..."
    capabilities: z.array(z.string()),    // ["Supports multiple sizes", "Loading states"]
    useCases: z.array(z.string()),        // ["Form submission", "Navigation"]
    commonPairings: z.array(z.string())   // ["Used with ButtonGroup for grouping"]
  }),

  // Structured metadata (for filtering, not primary embedding)
  quickReference: z.object({
    hasSubcomponents: z.boolean(),        // true for ColorPicker (Root, Trigger, etc.)
    subcomponents: z.array(z.string()).optional(), // ["ColorPicker.Root", "ColorPicker.Trigger"]
    propCount: z.number(),
    exampleCount: z.number(),
    accessibilityLevel: z.enum(['full', 'partial', 'basic'])
  })
});

export type ComponentOverviewChunk = z.infer<typeof ComponentOverviewChunkSchema>;

// =============================================================================
// Chunk Type 2: Capability Reference
// =============================================================================
// Answers: "What can X do?" / "What sizes does X support?"
// Example query: "What button sizes are available?"
// Target size: 250-400 tokens
// =============================================================================

export const CapabilityOptionSchema = z.object({
  value: z.string(),                      // "xs" | "sm" | "md"
  description: z.string(),                // "Extra small button, 24px height"
  visualContext: z.string().optional(),   // "Best for compact toolbars"
  codeSnippet: z.string().optional()      // "<Button size='xs'>Small</Button>"
});

export type CapabilityOption = z.infer<typeof CapabilityOptionSchema>;

export const CapabilityReferenceChunkSchema = z.object({
  metadata: ChunkMetadataSchema.extend({
    chunkType: z.literal('capability-reference')
  }),

  // What capability this documents
  capability: z.object({
    name: z.string(),                     // "sizing" | "variants" | "loading-states"
    intent: z.string()                    // "Control button size" | "Change appearance"
  }),

  // Natural language content for embedding (200-400 tokens)
  content: z.object({
    description: z.string(),              // "Button supports 7 size variants..."
    options: z.array(CapabilityOptionSchema), // Detailed option documentation
    bestPractices: z.array(z.string()).optional(), // ["Use 'md' for primary actions"]
    commonMistakes: z.array(z.string()).optional() // ["Don't use 2xl for inline buttons"]
  }),

  // Structured reference (secondary)
  reference: z.object({
    propNames: z.array(z.string()),       // ["size"] or ["variant"]
    defaultValue: z.string().optional(),
    relatedCapabilities: z.array(z.string()).optional() // ["Can combine size with variant"]
  })
});

export type CapabilityReferenceChunk = z.infer<typeof CapabilityReferenceChunkSchema>;

// =============================================================================
// Chunk Type 3: Code Example (PHASE 1 FOCUS)
// =============================================================================
// Answers: "How do I...?"
// Example query: "How do I make a button larger?"
// Target size: 250-500 tokens
// =============================================================================

export const CodeExampleChunkSchema = z.object({
  metadata: ChunkMetadataSchema.extend({
    chunkType: z.literal('code-example')
  }),

  // Example metadata
  example: z.object({
    title: z.string(),                    // "Button with Multiple Sizes" (inferred or extracted)
    intent: z.string(),                   // "Demonstrate size variants" (inferred from code)
    difficulty: z.enum(['basic', 'intermediate', 'advanced'])
  }),

  // Natural language content for embedding (250-500 tokens)
  content: z.object({
    explanation: z.string(),              // "This example shows how to use different button sizes..."
    code: z.string(),                     // The actual code
    demonstrates: z.array(z.string()),    // ["size prop usage", "HStack layout"]
    keyPoints: z.array(z.string()).optional() // ["Size prop accepts xs|sm|md|lg|xl"]
  }),

  // Structured metadata
  codeMetadata: z.object({
    language: z.string().default('tsx'),  // "tsx" | "jsx" | "typescript"
    imports: z.array(ImportStatementSchema), // Parsed imports
    components: z.array(z.string()),      // ["Button", "HStack"]
    props: z.array(PropUsageSchema),      // Extracted prop usage
    hooks: z.array(z.string()).optional(), // ["useState", "useEffect"]
    hasInteractivity: z.boolean(),        // Uses event handlers?
    hasState: z.boolean(),                // Uses React state?
    complexity: z.number()                // Composition score from extractors.ts
  })
});

export type CodeExampleChunk = z.infer<typeof CodeExampleChunkSchema>;

// =============================================================================
// Chunk Type 4: Prop Reference
// =============================================================================
// Answers: "What's the X prop?" / "What's the type of X?"
// Example query: "What's the Button size prop?"
// Target size: 100-250 tokens
// =============================================================================

export const PropReferenceChunkSchema = z.object({
  metadata: ChunkMetadataSchema.extend({
    chunkType: z.literal('prop-reference')
  }),

  // Which prop
  prop: z.object({
    fullName: z.string(),                 // "Root.size" or "size"
    component: z.string().optional(),     // "Root" (for composite components)
    name: z.string(),                     // "size"
    category: PropCategorySchema
  }),

  // Natural language content for embedding (100-250 tokens)
  content: z.object({
    description: z.string(),              // "Controls the size of the button..."
    typeExplanation: z.string(),          // "Union type with 7 string options: 2xs, xs..."
    usageGuidance: z.string().optional(), // "Use md for primary actions..."
    defaultBehavior: z.string().optional() // "Defaults to 'md' if not specified"
  }),

  // Structured API reference
  apiReference: z.object({
    type: TypeInfoSchema,
    defaultValue: z.string().optional(),
    required: z.boolean(),
    eventSignature: z.string().optional(), // For event handlers: "(details: ChangeDetails) => void"
    relatedProps: z.array(z.string()).optional() // ["variant", "colorPalette"]
  })
});

export type PropReferenceChunk = z.infer<typeof PropReferenceChunkSchema>;

// =============================================================================
// Chunk Type 5: Prop Group
// =============================================================================
// Answers: "What appearance props are there?"
// Example query: "What props control Button appearance?"
// Target size: 300-500 tokens
// =============================================================================

export const PropGroupEntrySchema = z.object({
  name: z.string(),
  summary: z.string(),                    // One-line description
  options: z.string(),                    // "7 sizes: 2xs to 2xl" (natural language)
  default: z.string()
});

export type PropGroupEntry = z.infer<typeof PropGroupEntrySchema>;

export const PropGroupChunkSchema = z.object({
  metadata: ChunkMetadataSchema.extend({
    chunkType: z.literal('prop-group')
  }),

  // Group definition
  group: z.object({
    category: PropCategorySchema,
    title: z.string(),                    // "Appearance Props" | "State Props"
    intent: z.string()                    // "Control the visual appearance of Button"
  }),

  // Natural language content (300-500 tokens)
  content: z.object({
    overview: z.string(),                 // "Button provides three appearance props..."
    props: z.array(PropGroupEntrySchema), // Each prop in natural language
    combinations: z.string().optional()   // "You can combine size, variant, and colorPalette..."
  }),

  // Quick reference table (structured)
  reference: z.object({
    propNames: z.array(z.string()),
    commonPatterns: z.array(z.string())   // ["size='lg' variant='solid'"]
  })
});

export type PropGroupChunk = z.infer<typeof PropGroupChunkSchema>;

// =============================================================================
// Chunk Type 6: Composition Pattern
// =============================================================================
// Answers: "How to combine X with Y?"
// Example query: "How to add icons to buttons?"
// Target size: 300-600 tokens
// =============================================================================

export const PatternVariationSchema = z.object({
  name: z.string(),                       // "Icon on right" | "Icon only"
  description: z.string(),
  codeSnippet: z.string()
});

export type PatternVariation = z.infer<typeof PatternVariationSchema>;

export const CompositionPatternChunkSchema = z.object({
  metadata: ChunkMetadataSchema.extend({
    chunkType: z.literal('composition-pattern')
  }),

  // Pattern definition
  pattern: z.object({
    name: z.string(),                     // "Button with Icons" | "Checkbox in Forms"
    intent: z.string(),                   // "Add visual indicators to buttons"
    difficulty: z.enum(['basic', 'intermediate', 'advanced'])
  }),

  // Natural language content (300-600 tokens)
  content: z.object({
    explanation: z.string(),              // "To add icons to buttons, import the icon..."
    steps: z.array(z.string()),           // ["Import Button and icon", "Place icon as child"]
    code: z.string(),                     // Full example
    variations: z.array(PatternVariationSchema).optional(),
    commonIssues: z.array(z.string()).optional() // ["Icons must be wrapped in Button children"]
  }),

  // Structured metadata
  involves: z.object({
    components: z.array(z.string()),      // ["Button", "Icon"]
    props: z.array(z.string()),           // Props commonly used in this pattern
    externalDependencies: z.array(z.string()).optional() // ["react-icons/ri"]
  })
});

export type CompositionPatternChunk = z.infer<typeof CompositionPatternChunkSchema>;

// =============================================================================
// Chunk Type 7: API Reference
// =============================================================================
// Answers: "Complete API reference for X"
// Example query: "Show me all Button props"
// Target size: 150-300 tokens (summary + references)
// =============================================================================

export const APIReferenceChunkSchema = z.object({
  metadata: ChunkMetadataSchema.extend({
    chunkType: z.literal('api-reference')
  }),

  // Which component part
  componentPart: z.object({
    component: z.string(),                // "Button" or "ColorPicker"
    subcomponent: z.string().optional()   // "Root" | "Trigger" (for composite)
  }),

  // Natural language summary (150-300 tokens)
  content: z.object({
    summary: z.string(),                  // "Button.Root accepts 9 props, grouped into..."
    propGroups: z.record(z.string())      // { "appearance": "size, variant, colorPalette..." }
  }),

  // Complete structured reference
  props: z.array(z.string())              // References to PropReferenceChunk IDs
});

export type APIReferenceChunk = z.infer<typeof APIReferenceChunkSchema>;

// =============================================================================
// Union Type for All Chunks
// =============================================================================

export const NormalizedChunkSchema = z.union([
  ComponentOverviewChunkSchema,
  CapabilityReferenceChunkSchema,
  CodeExampleChunkSchema,
  PropReferenceChunkSchema,
  PropGroupChunkSchema,
  CompositionPatternChunkSchema,
  APIReferenceChunkSchema
]);

export type NormalizedChunk = z.infer<typeof NormalizedChunkSchema>;

// =============================================================================
// Helper Type Guards
// =============================================================================

export function isCodeExampleChunk(chunk: NormalizedChunk): chunk is CodeExampleChunk {
  return chunk.metadata.chunkType === 'code-example';
}

export function isCapabilityReferenceChunk(chunk: NormalizedChunk): chunk is CapabilityReferenceChunk {
  return chunk.metadata.chunkType === 'capability-reference';
}

export function isPropReferenceChunk(chunk: NormalizedChunk): chunk is PropReferenceChunk {
  return chunk.metadata.chunkType === 'prop-reference';
}

export function isComponentOverviewChunk(chunk: NormalizedChunk): chunk is ComponentOverviewChunk {
  return chunk.metadata.chunkType === 'component-overview';
}

export function isPropGroupChunk(chunk: NormalizedChunk): chunk is PropGroupChunk {
  return chunk.metadata.chunkType === 'prop-group';
}

export function isCompositionPatternChunk(chunk: NormalizedChunk): chunk is CompositionPatternChunk {
  return chunk.metadata.chunkType === 'composition-pattern';
}

export function isAPIReferenceChunk(chunk: NormalizedChunk): chunk is APIReferenceChunk {
  return chunk.metadata.chunkType === 'api-reference';
}

// =============================================================================
// Validation Utilities
// =============================================================================

/**
 * Validate a chunk and return typed result
 *
 * Usage:
 * const result = validateChunk(data);
 * if (result.success) {
 *   const chunk = result.data; // Fully typed
 * } else {
 *   console.error(result.error.format());
 * }
 */
export function validateChunk(data: unknown) {
  return NormalizedChunkSchema.safeParse(data);
}

/**
 * Estimate token count for text content
 * Rough heuristic: 1 token ≈ 4 characters
 *
 * Used for validation: chunks should be 150-500 weighted tokens
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Code weighting configuration
 *
 * Rationale: Embedding models compress code structure efficiently.
 * Syntax (import, const, return) is learned and contributes minimal semantic value.
 * Component names, prop values, and logic patterns carry most information.
 *
 * Weight: 0.40 (40%) balances:
 * - Preventing token inflation from verbose code
 * - Retaining enough weight for code complexity signals
 * - Conservative estimate (not too aggressive)
 */
const CODE_WEIGHT = 0.40;

/**
 * Estimate weighted tokens for chunk content
 *
 * Applies reduced weight to code blocks while counting natural language at full weight.
 * This prevents token inflation while retaining syntax context for embedding models.
 *
 * @param text - Natural language text (full weight)
 * @param code - Code blocks (reduced weight at 40%)
 * @returns Weighted token estimate
 *
 * @example
 * // Pure natural language
 * estimateWeightedTokens("This is a description", undefined)
 * // Returns: ~5 tokens
 *
 * @example
 * // Mixed content
 * estimateWeightedTokens("This is a description", "const x = 1;")
 * // Returns: ~7 tokens (5 from text + 0.8 from code)
 */
export function estimateWeightedTokens(text: string, code?: string): number {
  const textTokens = estimateTokens(text);

  if (!code) {
    return textTokens;
  }

  const codeTokens = estimateTokens(code) * CODE_WEIGHT;

  return Math.ceil(textTokens + codeTokens);
}

/**
 * Calculate weighted token count for a chunk
 *
 * Separates natural language from code and applies appropriate weights.
 * Code is weighted at 40% to reflect its lower semantic density in embeddings.
 *
 * Target: 150-500 weighted tokens for optimal embedding quality.
 * (Lowered from 200 minimum due to code weighting)
 *
 * @param chunk - Normalized chunk to analyze
 * @returns Weighted token count
 */
export function getChunkTokenCount(chunk: NormalizedChunk): number {
  if (isCodeExampleChunk(chunk)) {
    const naturalLanguage =
      chunk.content.explanation +
      chunk.content.demonstrates.join(' ') +
      (chunk.content.keyPoints?.join(' ') || '');

    return estimateWeightedTokens(naturalLanguage, chunk.content.code);

  } else if (isCapabilityReferenceChunk(chunk)) {
    const naturalLanguage =
      chunk.content.description +
      chunk.content.options.map(o => o.description + o.value).join(' ');

    // Capability chunks rarely have code
    return estimateTokens(naturalLanguage);

  } else if (isPropReferenceChunk(chunk)) {
    const naturalLanguage =
      chunk.content.description +
      chunk.content.typeExplanation +
      (chunk.content.usageGuidance || '') +
      (chunk.content.defaultBehavior || '');

    return estimateTokens(naturalLanguage);

  } else if (isComponentOverviewChunk(chunk)) {
    const naturalLanguage =
      chunk.content.description +
      chunk.content.capabilities.join(' ') +
      chunk.content.useCases.join(' ');

    return estimateTokens(naturalLanguage);

  } else if (isPropGroupChunk(chunk)) {
    const naturalLanguage =
      chunk.content.overview +
      chunk.content.props.map(p => p.summary).join(' ');

    return estimateTokens(naturalLanguage);

  } else if (isCompositionPatternChunk(chunk)) {
    const naturalLanguage =
      chunk.content.explanation +
      chunk.content.steps.join(' ');

    return estimateWeightedTokens(naturalLanguage, chunk.content.code);

  } else if (isAPIReferenceChunk(chunk)) {
    const naturalLanguage =
      chunk.content.summary +
      Object.values(chunk.content.propGroups).join(' ');

    return estimateTokens(naturalLanguage);
  }

  return 0;
}
