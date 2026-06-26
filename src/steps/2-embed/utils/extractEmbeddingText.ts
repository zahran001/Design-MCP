/**
 * Extract optimal embedding text from a normalized chunk
 *
 * This module provides chunk-type-aware text extraction for the embedder.
 * Each chunk type has specific fields that should be combined to create
 * rich, semantically meaningful text for embedding.
 *
 * Design Philosophy:
 * - Each chunk type has a dedicated extractor function
 * - Extractors combine fields specific to that chunk type
 * - Graceful error handling (fail fast with context if data is invalid)
 * - Extensible pattern for future chunk types
 *
 * Chunk Types Supported (4 of 7 implemented + embedded; routed below, lines ~57-71):
 * - ✅ CodeExampleChunk (fields: explanation, demonstrates, keyPoints)
 * - ✅ PropReferenceChunk (fields: description, typeExplanation, usageGuidance, defaultBehavior)
 * - ✅ ComponentOverviewChunk (extractComponentOverviewText)
 * - ✅ CapabilityReferenceChunk (extractCapabilityReferenceText)
 * - ⏳ PropGroupChunk (placeholder for future)
 * - ⏳ CompositionPatternChunk (placeholder for future)
 * - ⏳ APIReferenceChunk (placeholder for future)
 *
 * Proof (Qdrant collection `chakra-ui-docs`, points/count by chunkType, 2026-06-25):
 *   code-example 410, prop-reference 374, component-overview 50, capability-reference 63
 *   (total 897); prop-group / composition-pattern / api-reference = 0.
 */

import {
  NormalizedChunk,
  isCodeExampleChunk,
  isPropReferenceChunk,
  isComponentOverviewChunk,
  isCapabilityReferenceChunk,
  isPropGroupChunk,
  isCompositionPatternChunk,
  isAPIReferenceChunk,
  CodeExampleChunk,
  PropReferenceChunk,
  ComponentOverviewChunk,
  CapabilityReferenceChunk,
} from '../../../schemas/NormalizedChunkSchema.js';

/**
 * Extract embedding text from any normalized chunk
 *
 * Routes to chunk-type-specific extractors based on chunk discriminator.
 * This ensures we use the correct content fields for each chunk type.
 *
 * @param chunk - A normalized chunk (union of 7 chunk types)
 * @returns Embedding text (natural language string for vector generation)
 * @throws Error if chunk type is unsupported or has no extractable text
 *
 * @example
 * ```typescript
 * const chunk = loadChunk('button-prop-size-v1');
 * const text = extractEmbeddingText(chunk);
 * const vector = await embedder.embedText(text);
 * ```
 */
export function extractEmbeddingText(chunk: NormalizedChunk): string {
  if (isCodeExampleChunk(chunk)) {
    return extractCodeExampleText(chunk);
  }

  if (isPropReferenceChunk(chunk)) {
    return extractPropReferenceText(chunk);
  }

  if (isComponentOverviewChunk(chunk)) {
    return extractComponentOverviewText(chunk);
  }

  if (isCapabilityReferenceChunk(chunk)) {
    return extractCapabilityReferenceText(chunk);
  }

  // Placeholder extractors for remaining chunk types
  // Uncomment as chunk generators are implemented

  // if (isPropGroupChunk(chunk)) {
  //   return extractPropGroupText(chunk);
  // }

  // if (isCompositionPatternChunk(chunk)) {
  //   return extractCompositionPatternText(chunk);
  // }

  // if (isAPIReferenceChunk(chunk)) {
  //   return extractAPIReferenceText(chunk);
  // }

  throw new Error(
    `Unsupported chunk type: "${(chunk.metadata as any).chunkType}". ` +
    `Chunk ID: ${chunk.metadata.chunkId}. ` +
    `Currently supported: code-example, prop-reference, component-overview, capability-reference.`
  );
}

/**
 * Extract embedding text from ComponentOverviewChunk ("What is X?").
 *
 * Anchors on the component name, then the authentic description, the real
 * capability headings, and the code-derived common pairings. useCases is empty
 * by design (honest-minimal) and quickReference is intentionally NOT embedded.
 */
function extractComponentOverviewText(chunk: ComponentOverviewChunk): string {
  const parts: string[] = [];
  const componentName = chunk.metadata?.componentName;

  if (componentName) {
    parts.push(`Component: ${componentName}.`);
  }

  if (chunk.content?.description && chunk.content.description.trim()) {
    parts.push(chunk.content.description);
  }

  if (Array.isArray(chunk.content?.capabilities) && chunk.content.capabilities.length > 0) {
    parts.push(`Capabilities: ${chunk.content.capabilities.join(', ')}.`);
  }

  if (Array.isArray(chunk.content?.useCases) && chunk.content.useCases.length > 0) {
    parts.push(`Use cases: ${chunk.content.useCases.join(', ')}.`);
  }

  if (Array.isArray(chunk.content?.commonPairings) && chunk.content.commonPairings.length > 0) {
    parts.push(`Commonly used with: ${chunk.content.commonPairings.join(', ')}.`);
  }

  const text = joinTextParts(parts);

  if (!text) {
    throw new Error(
      `ComponentOverviewChunk has no extractable embedding text: ${chunk.metadata.chunkId}.`
    );
  }

  return text;
}

/**
 * Extract embedding text from CapabilityReferenceChunk ("What can X do?").
 *
 * Anchors on component + capability name, then the authentic section prose, then
 * the enumerable option values (e.g. "xs, sm, md, lg, xl"). Option descriptions
 * are empty by design (the values carry the signal).
 */
function extractCapabilityReferenceText(chunk: CapabilityReferenceChunk): string {
  const parts: string[] = [];
  const componentName = chunk.metadata?.componentName;

  if (componentName) {
    parts.push(`Component: ${componentName}.`);
  }

  if (chunk.capability?.name) {
    parts.push(`Capability: ${chunk.capability.name}.`);
  }

  if (chunk.content?.description && chunk.content.description.trim()) {
    parts.push(chunk.content.description);
  }

  if (Array.isArray(chunk.content?.options) && chunk.content.options.length > 0) {
    const values = chunk.content.options
      .map((o) => o.value)
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (values.length > 0) {
      parts.push(`Options: ${values.join(', ')}.`);
    }
  }

  const text = joinTextParts(parts);

  if (!text) {
    throw new Error(
      `CapabilityReferenceChunk has no extractable embedding text: ${chunk.metadata.chunkId}.`
    );
  }

  return text;
}

function joinTextParts(parts: string[]): string {
  return parts
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * Extract embedding text from CodeExampleChunk
 *
 * Metadata Anchors (prepended for vector disambiguation):
 * - Component Name: Anchors the vector to the correct component concept space
 * - Example Title: Disambiguates between multiple examples for the same component
 *
 * Content Fields Used (in order):
 * 1. explanation (primary content)
 *    - Human-written description of what the example does
 *    - Provides semantic context for vector generation
 *    - Example: "This example shows how to use different button sizes..."
 *
 * 2. demonstrates (tags/keywords)
 *    - Array of keywords describing what this example demonstrates
 *    - Adds specific technical terminology
 *    - Example: ["size prop usage", "responsive design", "HStack layout"]
 *
 * 3. keyPoints (technical details - optional)
 *    - Array of important takeaways or specific values
 *    - Adds concrete examples and constraints
 *    - Example: ["Size accepts xs|sm|md|lg|xl", "Use md for primary actions"]
 *
 * Combined Result:
 * "Component: Button. Title: Sizing. This example shows... size prop usage responsive design HStack layout..."
 *
 * Why This Combination:
 * - Metadata anchors prevent confusion between "Button size" and "Input size" examples
 * - explanation provides semantic richness for embedding
 * - demonstrates adds domain-specific keywords
 * - keyPoints adds concrete technical constraints
 * - Together they comprehensively describe "how to use this feature" for a specific component
 *
 * @param chunk - CodeExampleChunk
 * @returns Embedding text combining metadata anchors + all content fields
 * @throws Error if all content fields are empty
 *
 * @example
 * ```typescript
 * const text = extractCodeExampleText(chunk);
 * // "Component: Button. Title: Sizing. This example shows button sizing... size prop usage..."
 * ```
 */
function extractCodeExampleText(chunk: CodeExampleChunk): string {
  const parts: string[] = [];

  // METADATA ANCHORS: Add component name and title to prevent cross-component ambiguity
  const componentName = chunk.metadata?.componentName;
  const title = chunk.example?.title || 'Example';

  if (componentName) {
    parts.push(`Component: ${componentName}.`);
  }

  parts.push(`Title: ${title}.`);

  // 1. Add explanation (main content)
  if (chunk.content?.explanation && chunk.content.explanation.trim()) {
    parts.push(chunk.content.explanation);
  }

  // 2. Add demonstrates tags (what this demonstrates)
  if (Array.isArray(chunk.content?.demonstrates) && chunk.content.demonstrates.length > 0) {
    parts.push(...chunk.content.demonstrates.filter((item): item is string => Boolean(item) && typeof item === 'string'));
  }

  // 3. Add key points (technical details)
  if (Array.isArray(chunk.content?.keyPoints) && chunk.content.keyPoints.length > 0) {
    parts.push(...chunk.content.keyPoints.filter((item): item is string => Boolean(item) && typeof item === 'string'));
  }

  const text = joinTextParts(parts);

  if (!text) {
    throw new Error(
      `CodeExampleChunk has no extractable embedding text: ${chunk.metadata.chunkId}. ` +
      `All of explanation, demonstrates, and keyPoints are empty or missing.`
    );
  }

  return text;
}

/**
 * Extract embedding text from PropReferenceChunk
 *
 * Metadata Anchors (prepended for vector disambiguation):
 * - Component Name: Anchors the vector to the correct component (Button vs Input vs Checkbox)
 * - Prop Name: Anchors the vector to the specific prop (size vs variant vs colorScheme)
 *
 * Critical Fix for Ambiguity Trap:
 * Without these anchors, "Button size" and "Input size" produce nearly identical vectors
 * because both describe "Controls the size of the component". The anchors explicitly
 * separate the semantic spaces for polymorphic concepts across the design system.
 *
 * Content Fields Used (in order):
 * 1. description (primary content)
 *    - What does this prop do and what problem does it solve?
 *    - Provides the semantic core
 *    - Example: "Controls the size of the button..."
 *
 * 2. typeExplanation (type information)
 *    - What are the valid values for this prop?
 *    - Provides technical specificity
 *    - Example: "Union type with 7 string options: 2xs, xs, sm, md, lg, xl, 2xl"
 *
 * 3. usageGuidance (when to use - optional)
 *    - In what contexts should this prop be used?
 *    - Provides situational context
 *    - Example: "Use md for primary actions, sm for secondary buttons"
 *
 * 4. defaultBehavior (what's the default - optional)
 *    - What happens if this prop is not specified?
 *    - Provides fallback context
 *    - Example: "Defaults to 'md' if not specified"
 *
 * Combined Result:
 * "Component: Button. Prop: size. Controls the size... Union type with 7 options... Use md for primary... Defaults to md..."
 *
 * Why This Combination:
 * - Metadata anchors prevent Button size / Input size / Checkbox size confusion
 * - description answers "what does this prop do?" (semantic core)
 * - typeExplanation answers "what values can it have?" (technical spec)
 * - usageGuidance answers "when should I use it?" (contextual)
 * - defaultBehavior answers "what if I don't use it?" (safety)
 * - Together they fully answer "What is this prop and when should I use it?" WITH clear component scope
 *
 * This is optimal for embedding because it covers all dimensions of prop understanding
 * while eliminating cross-component ambiguity.
 *
 * @param chunk - PropReferenceChunk
 * @returns Embedding text combining metadata anchors + all content fields
 * @throws Error if description and typeExplanation (core fields) are empty
 *
 * @example
 * ```typescript
 * const text = extractPropReferenceText(chunk);
 * // "Component: Button. Prop: size. Controls the size... Union with 7 options..."
 * ```
 */
function extractPropReferenceText(chunk: PropReferenceChunk): string {
  const parts: string[] = [];

  // METADATA ANCHORS: Add component and prop names to prevent cross-component ambiguity
  const componentName = chunk.metadata?.componentName;
  const propName = chunk.prop?.fullName || chunk.prop?.name || 'unknown';

  if (componentName) {
    parts.push(`Component: ${componentName}.`);
  }

  parts.push(`Prop: ${propName}.`);

  // 1. Add description (what does this prop do)
  if (chunk.content?.description && chunk.content.description.trim()) {
    parts.push(chunk.content.description);
  }

  // 2. Add type explanation (what values are accepted)
  if (chunk.content?.typeExplanation && chunk.content.typeExplanation.trim()) {
    parts.push(chunk.content.typeExplanation);
  }

  // 3. Add usage guidance (when/how to use - optional)
  if (chunk.content?.usageGuidance && chunk.content.usageGuidance.trim()) {
    parts.push(chunk.content.usageGuidance);
  }

  // 4. Add default behavior (what's the default - optional)
  if (chunk.content?.defaultBehavior && chunk.content.defaultBehavior.trim()) {
    parts.push(chunk.content.defaultBehavior);
  }

  const text = joinTextParts(parts);

  if (!text) {
    throw new Error(
      `PropReferenceChunk has no extractable embedding text: ${chunk.metadata.chunkId}. ` +
      `Missing or empty description and typeExplanation (required fields).`
    );
  }

  return text;
}

// =============================================================================
// Placeholder Extractors for Future Chunk Types
// =============================================================================
// Implement these when corresponding chunk generators are created

// function extractComponentOverviewText(chunk: ComponentOverviewChunk): string {
//   // TODO: Implement when ComponentOverviewChunk generator is ready
//   // Expected fields: title, description, keyCapabilities, useCases
//   throw new Error('ComponentOverviewChunk extraction not yet implemented');
// }

// function extractCapabilityReferenceText(chunk: CapabilityReferenceChunk): string {
//   // TODO: Implement when CapabilityReferenceChunk generator is ready
//   // Expected fields: capability, description, examples, benefits
//   throw new Error('CapabilityReferenceChunk extraction not yet implemented');
// }

// function extractPropGroupText(chunk: PropGroupChunk): string {
//   // TODO: Implement when PropGroupChunk generator is ready
//   // Expected fields: group.title, content.overview, content.props
//   throw new Error('PropGroupChunk extraction not yet implemented');
// }

// function extractCompositionPatternText(chunk: CompositionPatternChunk): string {
//   // TODO: Implement when CompositionPatternChunk generator is ready
//   // Expected fields: pattern.name, content.description, content.variations
//   throw new Error('CompositionPatternChunk extraction not yet implemented');
// }

// function extractAPIReferenceText(chunk: APIReferenceChunk): string {
//   // TODO: Implement when APIReferenceChunk generator is ready
//   // Expected fields: api.name, content.summary, content.signature
//   throw new Error('APIReferenceChunk extraction not yet implemented');
// }
