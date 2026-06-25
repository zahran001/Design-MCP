// =============================================================================
// Phase 4a spike runner
// =============================================================================
// Runs the v3-landmine prompts through retrieve -> generate and prints, per
// prompt: the retrieved context summary + the generated TSX. Purely for human
// verification that the model ingests the spec chunks and emits clean,
// standalone TSX. NO validation, NO scoring — that's Phase 4b.
//
// Usage: npx tsx src/steps/4-generate/test-generation/run-spike.ts
// Prereq: Qdrant up + collection embedded; OPENAI_API_KEY set; DEBUG=false.
// =============================================================================

import 'dotenv/config';
import { GenerationService } from '../generator.js';
import { LANDMINE_PROMPTS } from './landmine-prompts.js';

async function main(): Promise<void> {
  const gen = new GenerationService();
  console.log('='.repeat(78));
  console.log(`PHASE 4a SPIKE — retrieve + generate (model: ${gen.modelName})`);
  console.log('='.repeat(78));

  for (const p of LANDMINE_PROMPTS) {
    const result = await gen.generate(p.query, { k: 8 });

    console.log('\n' + '#'.repeat(78));
    console.log(`# [${p.id}] ${p.query}`);
    console.log(`# landmine: ${p.note}`);
    console.log('#'.repeat(78));

    console.log('\nRetrieved context (top 8):');
    for (const c of result.context) {
      console.log(`  ${c.rank}. ${c.componentName} [${c.chunkType}]  score=${c.score.toFixed(3)}`);
    }

    console.log(`\nClean code block extracted: ${result.cleanCodeBlock ? 'yes ✅' : 'NO ⚠️'}`);
    console.log('Generated component:\n');
    console.log(result.component);
  }

  console.log('\n' + '='.repeat(78));
  console.log('Spike complete. Verify: context ingested + clean standalone TSX.');
  console.log('='.repeat(78));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
