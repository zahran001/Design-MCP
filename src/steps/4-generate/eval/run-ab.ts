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
// MAX_REPAIR_ITERS) using the arm's OWN context. We report BOTH single-shot
// tsc-pass (the retrieval thesis, unchanged) AND post-repair tsc-pass (product).
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
import { lintComposition } from '../validators/compositionLint.js';
import { LANDMINE_PROMPTS } from '../test-generation/landmine-prompts.js';

const OUT_DIR = path.join(process.cwd(), 'artifacts', 'gen-eval');

// Pass C (5.3): bounded tsc self-correction. Cap repair attempts so a model that
// can't fix its own output doesn't loop forever (or burn tokens).
const MAX_REPAIR_ITERS = 2;

interface Outcome {
  grade: number;
  reason: string;
  tscOk: boolean; // SINGLE-SHOT (retrieval thesis — unchanged across passes)
  tscErrors: number;
  smells: string[];
  incomplete: string[]; // e.g. "Checkbox:Control/Label"
  cleanCodeBlock: boolean;
  component: string;
  // Pass C product metrics (post tsc self-correction):
  repairTscOk: boolean; // tsc-valid after the repair loop (or single-shot if it already passed)
  repairIters: number; // repair attempts actually used (0 = passed first try)
  repairSmells: number; // v2-smells remaining in the healed component
  healed: string; // the final (possibly repaired) component
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
  // Pass C product metrics:
  repairTscPassRate: number; // fraction tsc-valid AFTER self-correction
  repairSmellRate: number; // fraction with >=1 v2 smell after self-correction
  totalRepairIters: number; // sum of repair attempts across the arm
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

  // Pass C (5.3): bounded tsc self-correction loop. Feed the compiler errors
  // back to a temp-0 repair call until tsc passes or we hit the cap. The arm's
  // OWN context (g.context: real docs for grounded, [] for no-context) is passed
  // through, keeping the repair symmetric with the generation arm.
  const armContext = g.context.map((c) => c.rendered).join('\n\n');
  let healed = g.component;
  let healedDiag = tsc.diagnostics;
  let repairTscOk = tsc.ok;
  let repairIters = 0;
  while (!repairTscOk && repairIters < MAX_REPAIR_ITERS) {
    healed = await gen.repair({ query, component: healed, diagnostics: healedDiag, contextBlock: armContext });
    const rt = await tscValidate(healed);
    repairTscOk = rt.ok;
    healedDiag = rt.diagnostics;
    repairIters++;
  }

  return {
    grade,
    reason,
    tscOk: tsc.ok,
    tscErrors: tsc.errorCount,
    smells,
    incomplete,
    cleanCodeBlock: g.cleanCodeBlock,
    component: g.component,
    repairTscOk,
    repairIters,
    repairSmells: detectV2Smells(healed).length,
    healed,
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
    repairTscPassRate: sum((o) => (o.repairTscOk ? 1 : 0)) / n,
    repairSmellRate: sum((o) => (o.repairSmells > 0 ? 1 : 0)) / n,
    totalRepairIters: sum((o) => o.repairIters),
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

    // tsc shows single-shot -> post-repair when a repair happened (e.g. ERR→ok i1).
    const fmt = (o: Outcome) => {
      const tscCell = o.repairIters === 0
        ? `tsc=${o.tscOk ? 'ok ' : 'ERR'}`
        : `tsc=${o.tscOk ? 'ok ' : 'ERR'}->${o.repairTscOk ? 'ok' : 'ERR'}(i${o.repairIters})`;
      return `g=${o.grade} ${tscCell} sm=${o.smells.length} inc=${o.incomplete.length}`;
    };
    console.log(`${p.id.padEnd(18)} |  ${fmt(g).padEnd(34)} |  ${fmt(n)}`);

    perPrompt.push({ id: p.id, query: p.query, risks: p.risks, grounded: g, nocontext: n });
  }

  const ag = aggregate(grounded);
  const an = aggregate(nocontext);

  console.log('\n' + '='.repeat(88));
  console.log('AGGREGATE');
  console.log('='.repeat(88));
  const row = (label: string, a: Aggregate) =>
    console.log(
      `  ${label.padEnd(12)} satisfaction ${pct(a.satisfaction).padStart(4)}  |  tsc-pass ${pct(a.tscPassRate).padStart(4)} →${pct(a.repairTscPassRate).padStart(4)} (post-repair, ${a.totalRepairIters} iters)  |  v2-smell ${pct(a.smellRate).padStart(4)} (${a.totalSmells})  |  complete ${pct(a.completeRate).padStart(4)} (${a.totalIncomplete} missing)`
    );
  row('GROUNDED', ag);
  row('no-context', an);
  console.log('\n  Δ (grounded − no-context):');
  console.log(
    `    satisfaction ${dpct(ag.satisfaction - an.satisfaction)}` +
      `  |  tsc-pass(single) ${dpct(ag.tscPassRate - an.tscPassRate)}` +
      `  |  tsc-pass(repaired) ${dpct(ag.repairTscPassRate - an.repairTscPassRate)}` +
      `  |  v2-smell ${dpct(ag.smellRate - an.smellRate)}` +
      `  |  complete ${dpct(ag.completeRate - an.completeRate)}`
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(OUT_DIR, `gen-ab-${stamp}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), genModel: gen.modelName, judgeModel: judge.modelName, groundedJudge: true, selfCorrection: { maxIters: MAX_REPAIR_ITERS }, grounded: ag, nocontext: an, perPrompt },
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
