// =============================================================================
// ComponentOverviewChunk Transformer
// =============================================================================
// Builds the "What is X?" chunk — one per component — entirely from REAL extracted
// data (no fabrication). Answers the golden-set `what-is` category.
//
// Source: the raw ComponentDoc (artifacts/raw-json/*.json). Uses:
//   - description       -> content.description (the authentic one-liner)
//   - codeExamples[].section -> content.capabilities (real section headings)
//   - relatedComponents -> content.commonPairings
//   - props / codeExamples -> quickReference (NOT embedded)
//
// Honest-minimal policy: fields with no source data (useCases, accessibilityLevel,
// option descriptions) are left empty / at a conservative default and kept out of
// the embedded text. Never fabricate prose.
// =============================================================================

import type { ComponentDoc } from '../../../schemas/RAGResultSchema.js';
import type { ComponentOverviewChunk } from '../../../schemas/NormalizedChunkSchema.js';
import { generateChunkId } from '../../../utils/chunkId.js';
import { getCategoryFromComponent } from '../config/categories.config.js';

/** A surfaced data-quality concern (collected and logged by the normalizer). */
export interface NormalizationWarning {
  type: 'data-quality' | 'gate-skip';
  componentName: string;
  message: string;
}

export interface OverviewResult {
  /** The chunk, or null when the component has no usable data at all (skipped). */
  chunk: ComponentOverviewChunk | null;
  warnings: NormalizationWarning[];
}

// Section headings that are NOT component capabilities (setup/meta sections).
const NON_CAPABILITY_SECTIONS = new Set([
  'usage',
  'installation',
  'import',
  'setup',
  'props',
  'customization',
  'examples',
]);

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Distinct, real section headings that represent things the component can do.
 * Excludes the component-name/Usage/setup sections and recipe-customization
 * meta sections ("Adding a new variant", "Changing the default size").
 */
export function extractCapabilities(doc: ComponentDoc): string[] {
  const componentLower = doc.componentName.toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];

  for (const ex of doc.codeExamples ?? []) {
    const heading = clean(ex.section);
    if (!heading) continue;
    const lower = heading.toLowerCase();
    if (lower === componentLower) continue; // the intro/Usage block
    if (NON_CAPABILITY_SECTIONS.has(lower)) continue;
    if (/^(adding|changing|customiz)/i.test(heading)) continue; // recipe meta
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(heading);
  }
  return out;
}

/**
 * Best-effort detection of subcomponents (e.g. "Checkbox.Root") from example code.
 * Defensive: any failure returns []. Feeds quickReference only (NOT embedded), so
 * a false positive/negative never affects retrieval.
 */
export function detectSubcomponents(doc: ComponentDoc): string[] {
  try {
    const base = doc.componentName.replace(/[^A-Za-z0-9]/g, '');
    if (!base) return [];
    const re = new RegExp(`<(${base}\\.[A-Z][A-Za-z0-9]*)`, 'g');
    const found = new Set<string>();
    for (const ex of doc.codeExamples ?? []) {
      const code = typeof ex.code === 'string' ? ex.code : '';
      let m: RegExpExecArray | null;
      while ((m = re.exec(code)) !== null) {
        found.add(m[1]);
      }
    }
    return Array.from(found).sort();
  } catch {
    return [];
  }
}

/**
 * Transform a ComponentDoc into a ComponentOverviewChunk.
 * Returns { chunk: null } only when there is genuinely no data (no description AND
 * no capabilities) — accompanied by a data-quality warning.
 */
export function transformComponentOverview(doc: ComponentDoc): OverviewResult {
  const warnings: NormalizationWarning[] = [];
  const componentName = doc.componentName;
  const capabilities = extractCapabilities(doc);

  // Description: real prose preferred; factual fallback before any skip.
  let description = clean(doc.description);
  if (!description) {
    if (capabilities.length > 0) {
      // Factual restatement of REAL section labels — not invented prose.
      description = `${componentName} — supports ${capabilities.join(', ')}.`;
      warnings.push({
        type: 'data-quality',
        componentName,
        message: `No description in raw doc; used factual capability fallback.`,
      });
    } else {
      warnings.push({
        type: 'data-quality',
        componentName,
        message: `No description and no capabilities — overview skipped.`,
      });
      return { chunk: null, warnings };
    }
  }

  const subcomponents = detectSubcomponents(doc);
  const category = getCategoryFromComponent(componentName);
  const commonPairings = (doc.relatedComponents ?? []).filter((c) => typeof c === 'string');

  const chunk: ComponentOverviewChunk = {
    metadata: {
      chunkId: generateChunkId(componentName, 'component-overview', 'summary', '1'),
      chunkType: 'component-overview',
      componentName,
      sourceUrl: doc.sourceUrl,
      version: '3.27.1',
      tags: ['overview', componentName.toLowerCase(), category],
      category,
      complexity: 'simple',
      relatedChunks: [],
    },
    content: {
      description,
      capabilities,
      useCases: [], // honest-minimal: no source data
      commonPairings,
    },
    quickReference: {
      hasSubcomponents: subcomponents.length > 0,
      subcomponents: subcomponents.length > 0 ? subcomponents : undefined,
      propCount: (doc.props ?? []).length,
      exampleCount: (doc.codeExamples ?? []).length,
      accessibilityLevel: 'basic', // conservative default; NOT embedded
    },
  };

  return { chunk, warnings };
}
