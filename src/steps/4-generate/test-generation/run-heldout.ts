// =============================================================================
// End-to-end generalization test (held-out prompts)
// =============================================================================
// Drives the SHIPPABLE pipeline (generate -> self-heal -> validate -> write) over
// the held-out prompt set and reports the three objective tiers per prompt plus
// aggregates. This is the honest "end-to-end flight": prompts the v2-smell list
// and Pass E heuristics never saw. We report single-shot AND post-heal tsc so the
// result is clear about how much is generation vs the repair loop.
//
// Usage: npx tsx src/steps/4-generate/test-generation/run-heldout.ts
// Prereq: Qdrant up + embedded; OPENAI_API_KEY; DEBUG=false.
// =============================================================================

import 'dotenv/config';
import path from 'path';
import { GenerationService } from '../generator.js';
import { runGenerationPipeline, formatReport, type PipelineReport } from '../pipeline.js';
import { HELDOUT_PROMPTS } from './heldout-prompts.js';

const OUT_DIR = path.join(process.cwd(), 'artifacts', 'generated', 'heldout');
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

// Measurement harness: temp 0 + fixed seed for a stable single run (Item 1).
// Keep this in sync with run-ab.ts's MEASUREMENT_SEED so the two harnesses are
// comparable.
const MEASUREMENT_SEED = 42;

async function main(): Promise<void> {
  const gen = new GenerationService({ temperature: 0, seed: MEASUREMENT_SEED });

  console.log('='.repeat(92));
  console.log(`END-TO-END HELD-OUT TEST — shippable pipeline  (model: ${gen.modelName}, grounded)`);
  console.log('held-out = in the embedded corpus, NOT in the 15 landmines, NOT a Pass E hint target');
  console.log('='.repeat(92));

  const reports: PipelineReport[] = [];
  for (const p of HELDOUT_PROMPTS) {
    const report = await runGenerationPipeline(gen, p.query, {
      k: 8,
      useContext: true,
      outPath: path.join(OUT_DIR, `${p.id}.tsx`),
    });
    reports.push(report);
    console.log(`\n▸ ${p.id}  (top context: ${report.topContextComponent || '?'})`);
    console.log(`  "${p.query}"`);
    console.log(`  single-shot tsc=${report.tscOkSingleShot ? 'ok' : 'ERR'} → ${formatReport(report)}`);
  }

  const n = reports.length;
  const frac = (f: (r: PipelineReport) => boolean) => reports.filter(f).length / n;

  console.log('\n' + '='.repeat(92));
  console.log('AGGREGATE (held-out, n=' + n + ')');
  console.log('='.repeat(92));
  console.log(`  tsc-pass single-shot : ${pct(frac((r) => r.tscOkSingleShot))}`);
  console.log(`  tsc-pass post-heal   : ${pct(frac((r) => r.tscOk))}`);
  console.log(`  v2-smell free        : ${pct(frac((r) => r.smells.length === 0))}`);
  console.log(`  composition complete : ${pct(frac((r) => r.incomplete.length === 0))}`);
  console.log(`\n💾 Components written to ${path.relative(process.cwd(), OUT_DIR)}/`);
  console.log('='.repeat(92));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
