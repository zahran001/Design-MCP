// =============================================================================
// CapabilityReferenceChunk Transformer
// =============================================================================
// Builds "What can X do?" / "What sizes/variants/states does X support?" chunks,
// answering the golden-set `what-can-x-do` category.
//
// Strategy (user decision): SECTION-DRIVEN, capability-filtered. One chunk per
// docs section that represents a capability. The chunk's description is the REAL
// `sectionDescription` prose captured by the Phase-3 scraper; structured options
// are pulled from the mapped prop's union type, reusing parsePropertyType().
//
// Honest-minimal: option descriptions are left empty (the value carries the
// signal); bestPractices/commonMistakes omitted. Nothing is fabricated.
//
// Observability: a section with substantial prose that is DROPPED by the gate
// emits a `gate-skip` warning so missing capability keywords surface for review.
// =============================================================================

import type { ComponentDoc, Prop } from '../../../schemas/RAGResultSchema.js';
import type {
  CapabilityReferenceChunk,
  CapabilityOption,
} from '../../../schemas/NormalizedChunkSchema.js';
import { generateChunkId, createDescriptor } from '../../../utils/chunkId.js';
import { getCategoryFromComponent } from '../config/categories.config.js';
import { parsePropertyType, categorizeProp } from './propReferenceTransformer.js';
import type { NormalizationWarning } from './componentOverviewTransformer.js';

// Minimum prose length to consider a section "rich" (mirrors the code-example
// transformer's real-prose threshold). Also gates the gate-skip warning.
const MIN_PROSE = 12;

// Tokens that mark a section heading as a capability (not a pure demo).
const CAPABILITY_KEYWORDS = new Set([
  'size', 'sizes', 'sizing',
  'variant', 'variants',
  'color', 'colors', 'colour', 'colours',
  'state', 'states',
  'loading',
  'placement', 'position',
  'orientation', 'direction',
  'spacing', 'gap',
  'radius', 'rounded',
  'appearance', 'alignment', 'align',
]);

// Heading token -> prop name that supplies enumerable options.
// 'states' is a special marker handled below (aggregates boolean state props).
const HEADING_PROP_MAP: Record<string, string> = {
  size: 'size',
  sizes: 'size',
  sizing: 'size',
  variant: 'variant',
  variants: 'variant',
  color: 'colorPalette',
  colors: 'colorPalette',
  colour: 'colorPalette',
  state: 'states',
  states: 'states',
  radius: 'rounded',
  rounded: 'rounded',
  orientation: 'orientation',
  direction: 'direction',
  placement: 'placement',
};

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function headingTokens(heading: string): string[] {
  return heading.toLowerCase().split(/[^a-z]+/).filter(Boolean);
}

/** Recipe-customization meta sections ("Adding a new variant") are NOT capabilities. */
function isRecipeMeta(heading: string): boolean {
  return /^(adding|changing|customiz)/i.test(heading);
}

/** Last segment of a (possibly composite) prop name: "Root.size" -> "size". */
function basePropName(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1) : name;
}

/** Does this heading represent a capability (vs a pure demo)? */
export function isCapabilityHeading(heading: string): boolean {
  return headingTokens(heading).some((t) => CAPABILITY_KEYWORDS.has(t));
}

/** Find a prop by name, matching composite props too ("Root.size" matches "size"). */
function findProp(props: Prop[], name: string): Prop | undefined {
  const target = name.toLowerCase();
  return (
    props.find((p) => p.name.toLowerCase() === target) ??
    props.find((p) => basePropName(p.name).toLowerCase() === target)
  );
}

/** First sentence of the prose, for `capability.intent`. */
function firstSentence(prose: string): string {
  const m = prose.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : prose).trim();
}

interface SectionGroup {
  heading: string;
  prose: string;
}

/** Group examples by section, taking the first non-empty prose per section. */
function groupSections(doc: ComponentDoc): SectionGroup[] {
  const order: string[] = [];
  const byKey = new Map<string, SectionGroup>();
  const componentLower = doc.componentName.toLowerCase();

  for (const ex of doc.codeExamples ?? []) {
    const heading = clean(ex.section);
    if (!heading) continue;
    const key = heading.toLowerCase();
    if (key === componentLower) continue; // intro/Usage block
    if (isRecipeMeta(heading)) continue; // "Adding a new variant" etc. — not a capability
    if (!byKey.has(key)) {
      byKey.set(key, { heading, prose: clean(ex.sectionDescription) });
      order.push(key);
    } else {
      const g = byKey.get(key)!;
      if (!g.prose) g.prose = clean(ex.sectionDescription);
    }
  }
  return order.map((k) => byKey.get(k)!);
}

/** Build options for a capability from its mapped prop (or boolean state group). */
function buildOptions(
  heading: string,
  props: Prop[]
): { options: CapabilityOption[]; propNames: string[]; defaultValue?: string } {
  for (const token of headingTokens(heading)) {
    const mapped = HEADING_PROP_MAP[token];
    if (!mapped) continue;

    if (mapped === 'states') {
      // Categorize on the base name so composite props ("Root.disabled") count,
      // and dedupe by base name for a clean enumeration.
      const seen = new Set<string>();
      const stateProps = props.filter((p) => {
        const base = basePropName(p.name);
        if (categorizeProp(base) !== 'state') return false;
        const key = base.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (stateProps.length > 0) {
        return {
          options: stateProps.map((p) => ({ value: basePropName(p.name), description: '' })),
          propNames: stateProps.map((p) => p.name),
        };
      }
      return { options: [], propNames: [] };
    }

    const prop = findProp(props, mapped);
    if (prop) {
      const ti = parsePropertyType(prop.type);
      const options =
        ti.kind === 'union' && ti.options
          ? ti.options.map((v) => ({ value: v, description: '' }))
          : [];
      return { options, propNames: [prop.name], defaultValue: prop.defaultValue };
    }
  }
  return { options: [], propNames: [] };
}

export interface CapabilityResult {
  chunks: CapabilityReferenceChunk[];
  warnings: NormalizationWarning[];
}

/**
 * Transform a ComponentDoc into capability-reference chunks (one per capability
 * section). Sections with rich prose that fail the gate emit a gate-skip warning.
 */
export function transformCapabilities(doc: ComponentDoc): CapabilityResult {
  const warnings: NormalizationWarning[] = [];
  const chunks: CapabilityReferenceChunk[] = [];
  const componentName = doc.componentName;
  const props = doc.props ?? [];
  const category = getCategoryFromComponent(componentName);

  for (const section of groupSections(doc)) {
    const hasRichProse = section.prose.length >= MIN_PROSE;
    const passesGate =
      isCapabilityHeading(section.heading) ||
      headingTokens(section.heading).some((t) => t in HEADING_PROP_MAP);

    if (!passesGate) {
      // Observability: surface dropped-but-prose-bearing sections so we can spot
      // capability headings the keyword list doesn't yet cover.
      if (hasRichProse) {
        warnings.push({
          type: 'gate-skip',
          componentName,
          message: `Section "${section.heading}" has prose but was not recognized as a capability.`,
        });
      }
      continue;
    }

    // Need real prose to be worth a capability chunk (honest-minimal substrate).
    if (!hasRichProse) continue;

    const { options, propNames, defaultValue } = buildOptions(section.heading, props);

    chunks.push({
      metadata: {
        chunkId: generateChunkId(
          componentName,
          'capability-reference',
          createDescriptor(section.heading),
          '1'
        ),
        chunkType: 'capability-reference',
        componentName,
        sourceUrl: doc.sourceUrl,
        version: '3.27.1',
        tags: ['capability', componentName.toLowerCase(), ...headingTokens(section.heading)],
        category,
        complexity: 'simple',
        relatedChunks: [],
      },
      capability: {
        name: section.heading,
        intent: firstSentence(section.prose) || `Configure the ${section.heading.toLowerCase()} of ${componentName}`,
      },
      content: {
        description: section.prose,
        options,
      },
      reference: {
        propNames,
        defaultValue,
      },
    });
  }

  return { chunks, warnings };
}
