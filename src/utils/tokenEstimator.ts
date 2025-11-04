// =============================================================================
// Token Estimation Utility
// =============================================================================
// Created: 2025-10-22
// Reference: NORMALIZATION_GUIDE.md
//
// Estimates token counts for text content using a simple heuristic.
//
// HEURISTIC: 1 token ≈ 4 characters
// This is based on GPT tokenizer averages and works well for English text.
//
// For production, consider using actual tokenizer libraries like:
// - tiktoken (OpenAI)
// - @anthropic-ai/tokenizer (Claude)
//
// =============================================================================

/**
 * Estimate token count for a text string
 *
 * Uses simple heuristic: 1 token ≈ 4 characters
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * estimateTokens("This is a simple example")
 * // Returns: 6 (25 chars / 4 ≈ 6)
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  // Simple heuristic: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Estimate total tokens for a chunk with multiple text fields
 *
 * @param chunk - Object with text fields
 * @returns Total estimated tokens
 *
 * @example
 * estimateChunkTokens({
 *   explanation: "This example shows...",
 *   code: "const Button = () => {...}",
 *   keyPoints: ["Point 1", "Point 2"]
 * })
 * // Returns: sum of all tokens
 */
export function estimateChunkTokens(chunk: {
  explanation?: string;
  code?: string;
  keyPoints?: string[];
  demonstrates?: string[];
  [key: string]: any;
}): number {
  let total = 0;

  // Add explanation tokens
  if (chunk.explanation) {
    total += estimateTokens(chunk.explanation);
  }

  // Add code tokens
  if (chunk.code) {
    total += estimateTokens(chunk.code);
  }

  // Add key points tokens
  if (chunk.keyPoints && Array.isArray(chunk.keyPoints)) {
    total += chunk.keyPoints.reduce((sum, point) => sum + estimateTokens(point), 0);
  }

  // Add demonstrates tokens
  if (chunk.demonstrates && Array.isArray(chunk.demonstrates)) {
    total += chunk.demonstrates.reduce((sum, demo) => sum + estimateTokens(demo), 0);
  }

  return total;
}

/**
 * Check if chunk size is within optimal range
 *
 * Optimal range for embeddings: 200-500 tokens
 *
 * @param tokenCount - Number of tokens
 * @returns Size classification
 *
 * @example
 * classifyChunkSize(350)
 * // Returns: "optimal"
 *
 * classifyChunkSize(150)
 * // Returns: "too_small"
 */
export function classifyChunkSize(tokenCount: number): 'too_small' | 'optimal' | 'too_large' {
  if (tokenCount < 200) {
    return 'too_small';
  }

  if (tokenCount <= 500) {
    return 'optimal';
  }

  return 'too_large';
}

/**
 * Get token size statistics for a batch of chunks
 *
 * Useful for quality metrics and reporting
 *
 * @param chunks - Array of chunks with token counts
 * @returns Statistics object
 *
 * @example
 * getTokenStats([
 *   { metadata: { tokens: 250 } },
 *   { metadata: { tokens: 450 } },
 *   { metadata: { tokens: 150 } }
 * ])
 * // Returns: {
 * //   total: 3,
 * //   tooSmall: 1,
 * //   optimal: 2,
 * //   tooLarge: 0,
 * //   average: 283,
 * //   min: 150,
 * //   max: 450
 * // }
 */
export function getTokenStats(chunks: Array<{ metadata: { tokens: number } }>): {
  total: number;
  tooSmall: number;
  optimal: number;
  tooLarge: number;
  average: number;
  min: number;
  max: number;
} {
  if (chunks.length === 0) {
    return {
      total: 0,
      tooSmall: 0,
      optimal: 0,
      tooLarge: 0,
      average: 0,
      min: 0,
      max: 0
    };
  }

  const tokenCounts = chunks.map(c => c.metadata.tokens);

  let tooSmall = 0;
  let optimal = 0;
  let tooLarge = 0;

  tokenCounts.forEach(count => {
    const size = classifyChunkSize(count);
    if (size === 'too_small') tooSmall++;
    else if (size === 'optimal') optimal++;
    else tooLarge++;
  });

  const sum = tokenCounts.reduce((acc, count) => acc + count, 0);
  const average = Math.round(sum / tokenCounts.length);

  return {
    total: chunks.length,
    tooSmall,
    optimal,
    tooLarge,
    average,
    min: Math.min(...tokenCounts),
    max: Math.max(...tokenCounts)
  };
}
