import 'dotenv/config';
import { GenerationService } from '../generator.js';

async function main() {
  const g = new GenerationService();
  const svc = g as unknown as {
    assembleReservedSlots(q: string, k: number): Promise<Array<{ rank: number; componentName: string; chunkType: string; score: number }>>;
  };
  for (const q of ['a number input with min and max', 'a checkbox that is disabled', 'an email field with a label']) {
    console.log(`\nQUERY: ${q}`);
    const ctx = await svc.assembleReservedSlots(q, 8);
    for (const c of ctx) {
      console.log(`  [${c.rank}] ${c.componentName.padEnd(16)} ${c.chunkType.padEnd(20)} score=${c.score.toFixed(3)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
