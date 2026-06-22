// =============================================================================
// Retrieval Evaluation - Runner
// =============================================================================
// Runs the golden query set through the EXISTING retrieval path and reports
// objective metrics, so "good enough" becomes a number.
//
// Usage:  npm run quality:eval        (k defaults to 5)
//         tsx src/steps/3-search/eval/run-eval.ts 10
//
// Prerequisite: Qdrant running + collection embedded (`npm run cli -- 2-embed`).
// =============================================================================

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { RetrievalService } from '../../../services/RetrievalService.js';
import { VectorStoreService } from '../../../services/VectorStoreService.js';
import {
  getCollectionName,
  getEmbeddingModel,
  getEmbeddingDimensions,
} from '../../../config/vectorConfig.js';
import { GOLDEN_SET } from './golden-set.js';
import {
  gradeQuery,
  aggregate,
  aggregateByCategory,
  scoreByIntent,
  getComponentName,
  getChunkType,
  type GradeableResult,
  type QueryGrade,
  type Aggregate,
} from './metrics.js';

const EVAL_DIR = path.join(process.cwd(), 'artifacts', 'eval');
const NORMALIZED_DIR = path.join(process.cwd(), 'artifacts', 'normalized');

/** Count chunks on disk in artifacts/normalized (sum of array lengths). */
function countDiskChunks(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      total += Array.isArray(data) ? data.length : 1;
    } catch {
      // ignore unreadable files in the count
    }
  }
  return total;
}

function pct(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(0)}%`;
}

function num(value: number | null): string {
  return value === null ? 'n/a' : value.toFixed(3);
}

function printAggregateRow(label: string, agg: Aggregate): void {
  const cells = [
    label.padEnd(18),
    `n=${String(agg.count).padEnd(3)}`,
    `hit@k ${pct(agg.hitRate).padStart(4)}`,
    `MRR ${num(agg.mrr).padStart(5)}`,
    `P@k ${num(agg.meanPrecision).padStart(5)}`,
  ];
  console.log('  ' + cells.join('   '));
}

async function runEval(k: number): Promise<void> {
  const collectionName = getCollectionName();
  const model = getEmbeddingModel();
  const dimensions = getEmbeddingDimensions();

  // ---- Provenance + drift detection --------------------------------------
  const vectorStore = new VectorStoreService();
  const pointCount = await vectorStore.getPointCount(collectionName);
  const diskChunkCount = countDiskChunks(NORMALIZED_DIR);

  console.log('\n' + '='.repeat(70));
  console.log('RETRIEVAL EVALUATION');
  console.log('='.repeat(70));
  console.log(`Collection : ${collectionName}`);
  console.log(`Model      : ${model} (${dimensions} dims)`);
  console.log(`Top-K      : ${k}`);
  console.log(`Queries    : ${GOLDEN_SET.length}`);
  console.log(`DB points  : ${pointCount === null ? 'UNREADABLE' : pointCount}`);
  console.log(`Disk chunks: ${diskChunkCount}`);

  if (pointCount === null) {
    console.error(
      `\n❌ Collection "${collectionName}" not found or unreadable. ` +
        `Run \`npm run cli -- 2-embed\` first.`
    );
    process.exit(1);
  }

  const stale = pointCount < diskChunkCount;
  if (stale) {
    console.warn(
      `\n⚠️  DB may be STALE: ${pointCount} embedded points < ${diskChunkCount} on-disk chunks.\n` +
        `   If you changed normalize/embed logic, re-run \`npm run cli -- 2-embed\` ` +
        `before trusting these scores.`
    );
  }

  // ---- Run queries through the existing retrieval path -------------------
  const retrieval = new RetrievalService({ collectionName });
  const grades: QueryGrade[] = [];
  const resultsByCase: GradeableResult[][] = [];
  const perQuery: Array<Record<string, unknown>> = [];

  for (const testCase of GOLDEN_SET) {
    const detailed = await retrieval.searchDetailed(testCase.query, k);
    const results: GradeableResult[] = detailed.results.map((r) => ({
      rank: r.rank,
      score: r.score,
      payload: r.payload,
    }));
    resultsByCase.push(results);

    const grade = gradeQuery(testCase, results, k);
    grades.push(grade);

    perQuery.push({
      ...grade,
      query: testCase.query,
      expectedComponents: testCase.expectedComponents,
      expectedChunkType: testCase.expectedChunkType ?? null,
      topResults: results.slice(0, 3).map((r) => ({
        component: getComponentName(r.payload) ?? null,
        chunkType: getChunkType(r.payload) ?? null,
        score: Number(r.score.toFixed(3)),
      })),
    });
  }

  // ---- Aggregate ----------------------------------------------------------
  const overall = aggregate(grades);
  const byCategory = aggregateByCategory(grades);
  const intentSplit = scoreByIntent(GOLDEN_SET, resultsByCase, k);

  // Diagnostic: did the *expected* chunk type answer the query?
  const chunkTypeCases = grades.filter((g) => g.expectedChunkTypeHit !== null);
  const chunkTypeHits = chunkTypeCases.filter((g) => g.expectedChunkTypeHit === true).length;

  // ---- Console summary ----------------------------------------------------
  console.log('\n' + '-'.repeat(70));
  console.log('OVERALL');
  console.log('-'.repeat(70));
  printAggregateRow('all', overall);
  console.log(`  malformed payloads: ${overall.malformedPayloads}`);

  console.log('\nBY CATEGORY');
  for (const [category, agg] of Object.entries(byCategory)) {
    printAggregateRow(category, agg);
  }

  console.log('\nDIAGNOSTICS');
  console.log(
    `  expected-chunk-type hit: ${chunkTypeHits}/${chunkTypeCases.length} ` +
      `(${pct(chunkTypeCases.length === 0 ? null : chunkTypeHits / chunkTypeCases.length)})`
  );
  console.log(
    `  mean score  generic hits: ${num(intentSplit.generic.meanScore)} (n=${intentSplit.generic.count})`
  );
  console.log(
    `  mean score specific hits: ${num(intentSplit.specific.meanScore)} (n=${intentSplit.specific.count})`
  );

  // ---- Write report (mkdir first to avoid ENOENT) -------------------------
  fs.mkdirSync(EVAL_DIR, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    provenance: { collectionName, model, dimensions, pointCount, diskChunkCount, stale },
    k,
    overall,
    byCategory,
    diagnostics: {
      expectedChunkType: { hits: chunkTypeHits, total: chunkTypeCases.length },
      intentScoreSplit: intentSplit,
    },
    perQuery,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(EVAL_DIR, `eval-${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n💾 Report written: ${path.relative(process.cwd(), reportPath)}`);
  console.log('='.repeat(70) + '\n');
}

async function main(): Promise<void> {
  const kArg = Number.parseInt(process.argv[2], 10);
  const k = Number.isFinite(kArg) && kArg > 0 ? kArg : 5;
  await runEval(k);
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
