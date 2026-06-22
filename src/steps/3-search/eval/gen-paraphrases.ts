// =============================================================================
// Retrieval Evaluation - Paraphrase Generator (one-time / refresh tool)
// =============================================================================
// Regenerates developer-phrased paraphrases of the golden queries with an LLM,
// for those who want to refresh or expand golden-set-paraphrased.ts instead of
// hand-editing it. It does NOT overwrite the committed set: it writes a
// reviewable artifact you copy from after sanity-checking.
//
// Usage:  npm run quality:paraphrase:gen
// Output: artifacts/eval/paraphrases.generated.json  ({ baseId: query })
//
// Prerequisite: OPENAI_API_KEY set; set DEBUG=false to avoid SDK request dumps.
// =============================================================================

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { OpenAI } from 'openai';
import { getJudgeModel } from '../../../config/vectorConfig.js';
import { GOLDEN_SET } from './golden-set.js';

const OUT_PATH = path.join(process.cwd(), 'artifacts', 'eval', 'paraphrases.generated.json');

const SYSTEM_PROMPT = `You rewrite documentation search queries the way a real developer would type them.
Given an ORIGINAL query, produce ONE paraphrase that:
  - keeps the exact same intent,
  - uses natural, casual developer phrasing (how someone actually searches),
  - deliberately AVOIDS reusing the distinctive nouns of the original (e.g. don't
    reuse "variant", "size", "loading" — describe the need in other words),
  - stays a single short line, no quotes.
Respond ONLY with the structured object.`;

const RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'paraphrase',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: { paraphrase: { type: 'string' } },
      required: ['paraphrase'],
    },
  },
};

async function main(): Promise<void> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = getJudgeModel();
  const out: Record<string, string> = {};

  console.log(`Generating paraphrases with ${model} for ${GOLDEN_SET.length} queries...`);
  for (const testCase of GOLDEN_SET) {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `ORIGINAL: ${testCase.query}` },
      ],
      response_format: RESPONSE_FORMAT,
    });
    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw) as { paraphrase?: string };
    const paraphrase = (parsed.paraphrase ?? '').trim();
    out[testCase.id] = paraphrase;
    console.log(`  ${testCase.id}: ${paraphrase}`);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\n💾 Wrote ${path.relative(process.cwd(), OUT_PATH)}`);
  console.log('Review it, then paste into PARAPHRASES in golden-set-paraphrased.ts.');
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
