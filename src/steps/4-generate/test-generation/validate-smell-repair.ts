// =============================================================================
// Regression check for the guarded smell-repair pass (pipeline.ts)
// =============================================================================
// tsc is blind to prop-level v2 drift (e.g. colorScheme), so a tsc-valid
// component can still carry a v2 smell that renders wrong. The guarded smell-
// repair pass fires ONLY when a tsc-green component still smells, and is monotonic
// (accept a repair only if smells strictly drop without breaking tsc/composition).
// This harness proves two things on the 15 landmine prompts:
//   1. NO REGRESSION — tsc-pass and composition-complete must not fall.
//   2. INTENDED EFFECT — the v2-smell rate should drop (or at least not rise).
//
// Method (SINGLE generation per prompt — no cross-run drift): run the product
// pipeline once with smell-repair OFF to get the generated + tsc-healed component
// (= BEFORE), then apply the SAME exported `guardedSmellRepair` to that exact
// component (= AFTER). Because before/after share one generation, every per-prompt
// delta is caused by the pass alone. temp 0 + fixed seed keeps the run a stable
// measurement (best-effort seed per the OpenAI caveat).
//
// Usage: DEBUG=false npx tsx src/steps/4-generate/test-generation/validate-smell-repair.ts
// Prereq: Qdrant up + embedded; OPENAI_API_KEY; DEBUG=false.
// =============================================================================

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { GenerationService } from '../generator.js';
import { runGenerationPipeline, guardedSmellRepair } from '../pipeline.js';
import { detectV2Smells } from '../validators/v2SmellDetector.js';
import { lintComposition } from '../validators/compositionLint.js';
import { RenderValidator } from '../validators/renderValidator.js';
import { LANDMINE_PROMPTS } from './landmine-prompts.js';

const SEED = 42;
const MAX_SMELL_REPAIR = 1;
const OUT_DIR = path.join(process.cwd(), 'artifacts', 'gen-eval');

interface State {
  tscOk: boolean;
  smells: string[];
  complete: boolean;
  renderOk: boolean;
}
interface Row {
  id: string;
  query: string;
  before: State;
  after: State;
  smellRepairIters: number;
}

interface Agg {
  n: number;
  tscPass: number;
  smellRate: number;
  totalSmells: number;
  completeRate: number;
  renderRate: number;
}

function aggregate(states: State[]): Agg {
  const n = states.length;
  const frac = (f: (s: State) => boolean) => states.filter(f).length / n;
  return {
    n,
    tscPass: frac((s) => s.tscOk),
    smellRate: frac((s) => s.smells.length > 0),
    totalSmells: states.reduce((a, s) => a + s.smells.length, 0),
    completeRate: frac((s) => s.complete),
    renderRate: frac((s) => s.renderOk),
  };
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const dpct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)}%`;

async function main(): Promise<void> {
  // temp 0 + fixed seed: a single run is a stable measurement (matches run-ab).
  const gen = new GenerationService({ temperature: 0, seed: SEED });
  const render = new RenderValidator(); // one browser, reused across the after-renders

  console.log('='.repeat(92));
  console.log(`SMELL-REPAIR REGRESSION CHECK — ${LANDMINE_PROMPTS.length} landmines, grounded, single-gen, temp 0 seed ${SEED}`);
  console.log('='.repeat(92));
  console.log(`${'prompt'.padEnd(18)} | before (tsc/smell/comp/rnd) | after (tsc/smell/comp/rnd) | pass`);
  console.log('-'.repeat(92));

  const rows: Row[] = [];
  try {
    for (const p of LANDMINE_PROMPTS) {
      // BEFORE: the real product pipeline with smell-repair disabled. This is the
      // single source generation + tsc self-heal + its render.
      const base = await runGenerationPipeline(gen, p.query, {
        useContext: true,
        maxSmellRepair: 0,
        outPath: null,
      });
      const before: State = {
        tscOk: base.tscOk,
        smells: base.smells,
        complete: base.incomplete.length === 0,
        renderOk: base.renderOk,
      };

      // AFTER: apply the SAME guarded pass to the SAME component. Gated on tscOk,
      // exactly as the pipeline gates it. Only re-render when the pass changed the
      // component (otherwise after === before).
      let afterComponent = base.component;
      let iters = 0;
      if (base.tscOk) {
        const armContext = base.context.map((c) => c.rendered).join('\n\n');
        const sr = await guardedSmellRepair(gen, p.query, base.component, armContext, MAX_SMELL_REPAIR);
        afterComponent = sr.component;
        iters = sr.iters;
      }
      const after: State =
        iters === 0
          ? before
          : {
              tscOk: true, // the guard only accepts tsc-valid candidates
              smells: detectV2Smells(afterComponent),
              complete: lintComposition(afterComponent).length === 0,
              renderOk: (await render.validate(afterComponent)).ok,
            };

      rows.push({ id: p.id, query: p.query, before, after, smellRepairIters: iters });

      const cell = (s: State) =>
        `${s.tscOk ? 'ok' : 'ERR'}/${s.smells.length}/${s.complete ? 'ok' : 'inc'}/${s.renderOk ? 'ok' : 'ERR'}`;
      const flag =
        iters > 0
          ? `smell-repaired ${before.smells.join(',')}→${after.smells.join(',') || 'clean'}`
          : before.smells.length > 0
            ? `still smells [${before.smells.join(',')}]${before.tscOk ? ' (guard kept original)' : ' (tsc-fail: not eligible)'}`
            : '';
      console.log(`${p.id.padEnd(18)} | ${cell(before).padEnd(27)} | ${cell(after).padEnd(26)} | ${flag}`);
    }
  } finally {
    await render.close();
  }

  const ab = aggregate(rows.map((r) => r.before));
  const aa = aggregate(rows.map((r) => r.after));

  console.log('\n' + '='.repeat(92));
  console.log('AGGREGATE  (before = smell-repair OFF, after = smell-repair ON — SAME generation)');
  console.log('='.repeat(92));
  const row = (label: string, a: Agg) =>
    console.log(
      `  ${label.padEnd(8)} tsc-pass ${pct(a.tscPass).padStart(4)}  |  v2-smell ${pct(a.smellRate).padStart(4)} (${a.totalSmells} total)  |  composition ${pct(a.completeRate).padStart(4)}  |  render ${pct(a.renderRate).padStart(4)}`
    );
  row('BEFORE', ab);
  row('AFTER', aa);
  console.log('\n  Δ (after − before):');
  console.log(
    `    tsc-pass ${dpct(aa.tscPass - ab.tscPass)} (must be ≥0)  |  v2-smell ${dpct(aa.smellRate - ab.smellRate)} (want ≤0)  |  composition ${dpct(aa.completeRate - ab.completeRate)} (must be ≥0)  |  render ${dpct(aa.renderRate - ab.renderRate)}`
  );

  const repaired = rows.filter((r) => r.smellRepairIters > 0).length;
  const eligibleSmelly = rows.filter((r) => r.before.tscOk && r.before.smells.length > 0).length;
  const ineligibleSmelly = rows.filter((r) => !r.before.tscOk && r.before.smells.length > 0).length;
  console.log(
    `\n  tsc-valid & smelly (eligible): ${eligibleSmelly} → smell-repaired ${repaired} / kept by guard ${eligibleSmelly - repaired}`
  );
  console.log(`  tsc-failing & smelly (NOT eligible — tsc loop's job first): ${ineligibleSmelly}`);

  // Verdict gates (CLAUDE.md success criteria): tsc-pass and composition must not
  // fall; smell rate must not rise. (With a shared generation, tsc-pass cannot
  // change at all — the guard never breaks tsc — so this is a strict check.)
  const ok =
    aa.tscPass >= ab.tscPass - 1e-9 &&
    aa.completeRate >= ab.completeRate - 1e-9 &&
    aa.smellRate <= ab.smellRate + 1e-9;
  console.log(`\n  VERDICT: ${ok ? '✅ no regression (tsc/composition held; smells did not rise)' : '❌ REGRESSION — investigate'}`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(OUT_DIR, `smell-repair-validation-${stamp}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), model: gen.modelName, seed: SEED, maxSmellRepair: MAX_SMELL_REPAIR, before: ab, after: aa, repaired, eligibleSmelly, ineligibleSmelly, rows },
      null,
      2
    ),
    'utf8'
  );
  console.log(`\n💾 Report: ${path.relative(process.cwd(), reportPath)}`);
  console.log('='.repeat(92));

  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
