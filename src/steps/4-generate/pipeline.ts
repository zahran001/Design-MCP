// =============================================================================
// Step 4 — end-to-end generation pipeline (the product surface)
// =============================================================================
// Turns a natural-language request into a TSX file on disk, closing the loop the
// eval harness only measured: grounded generate -> bounded self-heal (smell +
// heuristic guided repair, the Pass D/E lever) -> objective validation -> write.
//
// Unlike run-ab.ts (which runs a 2x2 to MEASURE retrieval vs repair), this is the
// shippable path: grounded + hinted repair only, returning the final artifact and
// a three-signal report (tsc, v2-smell, composition). The LLM-judge is delibe-
// rately NOT a gate here — Pass A showed it is unreliable on v3; objective signals
// are the spine. `tscOkSingleShot` is kept so the report is honest about how much
// of the result is generation vs repair.
// =============================================================================

import fs from 'fs';
import path from 'path';
import { GenerationService } from './generator.js';
import type { ContextChunk } from './generator.js';
import { tscValidate } from './validators/tscValidator.js';
import { detectV2Smells } from './validators/v2SmellDetector.js';
import { buildRepairHints } from './validators/repairHints.js';
import { lintComposition } from './validators/compositionLint.js';
import { renderValidate } from './validators/renderValidator.js';

export interface PipelineReport {
  query: string;
  model: string;
  grounded: boolean;
  /** Where the component was written, or null if writing was disabled. */
  outPath: string | null;
  /** The final (possibly repaired) component source. */
  component: string;
  /** True when generation produced a clean ```tsx block. */
  cleanCodeBlock: boolean;
  /** Top retrieved component (context the generation was grounded in). */
  topContextComponent: string;
  /** The retrieved chunks the generation was grounded in (the "Grounded in"
   *  transparency panel the UI renders). Empty when useContext is false. */
  context: ContextChunk[];
  // Tier 1 — type validity (objective)
  tscOkSingleShot: boolean; // before any repair (generation quality)
  tscOk: boolean; // after the self-heal loop (the shipped artifact)
  tscErrors: number; // remaining tsc errors in the final component
  repairIters: number; // self-heal attempts used (0 = compiled first try)
  // Tier 2 — API-migration compliance (objective, on the final component)
  smells: string[];
  // Composition completeness (objective, on the final component)
  incomplete: string[]; // e.g. "Checkbox:Control/Label"; empty = fully composed
  // Tier 3 — runtime correctness (objective): does the final component actually
  // mount and produce DOM in a real browser? Catches what tsc is blind to.
  renderOk: boolean;
  renderError?: string; // failure reason when renderOk is false
}

const DEFAULT_OUT_DIR = path.join(process.cwd(), 'artifacts', 'generated');

/** Slugify a request into a safe .tsx filename ([A-Za-z0-9_.-], capped). */
export function slugFromQuery(query: string): string {
  const slug = query
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'component';
  return `${slug}.tsx`;
}

/**
 * Generate a component end-to-end and (unless `outPath: null`) write it to disk.
 *  - `useContext` toggles retrieval grounding (default true = the product path).
 *  - `maxRepair` bounds the self-heal loop (default 2, matching the eval harness).
 *  - `outPath`: explicit path, or omit for artifacts/generated/<slug>.tsx, or
 *    pass `null` to skip writing (return the report only).
 */
export async function runGenerationPipeline(
  gen: GenerationService,
  query: string,
  opts: { k?: number; useContext?: boolean; maxRepair?: number; outPath?: string | null } = {}
): Promise<PipelineReport> {
  const k = opts.k ?? 8;
  const useContext = opts.useContext ?? true;
  const maxRepair = opts.maxRepair ?? 2;

  const g = await gen.generate(query, { k, useContext });
  const armContext = g.context.map((c) => c.rendered).join('\n\n');

  // Bounded self-heal: feed tsc diagnostics + smell/heuristic hints back until
  // the component compiles or we hit the cap. Hints NAME the offending prop —
  // the Pass C->D->E finding that makes compiler-feedback repair actually work.
  const first = await tscValidate(g.component);
  let component = g.component;
  let diagnostics = first.diagnostics;
  let tscOk = first.ok;
  let repairIters = 0;
  while (!tscOk && repairIters < maxRepair) {
    component = await gen.repair({
      query,
      component,
      diagnostics,
      contextBlock: armContext,
      hints: buildRepairHints(component, diagnostics),
    });
    const rt = await tscValidate(component);
    tscOk = rt.ok;
    diagnostics = rt.diagnostics;
    repairIters++;
  }

  // Tier 3: mount the FINAL (post-heal) component once in a real browser. tsc
  // proves types, not runtime — this is the only signal that the shipped artifact
  // actually renders. One-shot (launch+close a browser); batch callers reuse a
  // RenderValidator instead.
  const render = await renderValidate(component);

  let outPath: string | null = null;
  if (opts.outPath !== null) {
    outPath = opts.outPath ?? path.join(DEFAULT_OUT_DIR, slugFromQuery(query));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, component + '\n', 'utf8');
  }

  return {
    query,
    model: gen.modelName,
    grounded: useContext,
    outPath,
    component,
    cleanCodeBlock: g.cleanCodeBlock,
    topContextComponent: g.context[0]?.componentName ?? '',
    context: g.context,
    tscOkSingleShot: first.ok,
    tscOk,
    tscErrors: diagnostics.length,
    repairIters,
    smells: detectV2Smells(component),
    incomplete: lintComposition(component).map((i) => `${i.component}:${i.missing.join('/')}`),
    renderOk: render.ok,
    renderError: render.error,
  };
}

/** One-line human summary of a pipeline report. */
export function formatReport(r: PipelineReport): string {
  const tsc = r.tscOk
    ? r.repairIters === 0
      ? 'tsc=ok'
      : `tsc=ok(after ${r.repairIters} repair${r.repairIters > 1 ? 's' : ''})`
    : `tsc=ERR(${r.tscErrors}, ${r.repairIters} repairs tried)`;
  const smell = r.smells.length ? `v2-smells=[${r.smells.join(',')}]` : 'v2-smells=none';
  const comp = r.incomplete.length ? `incomplete=[${r.incomplete.join(',')}]` : 'composition=ok';
  const render = r.renderOk ? 'render=ok' : `render=ERR(${r.renderError?.split('\n')[0] ?? ''})`;
  return `${tsc} | ${smell} | ${comp} | ${render}`;
}
