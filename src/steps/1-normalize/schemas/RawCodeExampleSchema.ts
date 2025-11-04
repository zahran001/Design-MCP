// =============================================================================
// Raw Code Example Validation Schema
// =============================================================================
// Created: 2025-10-26
// Purpose: Input validation for raw code examples from extraction phase
//
// Validates the structure of code examples before transformation to ensure
// all required fields are present and properly formatted.
//
// =============================================================================

import { z } from 'zod';

/**
 * Schema for validating raw code examples from extraction phase
 *
 * Matches the structure from artifacts/raw-json/*.json files
 */
export const RawCodeExampleSchema = z.object({
  /**
   * Source code (required, non-empty)
   */
  code: z.string()
    .min(1, 'Code cannot be empty')
    .refine(
      (code) => code.trim().length > 0,
      'Code cannot contain only whitespace'
    ),

  /**
   * Composition score (optional, 0-100 range)
   * Higher score = more composition patterns
   */
  score: z.number()
    .int('Score must be an integer')
    .min(0, 'Score cannot be negative')
    .max(100, 'Score cannot exceed 100')
    .optional(),

  /**
   * Complexity level (optional, predefined values)
   */
  complexity: z.enum(['basic', 'intermediate', 'advanced'])
    .optional(),

  /**
   * Section title from extraction (optional)
   */
  section: z.string()
    .optional()
});

/**
 * Type inference from schema
 */
export type RawCodeExample = z.infer<typeof RawCodeExampleSchema>;

/**
 * Validated raw code example (after successful parsing)
 */
export type ValidatedRawCodeExample = RawCodeExample;

/**
 * Validation result type
 */
export type RawCodeExampleValidationResult = z.SafeParseReturnType<unknown, RawCodeExample>;

/**
 * Validate a raw code example
 *
 * @param data - Unknown data to validate
 * @returns Validation result with success/failure and parsed data or error
 *
 * @example
 * const result = validateRawCodeExample({ code: '<Button>Click</Button>' });
 * if (result.success) {
 *   console.log('Valid:', result.data);
 * } else {
 *   console.error('Invalid:', result.error.format());
 * }
 */
export function validateRawCodeExample(data: unknown): RawCodeExampleValidationResult {
  return RawCodeExampleSchema.safeParse(data);
}

/**
 * Validate and throw on error (for strict mode)
 *
 * @param data - Unknown data to validate
 * @returns Validated raw code example
 * @throws {z.ZodError} If validation fails
 *
 * @example
 * try {
 *   const validated = validateRawCodeExampleStrict({ code: '<Button>Click</Button>' });
 *   // Use validated data
 * } catch (error) {
 *   // Handle validation error
 * }
 */
export function validateRawCodeExampleStrict(data: unknown): RawCodeExample {
  return RawCodeExampleSchema.parse(data);
}

/**
 * Check if data is a valid raw code example (type guard)
 *
 * @param data - Data to check
 * @returns True if data is a valid raw code example
 *
 * @example
 * if (isRawCodeExample(data)) {
 *   // TypeScript knows data is RawCodeExample
 *   console.log(data.code);
 * }
 */
export function isRawCodeExample(data: unknown): data is RawCodeExample {
  return RawCodeExampleSchema.safeParse(data).success;
}

/**
 * Get validation error messages in user-friendly format
 *
 * @param error - Zod validation error
 * @returns Array of error messages
 *
 * @example
 * const result = validateRawCodeExample({ code: '' });
 * if (!result.success) {
 *   const messages = formatValidationErrors(result.error);
 *   console.error('Validation failed:', messages.join(', '));
 * }
 */
export function formatValidationErrors(error: z.ZodError): string[] {
  return error.errors.map(err => {
    const path = err.path.join('.');
    return `${path || 'root'}: ${err.message}`;
  });
}

/**
 * Create a minimal valid code example (for testing/fallback)
 *
 * @param code - Code string
 * @returns Minimal valid raw code example
 */
export function createMinimalRawCodeExample(code: string): RawCodeExample {
  return {
    code
  };
}

/**
 * Merge partial code example with defaults
 *
 * @param partial - Partial code example
 * @returns Complete code example with defaults
 */
export function withDefaults(partial: Partial<RawCodeExample> & { code: string }): RawCodeExample {
  return {
    code: partial.code,
    score: partial.score,
    complexity: partial.complexity,
    section: partial.section
  };
}
