// =============================================================================
// Fallback Chunk Generation
// =============================================================================
// Created: 2025-10-26
// Purpose: Generate fallback chunks when transformation fails
//
// Provides graceful degradation by creating minimal but valid chunks when
// errors occur during transformation. Preserves as much data as possible.
//
// =============================================================================

import type { CodeExampleChunk } from '../../../schemas/NormalizedChunkSchema.js';
import { generateChunkId } from '../../../utils/chunkId.js';
import { TRANSFORMER_CONFIG } from '../config/transformer.config.js';
import { getCategoryFromComponent } from '../config/categories.config.js';

/**
 * Reason for fallback chunk creation
 */
export type FallbackReason =
  | 'empty-code'          // Code field is empty or missing
  | 'invalid-input'       // Input validation failed
  | 'analysis-failed'     // Code analysis failed
  | 'inference-failed'    // Section/intent inference failed
  | 'generation-failed';  // Content generation failed

/**
 * Create a minimal fallback chunk
 *
 * Used when we have minimal information about the code example.
 * Creates a valid chunk with placeholder content.
 *
 * @param componentName - Component name
 * @param sourceUrl - Source URL
 * @param reason - Why fallback was needed
 * @returns Minimal valid CodeExampleChunk
 *
 * @example
 * const chunk = createMinimalChunk('Button', 'https://...', 'empty-code');
 */
export function createMinimalChunk(
  componentName: string,
  sourceUrl: string,
  reason: FallbackReason
): CodeExampleChunk {
  const category = getCategoryFromComponent(componentName);

  return {
    metadata: {
      chunkId: generateChunkId(componentName, 'code-example', 'fallback', '1'),
      chunkType: 'code-example',
      componentName,
      sourceUrl,
      version: TRANSFORMER_CONFIG.version,
      tags: ['fallback', reason],
      category,
      complexity: 'simple',
      relatedChunks: []
    },

    example: {
      title: 'Fallback Example',
      intent: 'generic',
      difficulty: 'basic'
    },

    content: {
      explanation: `This is a fallback chunk created due to: ${reason}. The original code example could not be fully processed.`,
      code: '// Code unavailable or could not be processed',
      demonstrates: ['Fallback content - original example failed to transform'],
      keyPoints: []
    },

    codeMetadata: {
      language: 'tsx',
      imports: [],
      components: [componentName],
      props: [],
      hasInteractivity: false,
      hasState: false,
      complexity: 0
    }
  };
}

/**
 * Create a fallback chunk with partial data
 *
 * Used when we have some information from the raw example but transformation failed.
 * Preserves as much data as possible while filling in missing pieces.
 *
 * @param rawExample - Partial raw example data
 * @param componentName - Component name
 * @param sourceUrl - Source URL
 * @param error - Error that caused fallback
 * @returns CodeExampleChunk with available data
 *
 * @example
 * const chunk = createFallbackChunk(
 *   { code: '<Button>Click</Button>' },
 *   'Button',
 *   'https://...',
 *   new Error('Analysis failed')
 * );
 */
export function createFallbackChunk(
  rawExample: { code?: string; complexity?: string; section?: string },
  componentName: string,
  sourceUrl: string,
  error: Error
): CodeExampleChunk {
  const category = getCategoryFromComponent(componentName);
  const code = rawExample.code || '// Code unavailable';
  const section = rawExample.section || 'Unknown Section';
  const complexity = (rawExample.complexity as 'simple' | 'intermediate' | 'advanced') || 'intermediate';

  return {
    metadata: {
      chunkId: generateChunkId(componentName, 'code-example', section, '1'),
      chunkType: 'code-example',
      componentName,
      sourceUrl,
      version: TRANSFORMER_CONFIG.version,
      tags: ['fallback', 'partial-data'],
      category,
      complexity,
      relatedChunks: []
    },

    example: {
      title: section,
      intent: 'generic',
      difficulty: complexity === 'simple' ? 'basic' : complexity === 'advanced' ? 'advanced' : 'intermediate'
    },

    content: {
      explanation: `This example demonstrates the ${componentName} component. Note: Full processing failed due to: ${error.message}`,
      code,
      demonstrates: [
        `Basic usage of the ${componentName} component`,
        'Note: Detailed analysis unavailable due to processing error'
      ],
      keyPoints: [
        'This chunk was created with partial data due to transformation failure'
      ]
    },

    codeMetadata: {
      language: 'tsx',
      imports: [],
      components: extractBasicComponents(code),
      props: [],
      hasInteractivity: code.includes('onClick') || code.includes('onChange'),
      hasState: code.includes('useState') || code.includes('useReducer'),
      complexity: 0
    }
  };
}

/**
 * Create a fallback chunk with analysis data
 *
 * Used when analysis succeeded but later steps failed.
 * Includes code analysis results.
 *
 * @param rawExample - Raw example data
 * @param componentName - Component name
 * @param sourceUrl - Source URL
 * @param analysisData - Partial analysis data
 * @param error - Error that caused fallback
 * @returns CodeExampleChunk with analysis data
 */
export function createFallbackChunkWithAnalysis(
  rawExample: { code: string; complexity?: string; section?: string },
  componentName: string,
  sourceUrl: string,
  analysisData: {
    imports?: any[];
    components?: string[];
    props?: any[];
    hooks?: string[];
    hasInteractivity?: boolean;
    hasState?: boolean;
  },
  error: Error
): CodeExampleChunk {
  const category = getCategoryFromComponent(componentName);
  const section = rawExample.section || 'Code Example';
  const complexity = (rawExample.complexity as 'simple' | 'intermediate' | 'advanced') || 'intermediate';

  return {
    metadata: {
      chunkId: generateChunkId(componentName, 'code-example', section, '1'),
      chunkType: 'code-example',
      componentName,
      sourceUrl,
      version: TRANSFORMER_CONFIG.version,
      tags: ['fallback', 'with-analysis'],
      category,
      complexity,
      relatedChunks: []
    },

    example: {
      title: section,
      intent: 'generic',
      difficulty: complexity === 'simple' ? 'basic' : complexity === 'advanced' ? 'advanced' : 'intermediate'
    },

    content: {
      explanation: `This example demonstrates the ${componentName} component${analysisData.components && analysisData.components.length > 1 ? ` with ${analysisData.components.length} components` : ''}. Note: Full processing incomplete due to: ${error.message}`,
      code: rawExample.code,
      demonstrates: generateBasicDemonstrates(componentName, analysisData),
      keyPoints: generateBasicKeyPoints(componentName, analysisData)
    },

    codeMetadata: {
      language: 'tsx',
      imports: analysisData.imports || [],
      components: analysisData.components || [componentName],
      props: analysisData.props || [],
      hooks: analysisData.hooks && analysisData.hooks.length > 0 ? analysisData.hooks : undefined,
      hasInteractivity: analysisData.hasInteractivity || false,
      hasState: analysisData.hasState || false,
      complexity: 5
    }
  };
}

/**
 * Extract basic component names from code (simple regex)
 *
 * @param code - Source code
 * @returns Array of component names
 */
function extractBasicComponents(code: string): string[] {
  const regex = /<([A-Z]\w+)/g;
  const components = new Set<string>();
  let match;

  while ((match = regex.exec(code)) !== null) {
    components.add(match[1]);
  }

  return Array.from(components);
}

/**
 * Generate basic demonstrates array from analysis data
 *
 * @param componentName - Component name
 * @param analysisData - Analysis data
 * @returns Array of demonstrate strings
 */
function generateBasicDemonstrates(
  componentName: string,
  analysisData: {
    components?: string[];
    hasInteractivity?: boolean;
    hasState?: boolean;
  }
): string[] {
  const demonstrates = [`Basic usage of the ${componentName} component`];

  if (analysisData.components && analysisData.components.length > 1) {
    demonstrates.push(`Using ${analysisData.components.length} components together`);
  }

  if (analysisData.hasInteractivity) {
    demonstrates.push('Interactive behavior with event handlers');
  }

  if (analysisData.hasState) {
    demonstrates.push('State management with React hooks');
  }

  return demonstrates;
}

/**
 * Generate basic key points from analysis data
 *
 * @param componentName - Component name
 * @param analysisData - Analysis data
 * @returns Array of key point strings
 */
function generateBasicKeyPoints(
  componentName: string,
  analysisData: {
    imports?: any[];
    hooks?: string[];
  }
): string[] {
  const keyPoints: string[] = [];

  if (analysisData.imports && analysisData.imports.length > 0) {
    const packages = Array.from(new Set(analysisData.imports.map(imp => imp.source)));
    keyPoints.push(`Imports from: ${packages.join(', ')}`);
  }

  if (analysisData.hooks && analysisData.hooks.length > 0) {
    keyPoints.push(`Uses React hooks: ${analysisData.hooks.join(', ')}`);
  }

  keyPoints.push(`${componentName} component is flexible and customizable`);

  return keyPoints;
}

/**
 * Determine which fallback function to use based on available data
 *
 * @param rawExample - Raw example (may be partial)
 * @param componentName - Component name
 * @param sourceUrl - Source URL
 * @param error - Error that occurred
 * @param analysisData - Analysis data (if available)
 * @returns Appropriate fallback chunk
 */
export function createAppropriateFallback(
  rawExample: { code?: string; complexity?: string; section?: string },
  componentName: string,
  sourceUrl: string,
  error: Error,
  analysisData?: {
    imports?: any[];
    components?: string[];
    props?: any[];
    hooks?: string[];
    hasInteractivity?: boolean;
    hasState?: boolean;
  }
): CodeExampleChunk {
  // No code at all - use minimal chunk
  if (!rawExample.code || rawExample.code.trim() === '') {
    return createMinimalChunk(componentName, sourceUrl, 'empty-code');
  }

  // Have analysis data - use enriched fallback
  if (analysisData && Object.keys(analysisData).length > 0) {
    return createFallbackChunkWithAnalysis(
      rawExample as { code: string; complexity?: string; section?: string },
      componentName,
      sourceUrl,
      analysisData,
      error
    );
  }

  // Have code but no analysis - use basic fallback
  return createFallbackChunk(rawExample, componentName, sourceUrl, error);
}
