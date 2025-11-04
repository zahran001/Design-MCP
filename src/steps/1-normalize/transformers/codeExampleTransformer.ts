// =============================================================================
// Code Example Transformer
// =============================================================================
// Created: 2025-10-23
// Purpose: Transform raw code examples into normalized CodeExampleChunks
//
// This is the main transformation orchestrator that combines:
// - Inference engine (analyze, infer, classify)
// - Template generators (extract data, generate content)
// - Chunk assembly (metadata + content + code metadata)
//
// =============================================================================

import { analyzeCode, type EnhancedImport } from '../inference/codeAnalyzer.js';
import { inferSectionTitle } from '../inference/sectionInferrer.js';
import { classifyIntent } from '../inference/intentClassifier.js';
import { extractTemplateData } from '../generators/templateDataExtractor.js';
import { generateContent } from '../generators/explanationGenerator.js';
import { generateChunkId } from '../../../utils/chunkId.js';
import { estimateChunkTokens } from '../../../utils/tokenEstimator.js';
import { getCategoryFromComponent } from '../config/categories.config.js';
import { validateRawCodeExample, formatValidationErrors } from '../schemas/RawCodeExampleSchema.js';
import { createAppropriateFallback } from '../utils/fallbackChunks.js';
import { createContext, addWarning, addPatternMatch, recordMetric, recordConfidence, type TransformationMetrics, type TransformationWarning } from '../utils/transformationContext.js';
import { logSuccess, logFailure } from '../utils/transformationMetrics.js';
import { TransformationError } from '../utils/transformerErrors.js';
import type { CodeExampleChunk, ComponentCategory, ImportStatement, PropUsage } from '../../../schemas/NormalizedChunkSchema.js';
import type { TRANSFORMER_CONFIG } from '../config/transformer.config.js';

/**
 * Raw code example from extracted JSON
 */
export interface RawCodeExample {
  code: string;
  score?: number;
  complexity?: string;
  section?: string;
}

// =============================================================================
// Stage 4: Transformer API Types
// =============================================================================

/**
 * Configuration options for transformer (partial override)
 */
export type TransformerConfig = typeof TRANSFORMER_CONFIG;

/**
 * Options for code example transformation
 *
 * This is the new API signature for transformCodeExample().
 * Provides a structured, extensible interface for transformation.
 *
 * @example
 * ```typescript
 * const result = transformCodeExample({
 *   rawExample: { code: "<Button>...</Button>" },
 *   componentName: "Button",
 *   sourceUrl: "https://chakra-ui.com/docs/components/button",
 *   context: { exampleIndex: 1, totalExamples: 16 }
 * });
 * ```
 */
export interface TransformerOptions {
  /** Raw code example to transform */
  rawExample: RawCodeExample;

  /** Component name (e.g., "Button") */
  componentName: string;

  /** Source documentation URL */
  sourceUrl: string;

  /** Optional context for tracking/metrics */
  context?: {
    /** 1-based index of this example */
    exampleIndex?: number;
    /** Total number of examples for this component */
    totalExamples?: number;
  };

  /** Optional configuration overrides (future use) */
  config?: Partial<TransformerConfig>;
}

/**
 * Successful transformation result
 *
 * Returned when transformation completes successfully.
 * Includes the generated chunk, metrics, and any warnings.
 */
export interface TransformationSuccess {
  /** Result status */
  status: 'success';

  /** Generated code example chunk */
  chunk: CodeExampleChunk;

  /** Collected metrics during transformation */
  metrics: TransformationMetrics;

  /** Warnings collected during transformation */
  warnings: TransformationWarning[];
}

/**
 * Failed transformation result
 *
 * Returned when transformation fails (validation, analysis, etc.).
 * Includes the error, optional fallback chunk, and partial metrics.
 */
export interface TransformationFailure {
  /** Result status */
  status: 'failure';

  /** Error that caused the failure */
  error: TransformationError | Error;

  /** Optional fallback chunk (generated on best-effort basis) */
  fallbackChunk?: CodeExampleChunk;

  /** Partial metrics collected before failure */
  metrics: Partial<TransformationMetrics>;

  /** Warnings collected before failure */
  warnings: TransformationWarning[];
}

/**
 * Transformation result (success or failure)
 *
 * Discriminated union type for explicit success/failure handling.
 *
 * @example
 * ```typescript
 * const result = transformCodeExample(options);
 *
 * if (result.status === 'success') {
 *   console.log('Success!', result.chunk);
 *   console.log('Metrics:', result.metrics);
 * } else {
 *   console.error('Failed:', result.error);
 *   if (result.fallbackChunk) {
 *     console.log('Using fallback chunk');
 *   }
 * }
 * ```
 */
export type TransformationResult = TransformationSuccess | TransformationFailure;

/**
 * Convert EnhancedImport to schema-expected ImportStatement format
 */
function convertToSchemaImports(enhancedImports: EnhancedImport[]): ImportStatement[] {
  return enhancedImports.map(imp => {
    const imports: string[] = [];
    let type: 'default' | 'named' | 'namespace' = 'named';

    if (imp.defaultImport) {
      imports.push(imp.defaultImport);
      type = 'default';
    }

    if (imp.namedImports && imp.namedImports.length > 0) {
      imports.push(...imp.namedImports);
      type = imp.defaultImport ? 'named' : 'named'; // Mixed becomes named for schema
    }

    if (imp.namespaceImport) {
      imports.push(imp.namespaceImport);
      type = 'namespace';
    }

    return {
      source: imp.source,
      imports,
      type
    };
  });
}

/**
 * Convert enhanced PropUsage to schema-expected format (with string[] values)
 */
function convertToSchemaProps(props: import('../inference/codeAnalyzer.js').PropUsage[]): PropUsage[] {
  return props.map(p => ({
    component: p.component,
    prop: p.prop,
    values: p.rawValues || p.values.map(v => v.raw)
  }));
}

/**
 * Transform a raw code example into a normalized CodeExampleChunk
 *
 * **NEW API (Stage 4)**: Now uses options object and returns explicit success/failure results.
 *
 * Orchestrates the complete transformation pipeline:
 * 1. Input validation (with fallback generation on failure)
 * 2. Code analysis (extract imports, components, props, hooks)
 * 3. Section inference (detect semantic title from patterns)
 * 4. Intent classification (sizing, variants, states, etc.)
 * 5. Natural language generation (explanation, demonstrates, keyPoints)
 * 6. Chunk assembly (metadata + content + codeMetadata)
 * 7. Metrics logging (timing, confidence, patterns, warnings)
 *
 * @param options - Transformation options
 * @returns TransformationResult with explicit success/failure status
 *
 * @example
 * ```typescript
 * // New API (recommended)
 * const result = transformCodeExample({
 *   rawExample: { code: "<Button size='xs'>...</Button>", complexity: "intermediate" },
 *   componentName: "Button",
 *   sourceUrl: "https://chakra-ui.com/docs/components/button",
 *   context: { exampleIndex: 1, totalExamples: 16 }
 * });
 *
 * if (result.status === 'success') {
 *   console.log('Chunk:', result.chunk);
 *   console.log('Metrics:', result.metrics);
 * } else {
 *   console.error('Error:', result.error);
 *   if (result.fallbackChunk) {
 *     console.log('Using fallback');
 *   }
 * }
 * ```
 */
export function transformCodeExample(
  options: TransformerOptions
): TransformationResult {
  // Destructure options
  const { rawExample, componentName, sourceUrl, context, config } = options;
  const exampleIndex = context?.exampleIndex;
  const totalExamples = context?.totalExamples;
  // Create transformation context for metrics tracking
  const ctx = createContext(componentName, exampleIndex, totalExamples);

  try {
    // ==========================================================================
    // Step 0: Input Validation
    // ==========================================================================

    const validation = validateRawCodeExample(rawExample);

    if (!validation.success) {
      const errors = formatValidationErrors(validation.error);
      const errorMsg = `Input validation failed: ${errors.join(', ')}`;

      // Log validation failure
      console.warn(`   ⚠️  Validation failed for ${componentName}: ${errorMsg}`);

      // Create validation error
      const validationError = new TransformationError(errorMsg, 'validation');

      // Log failure
      logFailure(ctx, validationError);

      // Generate fallback chunk
      const fallbackChunk = createAppropriateFallback(
        rawExample,
        componentName,
        sourceUrl,
        validationError
      );

      // Return failure result
      return {
        status: 'failure',
        error: validationError,
        fallbackChunk,
        metrics: ctx.metrics,
        warnings: ctx.warnings
      };
    }

    // Use validated data
    const validatedExample = validation.data;

    // ==========================================================================
    // Step 1: Run Inference Pipeline
    // ==========================================================================

    // Analyze code structure (with timing)
    const analysisStart = Date.now();
    const analysis = analyzeCode(validatedExample.code);
    recordMetric(ctx, 'analysisTimeMs', Date.now() - analysisStart);

    // Infer semantic section title (with timing)
    const inferenceStart = Date.now();
    const section = inferSectionTitle(
      validatedExample.code,
      validatedExample.section,
      componentName
    );

    // Classify intent/purpose
    const intent = classifyIntent(
      validatedExample.code,
      analysis,
      section.title
    );
    recordMetric(ctx, 'inferenceTimeMs', Date.now() - inferenceStart);

    // Record confidence scores
    recordConfidence(ctx, 'section', section.confidence);
    recordConfidence(ctx, 'intent', intent.confidence);

    // Add pattern matches
    if (section.matchedPattern) {
      addPatternMatch(ctx, section.matchedPattern);
    }
    intent.indicators.forEach(ind => addPatternMatch(ctx, ind));

    // Warn on low confidence
    if (section.confidence < 0.5) {
      addWarning(ctx, 'inference', `Low section confidence: ${section.confidence.toFixed(2)}`);
    }
    if (intent.confidence < 0.6) {
      addWarning(ctx, 'inference', `Low intent confidence: ${intent.confidence.toFixed(2)}`);
    }

    // ==========================================================================
    // Step 2: Generate Natural Language Content
    // ==========================================================================

    const generationStart = Date.now();

    // Extract template data
    const templateData = extractTemplateData(
      intent.intent,
      analysis,
      componentName
    );

    // Generate natural language
    const content = generateContent(templateData);

    recordMetric(ctx, 'generationTimeMs', Date.now() - generationStart);

    // ==========================================================================
    // Step 3: Generate Metadata
    // ==========================================================================

    // Generate unique chunk ID
    const chunkId = generateChunkId(
      componentName,
      'code-example',
      section.title,
      '1' // Version
    );

    // Determine component category (from configuration)
    const category = getCategoryFromComponent(componentName);

    // Generate tags (just intent for POC)
    // TODO: Future enhancement - derive multiple tags from intent + patterns
    // See: POC_NORMALIZATION_DECISIONS.md#future-enhancements
    const tags = [intent.intent];

    // Get complexity from raw JSON (fallback to intermediate)
    const complexity = validatedExample.complexity || 'intermediate';

    // Estimate token count (for quality metrics)
    const tokens = estimateChunkTokens({
      explanation: content.explanation,
      code: validatedExample.code,
      demonstrates: content.demonstrates,
      keyPoints: content.keyPoints
    });

    // Record token count metric
    recordMetric(ctx, 'tokenCount', tokens);

    // Warn on token count outside optimal range
    if (tokens < 200) {
      addWarning(ctx, 'generation', `Token count too low: ${tokens} tokens`);
      console.log(`   ⚠️  Token count outside optimal range: ${tokens} tokens`);
    } else if (tokens > 500) {
      addWarning(ctx, 'generation', `Token count too high: ${tokens} tokens`);
      console.log(`   ⚠️  Token count outside optimal range: ${tokens} tokens`);
    }

    // ==========================================================================
    // Step 4: Assemble Complete Chunk
    // ==========================================================================

    const chunk: CodeExampleChunk = {
      metadata: {
        chunkId,
        chunkType: 'code-example',
        componentName,
        sourceUrl,
        version: '3.27.1',
        tags,
        category,
        complexity: complexity as 'simple' | 'intermediate' | 'advanced',
        relatedChunks: []
      },

      example: {
        title: section.title,
        intent: intent.intent,
        difficulty: complexity as 'basic' | 'intermediate' | 'advanced'
      },

      content: {
        explanation: content.explanation,
        code: validatedExample.code,
        demonstrates: content.demonstrates,
        keyPoints: content.keyPoints
      },

      codeMetadata: {
        language: 'tsx',
        imports: convertToSchemaImports(analysis.imports),
        components: analysis.components,
        props: convertToSchemaProps(analysis.props),
        hooks: analysis.hooks.length > 0 ? analysis.hooks : undefined, // Optional field
        hasInteractivity: analysis.hasInteractivity,
        hasState: analysis.hasState,
        complexity: validatedExample.score || 5
      }
    };

    // Log successful transformation
    logSuccess(ctx);

    // Return success result
    return {
      status: 'success',
      chunk,
      metrics: ctx.metrics,
      warnings: ctx.warnings
    };

  } catch (error) {
    // Handle unexpected errors during transformation
    const err = error instanceof Error ? error : new Error(String(error));

    // Convert to TransformationError if not already
    const transformationError = err instanceof TransformationError
      ? err
      : new TransformationError(err.message, 'assembly', err);

    // Log failure with metrics
    logFailure(ctx, transformationError);

    // Generate fallback chunk
    const fallbackChunk = createAppropriateFallback(
      rawExample,
      componentName,
      sourceUrl,
      transformationError
    );

    // Return failure result
    return {
      status: 'failure',
      error: transformationError,
      fallbackChunk,
      metrics: ctx.metrics,
      warnings: ctx.warnings
    };
  }
}

// =============================================================================
// Stage 4: Backward Compatibility
// =============================================================================

/**
 * Transform a raw code example (legacy API)
 *
 * **DEPRECATED**: This function is provided for backward compatibility only.
 * Use `transformCodeExample` with options object instead.
 *
 * This wrapper maintains the old positional parameter API while internally
 * using the new options-based API. It returns only the chunk (or fallback chunk)
 * without exposing metrics or warnings.
 *
 * @deprecated Use transformCodeExample with options object instead
 * @param rawExample - Raw code example from extracted JSON
 * @param componentName - Component name (e.g., "Button")
 * @param sourceUrl - Source documentation URL
 * @param exampleIndex - Optional 1-based index of this example
 * @param totalExamples - Optional total number of examples
 * @returns CodeExampleChunk (or fallback chunk on failure)
 *
 * @example
 * ```typescript
 * // Old API (deprecated)
 * const chunk = transformCodeExampleLegacy(
 *   { code: "<Button>...</Button>" },
 *   "Button",
 *   "https://chakra-ui.com/docs/components/button",
 *   1,
 *   16
 * );
 *
 * // New API (recommended)
 * const result = transformCodeExample({
 *   rawExample: { code: "<Button>...</Button>" },
 *   componentName: "Button",
 *   sourceUrl: "https://chakra-ui.com/docs/components/button",
 *   context: { exampleIndex: 1, totalExamples: 16 }
 * });
 * const chunk = result.status === 'success' ? result.chunk : result.fallbackChunk!;
 * ```
 */
export function transformCodeExampleLegacy(
  rawExample: RawCodeExample,
  componentName: string,
  sourceUrl: string,
  exampleIndex?: number,
  totalExamples?: number
): CodeExampleChunk {
  // Call new API with options object
  const result = transformCodeExample({
    rawExample,
    componentName,
    sourceUrl,
    context: { exampleIndex, totalExamples }
  });

  // Return chunk regardless of success/failure (backward compatible behavior)
  if (result.status === 'success') {
    return result.chunk;
  } else {
    // Return fallback chunk if available, otherwise throw
    if (result.fallbackChunk) {
      return result.fallbackChunk;
    } else {
      // This should never happen (fallback generation should always succeed),
      // but throw error if it does
      throw result.error;
    }
  }
}
