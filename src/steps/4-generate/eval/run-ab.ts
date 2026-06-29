// =============================================================================
// Phase 4b — Generation A/B harness (Pass A: grounded judge + completeness)
// =============================================================================
// The experiment: does grounding generation in retrieved real v3 docs reduce
// v2/hallucinated API and improve correctness — vs the SAME model with no
// context? Same model, same prompts; the only difference is the retrieved
// context. Per (prompt, arm) we record:
//   - judge satisfaction (0/1/2) — GROUNDED against the retrieved v3 reference
//     (Pass A), so the v2-biased judge stops rating correct v3 as "outdated".
//   - tsc-validity       (objective: component/import/syntax errors)
//   - v2-smell count     (objective: prop-level v2 drift tsc is blind to)
//   - composition issues (objective: hollow composed roots, e.g. Checkbox.Root
//     without Control/Label) — the under-composition signal, no model needed.
//
// Both arms are judged against the SAME reference (the grounded retrieval), so
// the judge evaluates against one authoritative v3 spec.
//
// Pass C (5.3) adds a bounded tsc SELF-CORRECTION loop: on a single-shot tsc
// failure, the compiler diagnostics are fed back to a temp-0 repair call (cap
// MAX_REPAIR_ITERS) using the arm's OWN context.
//
// Pass D (5.3b) runs the repair as a 2x2: from the SAME failed component, BOTH
// `raw` (tsc errors only, = Pass C) and `hinted` (errors + smell-guided v2->v3
// migration hints that NAME the offending prop) loops run. Raw cells preserve
// the comparable baseline; the hint is the orthogonal repair-mode factor. We
// report single-shot tsc-pass (retrieval thesis) and BOTH repaired rates.
//
// Usage: npx tsx src/steps/4-generate/eval/run-ab.ts
// Prereq: Qdrant up + embedded; OPENAI_API_KEY; DEBUG=false.
// =============================================================================

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { GenerationService, type GenerationResult } from '../generator.js';
import { GenerationJudge } from './generationJudge.js';
import { tscValidate } from '../validators/tscValidator.js';
import { detectV2Smells } from '../validators/v2SmellDetector.js';
import { buildRepairHints } from '../validators/repairHints.js';
import { lintComposition } from '../validators/compositionLint.js';
import { RenderValidator } from '../validators/renderValidator.js';
import { LANDMINE_PROMPTS } from '../test-generation/landmine-prompts.js';

const OUT_DIR = path.join(process.cwd(), 'artifacts', 'gen-eval');

// Pass C (5.3): bounded tsc self-correction. Cap repair attempts so a model that
// can't fix its own output doesn't loop forever (or burn tokens).
const MAX_REPAIR_ITERS = 2;

// Pass D: one repair mode's result (the 2x2's repair-time factor). `raw` feeds
// only the tsc diagnostics back (= Pass C); `hinted` also feeds smell-guided
// migration hints that name the offending prop.
interface RepairOutcome {
  tscOk: boolean; // tsc-valid after this repair mode (or single-shot if it already passed)
  iters: number; // repair attempts used (0 = passed first try, loop skipped)
  smells: number; // v2-smells remaining in the healed component
  healed: string; // the final (possibly repaired) component
}

interface Outcome {
  grade: number;
  reason: string;
  tscOk: boolean; // SINGLE-SHOT (retrieval thesis — unchanged across passes)
  tscErrors: number;
  smells: string[];
  incomplete: string[]; // e.g. "Checkbox:Control/Label"
  cleanCodeBlock: boolean;
  component: string;
  // Pass D 2x2: BOTH repair modes run from the SAME single-shot component so the
  // only difference is the hint (generation variance is controlled out).
  repairRaw: RepairOutcome; // tsc errors only (= Pass C baseline, preserved)
  repairHinted: RepairOutcome; // tsc errors + smell-guided migration hints
  // Tier 3 (Item 2): does the FINAL hinted-repair artifact actually mount in a
  // real browser? Expect renderPass <= hintedTscPass — the gap is the find.
  renderOk: boolean;
  renderError?: string;
}

/**
 * Bounded tsc self-correction loop. `hints` omitted = raw mode (Pass C); when
 * `withHints` is true we recompute smell-guided hints from the CURRENT (failing)
 * component each iteration so the named prop tracks what's actually still wrong.
 */
async function runRepairLoop(
  gen: GenerationService,
  query: string,
  component: string,
  diagnostics: string[],
  armContext: string,
  ok: boolean,
  withHints: boolean
): Promise<RepairOutcome> {
  let healed = component;
  let diag = diagnostics;
  let tscOk = ok;
  let iters = 0;
  while (!tscOk && iters < MAX_REPAIR_ITERS) {
    healed = await gen.repair({
      query,
      component: healed,
      diagnostics: diag,
      contextBlock: armContext,
      hints: withHints ? buildRepairHints(healed, diag) : undefined,
    });
    const rt = await tscValidate(healed);
    tscOk = rt.ok;
    diag = rt.diagnostics;
    iters++;
  }
  return { tscOk, iters, smells: detectV2Smells(healed).length, healed };
}

interface Aggregate {
  n: number;
  meanGrade: number;
  satisfaction: number; // fraction grade === 2
  tscPassRate: number; // SINGLE-SHOT (retrieval thesis)
  smellRate: number; // fraction with >=1 v2 smell
  completeRate: number; // fraction with NO composition issues
  totalSmells: number;
  totalIncomplete: number;
  // Pass D 2x2 product metrics (post self-correction), per repair mode:
  rawTscPassRate: number; // tsc-valid after RAW repair (= Pass C)
  rawSmellRate: number;
  rawIters: number;
  hintedTscPassRate: number; // tsc-valid after SMELL-HINTED repair
  hintedSmellRate: number;
  hintedIters: number;
  renderPassRate: number; // fraction whose final hinted artifact MOUNTS (Item 2)
}

async function score(
  gen: GenerationService,
  g: GenerationResult,
  query: string,
  reference: string,
  judge: GenerationJudge,
  render: RenderValidator
): Promise<Outcome> {
  // SINGLE-SHOT metrics (the retrieval thesis) — all computed on the first
  // generation, identical to Pass A/B so the table stays comparable.
  const tsc = await tscValidate(g.component);
  const smells = detectV2Smells(g.component);
  const incomplete = lintComposition(g.component).map((i) => `${i.component}:${i.missing.join('/')}`);
  const { grade, reason } = await judge.grade(query, g.component, reference);

  // Pass D 2x2: from the SAME failed component, run two independent repair loops
  // — raw (tsc errors only) and hinted (tsc errors + smell-guided migration
  // hints). The arm's OWN context (g.context: real docs for grounded, [] for
  // no-context) is passed through both, keeping repair symmetric with the arm.
  // Sequential, NOT parallel: tscValidate writes a shared sandbox file, so the
  // two loops must not interleave.
  const armContext = g.context.map((c) => c.rendered).join('\n\n');
  const repairRaw = await runRepairLoop(gen, query, g.component, tsc.diagnostics, armContext, tsc.ok, false);
  const repairHinted = await runRepairLoop(gen, query, g.component, tsc.diagnostics, armContext, tsc.ok, true);

  // Render the FINAL hinted-repair artifact (the shippable one). Uses its own
  // gen-sandbox/render/ files, so it doesn't collide with the tsc sandbox above.
  const rendered = await render.validate(repairHinted.healed);

  return {
    grade,
    reason,
    tscOk: tsc.ok,
    tscErrors: tsc.errorCount,
    smells,
    incomplete,
    cleanCodeBlock: g.cleanCodeBlock,
    component: g.component,
    repairRaw,
    repairHinted,
    renderOk: rendered.ok,
    renderError: rendered.error,
  };
}

function aggregate(outcomes: Outcome[]): Aggregate {
  const n = outcomes.length;
  const sum = (f: (o: Outcome) => number) => outcomes.reduce((a, o) => a + f(o), 0);
  return {
    n,
    meanGrade: sum((o) => o.grade) / n,
    satisfaction: sum((o) => (o.grade === 2 ? 1 : 0)) / n,
    tscPassRate: sum((o) => (o.tscOk ? 1 : 0)) / n,
    smellRate: sum((o) => (o.smells.length > 0 ? 1 : 0)) / n,
    completeRate: sum((o) => (o.incomplete.length === 0 ? 1 : 0)) / n,
    totalSmells: sum((o) => o.smells.length),
    totalIncomplete: sum((o) => o.incomplete.length),
    rawTscPassRate: sum((o) => (o.repairRaw.tscOk ? 1 : 0)) / n,
    rawSmellRate: sum((o) => (o.repairRaw.smells > 0 ? 1 : 0)) / n,
    rawIters: sum((o) => o.repairRaw.iters),
    hintedTscPassRate: sum((o) => (o.repairHinted.tscOk ? 1 : 0)) / n,
    hintedSmellRate: sum((o) => (o.repairHinted.smells > 0 ? 1 : 0)) / n,
    hintedIters: sum((o) => o.repairHinted.iters),
    renderPassRate: sum((o) => (o.renderOk ? 1 : 0)) / n,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const dpct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)}%`;

// Measurement harness: temp 0 + a fixed seed so a single A/B run is a stable
// signal (Item 1). Move 0 measured ~5.6% of tsc cells flipping run-to-run (all
// in the grounded arm); this freezes the measurement. Product paths (the CLI)
// keep the 0.2 default — variety is a feature there. The 2 genuinely bimodal
// cells (button-icon, icon-button) still need k-sampling for an honest headline.
const MEASUREMENT_SEED = 42;

// --- k-sample headline mode (Item 1, final piece) -------------------------------
function parseSamples(): number {
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--samples' || argv[i] === '-k') {
      const v = Number.parseInt(argv[i + 1] ?? '', 10);
      if (Number.isFinite(v) && v > 0) return v;
    }
    const m = /^--samples=(\d+)$/.exec(argv[i]);
    if (m) return Number.parseInt(m[1], 10);
  }
  return 1;
}

interface CellRates {
  id: string;
  arm: 'grounded' | 'nocontext';
  tscPass: number; // fraction of k draws whose FINAL hinted artifact passes tsc
  renderPass: number; // fraction that mounts
  k: number;
}

// One lean draw: generate -> tsc -> hinted-repair -> render. NO judge — it is
// untrusted on v3 (Pass A) and not part of the reliability headline, so sampling
// skips it to cut cost. Mirrors the shippable hinted path.
async function sampleOnce(
  gen: GenerationService,
  query: string,
  useContext: boolean,
  render: RenderValidator
): Promise<{ tscOk: boolean; renderOk: boolean }> {
  const g = await gen.generate(query, { k: 8, useContext });
  const armContext = g.context.map((c) => c.rendered).join('\n\n');
  const first = await tscValidate(g.component);
  const hinted = await runRepairLoop(gen, query, g.component, first.diagnostics, armContext, first.ok, true);
  const rendered = await render.validate(hinted.healed);
  return { tscOk: hinted.tscOk, renderOk: rendered.ok };
}

// For an HONEST reliability number on the bimodal cells (button-icon, number-input
// — frozen to an arbitrary 0/1 by a single seed), draw k generations per
// (prompt, arm) at the PRODUCT temperature (0.2) with a different seed each draw
// (reproducible set, varied samples) and report the per-cell PASS RATE. Pure
// independent fan-out -> ideal for the Batch API later (CLAUDE.md cost rule);
// synchronous here for the first cut.
async function runSampledHeadline(k: number): Promise<void> {
  const render = new RenderValidator();
  const arms: Array<'grounded' | 'nocontext'> = ['grounded', 'nocontext'];
  const acc: Record<string, Record<string, { tsc: number; render: number }>> = {};
  for (const p of LANDMINE_PROMPTS) {
    acc[p.id] = { grounded: { tsc: 0, render: 0 }, nocontext: { tsc: 0, render: 0 } };
  }

  console.log('='.repeat(88));
  console.log(`SAMPLED HEADLINE — k=${k} draws/cell @ temp 0.2, varied seed (honest reliability)`);
  console.log('='.repeat(88));

  try {
    for (let i = 0; i < k; i++) {
      const gen = new GenerationService({ temperature: 0.2, seed: MEASUREMENT_SEED + i });
      process.stdout.write(`  sample ${i + 1}/${k} (seed ${MEASUREMENT_SEED + i}) …`);
      for (const p of LANDMINE_PROMPTS) {
        for (const arm of arms) {
          const r = await sampleOnce(gen, p.query, arm === 'grounded', render);
          if (r.tscOk) acc[p.id][arm].tsc++;
          if (r.renderOk) acc[p.id][arm].render++;
        }
      }
      console.log(' done');
    }
  } finally {
    await render.close();
  }

  const cells: CellRates[] = [];
  for (const p of LANDMINE_PROMPTS) {
    for (const arm of arms) {
      cells.push({ id: p.id, arm, tscPass: acc[p.id][arm].tsc / k, renderPass: acc[p.id][arm].render / k, k });
    }
  }

  const rate = (x: number) => `${(x * 100).toFixed(0)}%`;
  console.log(`\nPer-cell pass-rate (hinted-tsc / render) over k=${k} — bimodal cells sit strictly between 0% and 100%:`);
  console.log(`  ${'prompt'.padEnd(18)} | grounded tsc/render | no-context tsc/render`);
  console.log('  ' + '-'.repeat(64));
  for (const p of LANDMINE_PROMPTS) {
    const g = acc[p.id].grounded;
    const n = acc[p.id].nocontext;
    const bimodal = [g.tsc, g.render, n.tsc, n.render].some((c) => c > 0 && c < k) ? '  ←bimodal' : '';
    console.log(
      `  ${p.id.padEnd(18)} | ${rate(g.tsc / k).padStart(4)} / ${rate(g.render / k).padStart(4)}      | ${rate(n.tsc / k).padStart(4)} / ${rate(n.render / k).padStart(4)}${bimodal}`
    );
  }

  const np = LANDMINE_PROMPTS.length;
  const mean = (arm: string, sel: (c: { tsc: number; render: number }) => number) =>
    LANDMINE_PROMPTS.reduce((a, p) => a + sel(acc[p.id][arm]), 0) / (np * k);
  console.log('\n  AGGREGATE (mean pass-rate across prompts):');
  console.log(`    grounded   : hinted-tsc ${rate(mean('grounded', (c) => c.tsc))}  render ${rate(mean('grounded', (c) => c.render))}`);
  console.log(`    no-context : hinted-tsc ${rate(mean('nocontext', (c) => c.tsc))}  render ${rate(mean('nocontext', (c) => c.render))}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(OUT_DIR, `gen-samples-k${k}-${stamp}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), k, temperature: 0.2, baseSeed: MEASUREMENT_SEED, cells }, null, 2),
    'utf8'
  );
  console.log(`\n💾 Report: ${path.relative(process.cwd(), reportPath)}`);
  console.log('='.repeat(88));
}
// --------------------------------------------------------------------------------

async function main(): Promise<void> {
  const gen = new GenerationService({ temperature: 0, seed: MEASUREMENT_SEED });
  const judge = new GenerationJudge();
  // One browser, reused across all 30 (prompt × arm) renders — a launch per call
  // would dominate the run. Closed in the finally below.
  const render = new RenderValidator();

  console.log('='.repeat(88));
  console.log(`GENERATION A/B — grounded vs no-context  (gen: ${gen.modelName}, judge: ${judge.modelName}, grounded-judge)`);
  console.log('='.repeat(88));
  console.log(`prompt`.padEnd(18) + ' | grounded (g/tsc/smell/inc) | no-context (g/tsc/smell/inc)');
  console.log('-'.repeat(88));

  const grounded: Outcome[] = [];
  const nocontext: Outcome[] = [];
  const perPrompt: Array<Record<string, unknown>> = [];

  for (const p of LANDMINE_PROMPTS) {
    const gGen = await gen.generate(p.query, { k: 8, useContext: true });
    const nGen = await gen.generate(p.query, { k: 8, useContext: false });
    const reference = gGen.context.map((c) => c.rendered).join('\n\n');

    const g = await score(gen, gGen, p.query, reference, judge, render);
    const n = await score(gen, nGen, p.query, reference, judge, render);
    grounded.push(g);
    nocontext.push(n);

    // tsc cell shows single-shot, then raw/hinted repair outcomes when it failed;
    // rnd = does the final hinted artifact mount.
    const fmt = (o: Outcome) => {
      const tscCell = o.tscOk
        ? `tsc=ok`
        : `tsc=ERR->raw:${o.repairRaw.tscOk ? 'ok' : 'ERR'}/hint:${o.repairHinted.tscOk ? 'ok' : 'ERR'}`;
      return `g=${o.grade} ${tscCell} sm=${o.smells.length} inc=${o.incomplete.length} rnd=${o.renderOk ? 'ok' : 'ERR'}`;
    };
    console.log(`${p.id.padEnd(18)} |  ${fmt(g).padEnd(40)} |  ${fmt(n)}`);

    perPrompt.push({ id: p.id, query: p.query, risks: p.risks, grounded: g, nocontext: n });
  }

  const ag = aggregate(grounded);
  const an = aggregate(nocontext);

  console.log('\n' + '='.repeat(88));
  console.log('AGGREGATE');
  console.log('='.repeat(88));
  const row = (label: string, a: Aggregate) =>
    console.log(
      `  ${label.padEnd(12)} satisfaction ${pct(a.satisfaction).padStart(4)}  |  tsc single ${pct(a.tscPassRate).padStart(4)} → raw ${pct(a.rawTscPassRate).padStart(4)} (${a.rawIters}i) → hinted ${pct(a.hintedTscPassRate).padStart(4)} (${a.hintedIters}i)  |  v2-smell ${pct(a.smellRate).padStart(4)} (${a.totalSmells})  |  complete ${pct(a.completeRate).padStart(4)}  |  render ${pct(a.renderPassRate).padStart(4)}`
    );
  row('GROUNDED', ag);
  row('no-context', an);
  console.log('\n  The 2x2 (tsc-pass, generation arm × repair mode):');
  console.log(`    ${''.padEnd(12)} single-shot | raw-repair | hinted-repair`);
  console.log(`    ${'grounded'.padEnd(12)} ${pct(ag.tscPassRate).padStart(11)} | ${pct(ag.rawTscPassRate).padStart(10)} | ${pct(ag.hintedTscPassRate).padStart(13)}`);
  console.log(`    ${'no-context'.padEnd(12)} ${pct(an.tscPassRate).padStart(11)} | ${pct(an.rawTscPassRate).padStart(10)} | ${pct(an.hintedTscPassRate).padStart(13)}`);
  console.log('\n  Δ (grounded − no-context):');
  console.log(
    `    satisfaction ${dpct(ag.satisfaction - an.satisfaction)}` +
      `  |  tsc single ${dpct(ag.tscPassRate - an.tscPassRate)}` +
      `  |  tsc raw ${dpct(ag.rawTscPassRate - an.rawTscPassRate)}` +
      `  |  tsc hinted ${dpct(ag.hintedTscPassRate - an.hintedTscPassRate)}` +
      `  |  v2-smell ${dpct(ag.smellRate - an.smellRate)}`
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(OUT_DIR, `gen-ab-${stamp}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), genModel: gen.modelName, judgeModel: judge.modelName, groundedJudge: true, selfCorrection: { maxIters: MAX_REPAIR_ITERS, modes: ['raw', 'smell-hint'] }, grounded: ag, nocontext: an, perPrompt },
      null,
      2
    ),
    'utf8'
  );
  console.log(`\n💾 Report: ${path.relative(process.cwd(), reportPath)}`);
  console.log('='.repeat(88));

  await render.close();
}

// Default (no flag) = the temp-0 + seed 2x2 A/B (regression signal). `--samples k`
// = the k-draw reliability headline (honest pass-rate on the bimodal cells).
const SAMPLES = parseSamples();
(SAMPLES > 1 ? runSampledHeadline(SAMPLES) : main()).catch((e) => {
  console.error(e);
  process.exit(1);
});
