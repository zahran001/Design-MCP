// =============================================================================
// Transformer Error Types
// =============================================================================
// Created: 2025-10-26
// Purpose: Custom error types for transformation pipeline
//
// Provides specific error types for each phase of transformation to enable
// better error handling, logging, and debugging.
//
// =============================================================================

/**
 * Transformation phase where error occurred
 */
export type TransformationPhase =
  | 'validation'     // Input validation failed
  | 'analysis'       // Code analysis failed
  | 'inference'      // Section/intent inference failed
  | 'generation'     // Content generation failed
  | 'assembly';      // Chunk assembly failed

/**
 * Base transformation error
 *
 * Extended by specific error types for each phase
 */
export class TransformationError extends Error {
  constructor(
    message: string,
    public readonly phase: TransformationPhase,
    public readonly originalError?: Error,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TransformationError';

    // Maintains proper stack trace for where error was thrown (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get error details for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      phase: this.phase,
      context: this.context,
      originalError: this.originalError?.message,
      stack: this.stack
    };
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(): string {
    return `${this.phase} failed: ${this.message}`;
  }
}

/**
 * Validation error - thrown when input validation fails
 *
 * Occurs during: Input validation with Zod schema
 */
export class ValidationError extends TransformationError {
  constructor(message: string, originalError?: Error, context?: Record<string, unknown>) {
    super(message, 'validation', originalError, context);
    this.name = 'ValidationError';
  }
}

/**
 * Analysis error - thrown when code analysis fails
 *
 * Occurs during: Code structure extraction (imports, components, props)
 */
export class AnalysisError extends TransformationError {
  constructor(message: string, originalError?: Error, context?: Record<string, unknown>) {
    super(message, 'analysis', originalError, context);
    this.name = 'AnalysisError';
  }
}

/**
 * Inference error - thrown when section/intent inference fails
 *
 * Occurs during: Section title inference or intent classification
 */
export class InferenceError extends TransformationError {
  constructor(message: string, originalError?: Error, context?: Record<string, unknown>) {
    super(message, 'inference', originalError, context);
    this.name = 'InferenceError';
  }
}

/**
 * Generation error - thrown when content generation fails
 *
 * Occurs during: Natural language explanation generation
 */
export class GenerationError extends TransformationError {
  constructor(message: string, originalError?: Error, context?: Record<string, unknown>) {
    super(message, 'generation', originalError, context);
    this.name = 'GenerationError';
  }
}

/**
 * Assembly error - thrown when chunk assembly fails
 *
 * Occurs during: Final chunk object construction
 */
export class AssemblyError extends TransformationError {
  constructor(message: string, originalError?: Error, context?: Record<string, unknown>) {
    super(message, 'assembly', originalError, context);
    this.name = 'AssemblyError';
  }
}

/**
 * Type guard to check if error is a transformation error
 *
 * @param error - Error to check
 * @returns True if error is a TransformationError
 */
export function isTransformationError(error: unknown): error is TransformationError {
  return error instanceof TransformationError;
}

/**
 * Type guard to check if error is a validation error
 *
 * @param error - Error to check
 * @returns True if error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if error is an analysis error
 *
 * @param error - Error to check
 * @returns True if error is an AnalysisError
 */
export function isAnalysisError(error: unknown): error is AnalysisError {
  return error instanceof AnalysisError;
}

/**
 * Type guard to check if error is an inference error
 *
 * @param error - Error to check
 * @returns True if error is an InferenceError
 */
export function isInferenceError(error: unknown): error is InferenceError {
  return error instanceof InferenceError;
}

/**
 * Type guard to check if error is a generation error
 *
 * @param error - Error to check
 * @returns True if error is a GenerationError
 */
export function isGenerationError(error: unknown): error is GenerationError {
  return error instanceof GenerationError;
}

/**
 * Type guard to check if error is an assembly error
 *
 * @param error - Error to check
 * @returns True if error is an AssemblyError
 */
export function isAssemblyError(error: unknown): error is AssemblyError {
  return error instanceof AssemblyError;
}

/**
 * Get error phase from error object
 *
 * @param error - Error to extract phase from
 * @returns Transformation phase or undefined
 */
export function getErrorPhase(error: unknown): TransformationPhase | undefined {
  if (isTransformationError(error)) {
    return error.phase;
  }
  return undefined;
}

/**
 * Format transformation error for display
 *
 * @param error - Error to format
 * @returns Formatted error string
 */
export function formatTransformationError(error: Error): string {
  if (isTransformationError(error)) {
    let formatted = `${error.name} [${error.phase}]: ${error.message}`;

    if (error.originalError) {
      formatted += `\n  Caused by: ${error.originalError.message}`;
    }

    if (error.context && Object.keys(error.context).length > 0) {
      formatted += `\n  Context: ${JSON.stringify(error.context, null, 2)}`;
    }

    return formatted;
  }

  return `${error.name}: ${error.message}`;
}

/**
 * Extract error message from unknown error
 *
 * @param error - Unknown error object
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * Create error context object for logging
 *
 * @param componentName - Component being processed
 * @param exampleIndex - Example index (optional)
 * @param additionalContext - Additional context data
 * @returns Error context object
 */
export function createErrorContext(
  componentName: string,
  exampleIndex?: number,
  additionalContext?: Record<string, unknown>
): Record<string, unknown> {
  return {
    componentName,
    exampleIndex,
    timestamp: new Date().toISOString(),
    ...additionalContext
  };
}

/**
 * Wrap an error with transformation context
 *
 * @param error - Original error
 * @param phase - Transformation phase
 * @param context - Error context
 * @returns TransformationError with context
 */
export function wrapError(
  error: Error,
  phase: TransformationPhase,
  context?: Record<string, unknown>
): TransformationError {
  if (isTransformationError(error)) {
    return error;
  }

  return new TransformationError(
    error.message,
    phase,
    error,
    context
  );
}
