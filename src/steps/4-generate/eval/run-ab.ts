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
      hints: withHints ? buildRepairHints(healed) : undefined,
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
}

async function score(
  gen: GenerationService,
  g: GenerationResult,
  query: string,
  reference: string,
  judge: GenerationJudge
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
  };
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const dpct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)}%`;

async function main(): Promise<void> {
  const gen = new GenerationService();
  const judge = new GenerationJudge();

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

    const g = await score(gen, gGen, p.query, reference, judge);
    const n = await score(gen, nGen, p.query, reference, judge);
    grounded.push(g);
    nocontext.push(n);

    // tsc cell shows single-shot, then raw/hinted repair outcomes when it failed.
    const fmt = (o: Outcome) => {
      const tscCell = o.tscOk
        ? `tsc=ok`
        : `tsc=ERR->raw:${o.repairRaw.tscOk ? 'ok' : 'ERR'}/hint:${o.repairHinted.tscOk ? 'ok' : 'ERR'}`;
      return `g=${o.grade} ${tscCell} sm=${o.smells.length} inc=${o.incomplete.length}`;
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
      `  ${label.padEnd(12)} satisfaction ${pct(a.satisfaction).padStart(4)}  |  tsc single ${pct(a.tscPassRate).padStart(4)} → raw ${pct(a.rawTscPassRate).padStart(4)} (${a.rawIters}i) → hinted ${pct(a.hintedTscPassRate).padStart(4)} (${a.hintedIters}i)  |  v2-smell ${pct(a.smellRate).padStart(4)} (${a.totalSmells})  |  complete ${pct(a.completeRate).padStart(4)}`
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
