// =============================================================================
// Transformation Context
// =============================================================================
// Created: 2025-10-26
// Purpose: Track metrics, warnings, and state during transformation
//
// Provides a context object that travels through the transformation pipeline,
// collecting metrics, warnings, and debugging information.
//
// =============================================================================

import type { TransformationPhase } from './transformerErrors.js';

/**
 * Metrics collected during transformation
 */
export interface TransformationMetrics {
  /** Time spent in code analysis (ms) */
  analysisTimeMs?: number;

  /** Time spent in inference (section + intent) (ms) */
  inferenceTimeMs?: number;

  /** Time spent in content generation (ms) */
  generationTimeMs?: number;

  /** Total token count */
  tokenCount?: number;

  /** Patterns that matched during inference */
  patternMatches: string[];

  /** Confidence scores */
  confidenceScores?: {
    section?: number;
    intent?: number;
  };
}

/**
 * Warning collected during transformation
 */
export interface TransformationWarning {
  /** Warning phase */
  phase: TransformationPhase;

  /** Warning message */
  message: string;

  /** Timestamp */
  timestamp: number;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Transformation context
 *
 * Tracks state, metrics, and warnings throughout the transformation pipeline
 */
export interface TransformationContext {
  /** Component being processed */
  componentName: string;

  /** Example index (1-based) */
  exampleIndex?: number;

  /** Total examples for this component */
  totalExamples?: number;

  /** When transformation started */
  startTime: number;

  /** Collected warnings */
  warnings: TransformationWarning[];

  /** Collected metrics */
  metrics: TransformationMetrics;

  /** Custom data (for extensions) */
  customData?: Record<string, unknown>;
}

/**
 * Create a new transformation context
 *
 * @param componentName - Component being processed
 * @param exampleIndex - Example index (optional)
 * @param totalExamples - Total examples for component (optional)
 * @returns New transformation context
 *
 * @example
 * const ctx = createContext('Button', 5, 16);
 */
export function createContext(
  componentName: string,
  exampleIndex?: number,
  totalExamples?: number
): TransformationContext {
  return {
    componentName,
    exampleIndex,
    totalExamples,
    startTime: Date.now(),
    warnings: [],
    metrics: {
      patternMatches: []
    }
  };
}

/**
 * Add a warning to the context
 *
 * @param ctx - Transformation context
 * @param phase - Phase where warning occurred
 * @param message - Warning message
 * @param context - Additional context (optional)
 *
 * @example
 * addWarning(ctx, 'inference', 'Low confidence: 0.5', { confidence: 0.5 });
 */
export function addWarning(
  ctx: TransformationContext,
  phase: TransformationPhase,
  message: string,
  context?: Record<string, unknown>
): void {
  ctx.warnings.push({
    phase,
    message,
    timestamp: Date.now(),
    context
  });
}

/**
 * Record a metric value
 *
 * @param ctx - Transformation context
 * @param metric - Metric name
 * @param value - Metric value
 *
 * @example
 * recordMetric(ctx, 'analysisTimeMs', 15);
 * recordMetric(ctx, 'tokenCount', 320);
 */
export function recordMetric(
  ctx: TransformationContext,
  metric: keyof Omit<TransformationMetrics, 'patternMatches' | 'confidenceScores'>,
  value: number
): void {
  (ctx.metrics as any)[metric] = value;
}

/**
 * Add a pattern match to metrics
 *
 * @param ctx - Transformation context
 * @param pattern - Pattern that matched
 *
 * @example
 * addPatternMatch(ctx, 'multiple_size_values');
 */
export function addPatternMatch(ctx: TransformationContext, pattern: string): void {
  ctx.metrics.patternMatches.push(pattern);
}

/**
 * Record confidence scores
 *
 * @param ctx - Transformation context
 * @param type - Score type ('section' or 'intent')
 * @param score - Confidence score (0-1)
 *
 * @example
 * recordConfidence(ctx, 'intent', 0.85);
 */
export function recordConfidence(
  ctx: TransformationContext,
  type: 'section' | 'intent',
  score: number
): void {
  if (!ctx.metrics.confidenceScores) {
    ctx.metrics.confidenceScores = {};
  }
  ctx.metrics.confidenceScores[type] = score;
}

/**
 * Get total transformation time
 *
 * @param ctx - Transformation context
 * @returns Total time in milliseconds
 *
 * @example
 * const totalTime = getTotalTime(ctx);
 * console.log(`Transformation took ${totalTime}ms`);
 */
export function getTotalTime(ctx: TransformationContext): number {
  return Date.now() - ctx.startTime;
}

/**
 * Get context identifier (for logging)
 *
 * @param ctx - Transformation context
 * @returns Context identifier string
 *
 * @example
 * getContextId(ctx) // Returns: "Button example 5/16"
 */
export function getContextId(ctx: TransformationContext): string {
  if (ctx.exampleIndex !== undefined && ctx.totalExamples !== undefined) {
    return `${ctx.componentName} example ${ctx.exampleIndex}/${ctx.totalExamples}`;
  }
  return ctx.componentName;
}

/**
 * Check if context has warnings
 *
 * @param ctx - Transformation context
 * @returns True if warnings exist
 */
export function hasWarnings(ctx: TransformationContext): boolean {
  return ctx.warnings.length > 0;
}

/**
 * Get warnings for a specific phase
 *
 * @param ctx - Transformation context
 * @param phase - Phase to filter by
 * @returns Array of warnings for that phase
 */
export function getWarningsForPhase(
  ctx: TransformationContext,
  phase: TransformationPhase
): TransformationWarning[] {
  return ctx.warnings.filter(w => w.phase === phase);
}

/**
 * Create a summary of the transformation context
 *
 * @param ctx - Transformation context
 * @returns Summary object
 */
export function createSummary(ctx: TransformationContext): {
  contextId: string;
  totalTimeMs: number;
  warnings: number;
  metrics: TransformationMetrics;
} {
  return {
    contextId: getContextId(ctx),
    totalTimeMs: getTotalTime(ctx),
    warnings: ctx.warnings.length,
    metrics: ctx.metrics
  };
}

/**
 * Measure execution time of a function and record it
 *
 * @param ctx - Transformation context
 * @param metric - Metric name to record
 * @param fn - Function to execute
 * @returns Function result
 *
 * @example
 * const analysis = measureTime(ctx, 'analysisTimeMs', () => analyzeCode(code));
 */
export function measureTime<T>(
  ctx: TransformationContext,
  metric: keyof Omit<TransformationMetrics, 'patternMatches' | 'confidenceScores'>,
  fn: () => T
): T {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;
  recordMetric(ctx, metric, duration);
  return result;
}

/**
 * Measure async execution time and record it
 *
 * @param ctx - Transformation context
 * @param metric - Metric name to record
 * @param fn - Async function to execute
 * @returns Function result
 *
 * @example
 * const data = await measureTimeAsync(ctx, 'analysisTimeMs', async () => await analyzeCodeAsync(code));
 */
export async function measureTimeAsync<T>(
  ctx: TransformationContext,
  metric: keyof Omit<TransformationMetrics, 'patternMatches' | 'confidenceScores'>,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    return result;
  } finally {
    const duration = Date.now() - start;
    recordMetric(ctx, metric, duration);
  }
}

/**
 * Set custom data in context
 *
 * @param ctx - Transformation context
 * @param key - Data key
 * @param value - Data value
 */
export function setCustomData(
  ctx: TransformationContext,
  key: string,
  value: unknown
): void {
  if (!ctx.customData) {
    ctx.customData = {};
  }
  ctx.customData[key] = value;
}

/**
 * Get custom data from context
 *
 * @param ctx - Transformation context
 * @param key - Data key
 * @returns Data value or undefined
 */
export function getCustomData<T = unknown>(
  ctx: TransformationContext,
  key: string
): T | undefined {
  return ctx.customData?.[key] as T | undefined;
}
