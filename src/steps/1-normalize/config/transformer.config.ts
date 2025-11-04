// =============================================================================
// Transformer Configuration
// =============================================================================
// Created: 2025-10-26
// Purpose: Central configuration for transformer behavior
//
// Contains version information, thresholds, limits, and behavioral settings
// for the code example transformation pipeline.
//
// =============================================================================

/**
 * Transformer configuration
 *
 * All configurable settings for the transformation pipeline in one place.
 * This replaces hardcoded values throughout the codebase.
 */
export const TRANSFORMER_CONFIG = {
  /**
   * Library version being processed
   * Used in chunk metadata
   */
  version: '3.27.1',

  /**
   * Token count limits for chunk quality
   *
   * Chunks outside this range will trigger warnings.
   * Based on optimal embedding model performance (200-500 tokens).
   */
  tokenLimits: {
    min: 150,              // Absolute minimum (too small = low context)
    max: 600,              // Absolute maximum (too large = diluted semantics)
    optimal: {
      min: 200,            // Preferred minimum
      max: 500             // Preferred maximum
    }
  },

  /**
   * Confidence thresholds for inference
   *
   * Used to flag low-confidence classifications for review.
   */
  confidenceThresholds: {
    intent: 0.6,           // Below this = low confidence intent classification
    section: 0.5           // Below this = use fallback section title
  },

  /**
   * Fallback behavior configuration
   *
   * Determines how the transformer handles various error conditions.
   */
  fallbackBehavior: {
    /**
     * What to do when input validation fails
     * - 'create_minimal_chunk': Create minimal chunk with available data
     * - 'throw_error': Throw error and stop processing (strict mode)
     */
    onInvalidInput: 'create_minimal_chunk' as const,

    /**
     * What to do when code analysis fails
     * - 'use_fallback_chunk': Create fallback chunk with partial data
     * - 'throw_error': Throw error and stop processing
     */
    onAnalysisFailure: 'use_fallback_chunk' as const,

    /**
     * What to do when confidence is below threshold
     * - 'log_warning': Log warning but continue
     * - 'use_fallback': Switch to fallback/generic intent
     * - 'throw_error': Treat as error
     */
    onLowConfidence: 'log_warning' as const
  },

  /**
   * Metrics and logging configuration
   */
  metrics: {
    enabled: true,                    // Enable metrics tracking
    logToConsole: true,               // Log metrics to console
    logToFile: true,                  // Write metrics to file
    logPath: 'artifacts/metrics',     // Metrics file location
    includeTimings: true,             // Track transformation timing
    includePatternMatches: true       // Track which patterns matched
  },

  /**
   * Error logging configuration
   */
  logging: {
    enabled: true,                    // Enable error logging
    logToConsole: true,               // Log errors to console
    logToFile: true,                  // Write errors to file
    logPath: 'artifacts/logs',        // Error log file location
    logLevel: 'warn' as const,        // Minimum log level: 'error' | 'warn' | 'info' | 'debug'
    includeStackTrace: true           // Include stack traces in error logs
  },

  /**
   * Complexity scoring
   *
   * Default complexity score for examples without a score.
   */
  defaultComplexity: 5,

  /**
   * Import type defaults
   *
   * Default import type when type cannot be determined.
   */
  defaultImportType: 'named' as const

} as const;

/**
 * Type for transformer configuration
 */
export type TransformerConfig = typeof TRANSFORMER_CONFIG;

/**
 * Get configuration value by path
 *
 * @example
 * getConfigValue('version') // Returns: "3.27.1"
 * getConfigValue('tokenLimits.optimal.min') // Returns: 200
 */
export function getConfigValue(path: string): any {
  const keys = path.split('.');
  let value: any = TRANSFORMER_CONFIG;

  for (const key of keys) {
    value = value?.[key];
    if (value === undefined) {
      throw new Error(`Config path not found: ${path}`);
    }
  }

  return value;
}

/**
 * Check if a token count is within optimal range
 *
 * @param tokenCount - Token count to check
 * @returns True if within optimal range
 */
export function isOptimalTokenCount(tokenCount: number): boolean {
  return tokenCount >= TRANSFORMER_CONFIG.tokenLimits.optimal.min &&
         tokenCount <= TRANSFORMER_CONFIG.tokenLimits.optimal.max;
}

/**
 * Check if a token count is within acceptable range
 *
 * @param tokenCount - Token count to check
 * @returns True if within min/max bounds
 */
export function isAcceptableTokenCount(tokenCount: number): boolean {
  return tokenCount >= TRANSFORMER_CONFIG.tokenLimits.min &&
         tokenCount <= TRANSFORMER_CONFIG.tokenLimits.max;
}

/**
 * Check if a confidence score meets threshold
 *
 * @param confidence - Confidence score (0-1)
 * @param type - Type of confidence ('intent' | 'section')
 * @returns True if meets threshold
 */
export function meetsConfidenceThreshold(
  confidence: number,
  type: 'intent' | 'section'
): boolean {
  return confidence >= TRANSFORMER_CONFIG.confidenceThresholds[type];
}
