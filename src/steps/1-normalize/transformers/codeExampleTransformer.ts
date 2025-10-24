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

import { analyzeCode } from '../inference/codeAnalyzer.js';
import { inferSectionTitle } from '../inference/sectionInferrer.js';
import { classifyIntent } from '../inference/intentClassifier.js';
import { extractTemplateData } from '../generators/templateDataExtractor.js';
import { generateContent } from '../generators/explanationGenerator.js';
import { generateChunkId } from '../../../utils/chunkId.js';
import { estimateChunkTokens } from '../../../utils/tokenEstimator.js';
import type { CodeExampleChunk, ComponentCategory } from '../../../schemas/NormalizedChunkSchema.js';

/**
 * Raw code example from extracted JSON
 */
export interface RawCodeExample {
  code: string;
  score?: number;
  complexity?: string;
  section?: string;
}

/**
 * Transform a raw code example into a normalized CodeExampleChunk
 *
 * Orchestrates the complete transformation pipeline:
 * 1. Code analysis (extract imports, components, props, hooks)
 * 2. Section inference (detect semantic title from patterns)
 * 3. Intent classification (sizing, variants, states, etc.)
 * 4. Natural language generation (explanation, demonstrates, keyPoints)
 * 5. Chunk assembly (metadata + content + codeMetadata)
 *
 * @param rawExample - Raw code example from extracted JSON
 * @param componentName - Component name (e.g., "Button")
 * @param sourceUrl - Source documentation URL
 * @returns Complete normalized CodeExampleChunk
 *
 * @example
 * const chunk = transformCodeExample(
 *   { code: "<Button size='xs'>...</Button>", complexity: "intermediate" },
 *   "Button",
 *   "https://chakra-ui.com/docs/components/button"
 * );
 */
export function transformCodeExample(
  rawExample: RawCodeExample,
  componentName: string,
  sourceUrl: string
): CodeExampleChunk {
  // ==========================================================================
  // Step 1: Run Inference Pipeline
  // ==========================================================================

  // Analyze code structure
  const analysis = analyzeCode(rawExample.code);

  // Infer semantic section title
  const section = inferSectionTitle(
    rawExample.code,
    rawExample.section,
    componentName
  );

  // Classify intent/purpose
  const intent = classifyIntent(
    rawExample.code,
    analysis,
    section.title
  );

  // ==========================================================================
  // Step 2: Generate Natural Language Content
  // ==========================================================================

  // Extract template data
  const templateData = extractTemplateData(
    intent.intent,
    analysis,
    componentName
  );

  // Generate natural language
  const content = generateContent(templateData);

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

  // Determine component category (smart defaults)
  const category = getCategoryFromComponent(componentName);

  // Generate tags (just intent for POC)
  // TODO: Future enhancement - derive multiple tags from intent + patterns
  // See: POC_NORMALIZATION_DECISIONS.md#future-enhancements
  const tags = [intent.intent];

  // Get complexity from raw JSON (fallback to intermediate)
  const complexity = rawExample.complexity || 'intermediate';

  // Estimate token count (for quality metrics, not stored in chunk)
  const tokens = estimateChunkTokens({
    explanation: content.explanation,
    code: rawExample.code,
    demonstrates: content.demonstrates,
    keyPoints: content.keyPoints
  });

  // Log token count for debugging
  if (tokens < 200 || tokens > 500) {
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
      // Note: tokens=${tokens} (not stored in schema, logged above if outside range)
    },

    example: {
      title: section.title,
      intent: intent.intent,
      difficulty: complexity as 'basic' | 'intermediate' | 'advanced'
    },

    content: {
      explanation: content.explanation,
      code: rawExample.code,
      demonstrates: content.demonstrates,
      keyPoints: content.keyPoints
    },

    codeMetadata: {
      language: 'tsx',
      imports: analysis.imports.map(imp => ({
        ...imp,
        type: 'named' as const // Default to named imports for POC
      })),
      components: analysis.components,
      props: analysis.props,
      hooks: analysis.hooks.length > 0 ? analysis.hooks : undefined, // Optional field
      hasInteractivity: analysis.hasInteractivity,
      hasState: analysis.hasState,
      complexity: rawExample.score || 5
    }
  };

  return chunk;
}

/**
 * Determine component category using smart defaults
 *
 * Uses regex patterns to classify components into categories.
 * Falls back to "other" if no pattern matches.
 *
 * TODO: Future enhancement - load from configuration file
 * See: POC_NORMALIZATION_DECISIONS.md#future-enhancements
 *
 * @param componentName - Component name (e.g., "Button", "HStack")
 * @returns Component category
 *
 * @example
 * getCategoryFromComponent("Button") // Returns: "form-controls"
 * getCategoryFromComponent("HStack") // Returns: "layout"
 * getCategoryFromComponent("Unknown") // Returns: "other"
 */
function getCategoryFromComponent(componentName: string): ComponentCategory {
  // Form controls
  if (/Button|Input|Checkbox|Radio|Select|Switch|Slider|Field|Textarea|PinInput|NumberInput|Editable/i.test(componentName)) {
    return 'form-controls';
  }

  // Layout
  if (/Stack|HStack|VStack|Box|Container|Flex|Grid|SimpleGrid|Center|Wrap|AspectRatio|Spacer|Divider|AbsoluteCenter|Bleed/i.test(componentName)) {
    return 'layout';
  }

  // Typography
  if (/Text|Heading|Code|Em|Strong|Blockquote|Mark|Highlight/i.test(componentName)) {
    return 'typography';
  }

  // Feedback
  if (/Alert|Toast|Progress|Spinner|Skeleton|CircularProgress|LinearProgress/i.test(componentName)) {
    return 'feedback';
  }

  // Overlay
  if (/Modal|Drawer|Popover|Tooltip|Menu|Dialog|Overlay|Portal/i.test(componentName)) {
    return 'overlay';
  }

  // Disclosure
  if (/Accordion|Tabs|Collapsible|Disclosure/i.test(componentName)) {
    return 'disclosure';
  }

  // Navigation
  if (/Breadcrumb|Link|Stepper|Steps|Pagination/i.test(componentName)) {
    return 'navigation';
  }

  // Data display
  if (/Table|List|Tag|Badge|Card|Stat|Avatar|Image|Icon/i.test(componentName)) {
    return 'data-display';
  }

  // Media
  if (/Image|Icon|Avatar/i.test(componentName)) {
    return 'media';
  }

  // Default fallback
  return 'other';
}
