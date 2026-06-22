// =============================================================================
// Retrieval Evaluation - Runner
// =============================================================================
// Runs the golden query set through the EXISTING retrieval path and reports
// objective metrics, so "good enough" becomes a number.
//
// Two layers of metric:
//   1. Component-level (cheap, structural): "did a chunk from the right
//      component appear in top-k." A coarse sanity check.
//   2. LLM-as-judge graded relevance (the headline): nDCG / graded precision
//      over per-chunk 0/1/2 relevance grades. Opt in with --judge.
//
// Usage:
//   npm run quality:eval                     # component metrics, golden set, k=5
//   npm run quality:eval -- --judge          # + LLM-judged nDCG (costs API calls)
//   npm run quality:eval -- --judge --paraphrased   # + leakage/robustness test
//   npm run quality:eval -- --k=10 --judge --paraphrased
//   (a bare positional number still sets k, for back-compat: `... -- 10`)
//
// Prerequisite: Qdrant running + collection embedded (`npm run cli -- 2-embed`).
// With --judge: OPENAI_API_KEY set and DEBUG=false (avoid SDK request dumps).
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
import { PARAPHRASED_SET } from './golden-set-paraphrased.js';
import { RelevanceJudge } from './judge.js';
import {
  gradeQuery,
  aggregate,
  aggregateByCategory,
  scoreByIntent,
  gradeGradedQuery,
  aggregateGraded,
  aggregateGradedByCategory,
  getComponentName,
  getChunkType,
  type GoldenCase,
  type GradeableResult,
  type QueryGrade,
  type GradedQuery,
  type Aggregate,
  type GradedAggregate,
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

function printGradedRow(label: string, agg: GradedAggregate): void {
  // gP@k + no-rel are the headline (honest, absolute relevance of the top-k).
  // nDCG is shown last and labeled as a diagnostic: it only ranks the chunks
  // that were retrieved, so it saturates and is NOT the primary signal.
  const cells = [
    label.padEnd(18),
    `n=${String(agg.count).padEnd(3)}`,
    `gP@k ${num(agg.meanGradedPrecision).padStart(5)}`,
    `no-rel ${String(agg.noRelevantQueries).padStart(2)}`,
    `nDCG* ${num(agg.meanNdcg).padStart(5)}`,
  ];
  console.log('  ' + cells.join('   '));
}

// -----------------------------------------------------------------------------
// Per-set evaluation
// -----------------------------------------------------------------------------

interface SetOutcome {
  label: string;
  grades: QueryGrade[];
  overall: Aggregate;
  byCategory: Record<string, Aggregate>;
  intentSplit: ReturnType<typeof scoreByIntent>;
  chunkTypeHits: number;
  chunkTypeTotal: number;
  // Present only when the judge ran:
  graded?: GradedQuery[];
  gradedOverall?: GradedAggregate;
  gradedByCategory?: Record<string, GradedAggregate>;
  perQuery: Array<Record<string, unknown>>;
}

async function evaluateSet(
  label: string,
  set: GoldenCase[],
  k: number,
  retrieval: RetrievalService,
  judge: RelevanceJudge | null
): Promise<SetOutcome> {
  const grades: QueryGrade[] = [];
  const resultsByCase: GradeableResult[][] = [];
  const graded: GradedQuery[] = [];
  const perQuery: Array<Record<string, unknown>> = [];

  for (const testCase of set) {
    const detailed = await retrieval.searchDetailed(testCase.query, k);
    const results: GradeableResult[] = detailed.results.map((r) => ({
      rank: r.rank,
      score: r.score,
      payload: r.payload,
    }));
    resultsByCase.push(results);

    const grade = gradeQuery(testCase, results, k);
    grades.push(grade);

    // LLM-judge graded relevance (optional).
    let judgeInfo: Array<{ grade: number; reason: string }> | undefined;
    let gradedQuery: GradedQuery | undefined;
    if (judge) {
      const judged = await judge.gradeResults(
        testCase.query,
        results.map((r) => r.payload)
      );
      judgeInfo = judged.map((j) => ({ grade: j.grade, reason: j.reason }));
      gradedQuery = gradeGradedQuery(
        testCase.id,
        testCase.category,
        judged.map((j) => j.grade),
        k
      );
      graded.push(gradedQuery);
    }

    perQuery.push({
      ...grade,
      query: testCase.query,
      expectedComponents: testCase.expectedComponents,
      expectedChunkType: testCase.expectedChunkType ?? null,
      ndcg: gradedQuery?.ndcg ?? null,
      gradedPrecision: gradedQuery?.gradedPrecision ?? null,
      topResults: results.slice(0, 3).map((r, i) => ({
        component: getComponentName(r.payload) ?? null,
        chunkType: getChunkType(r.payload) ?? null,
        score: Number(r.score.toFixed(3)),
        judgeGrade: judgeInfo?.[i]?.grade ?? null,
        judgeReason: judgeInfo?.[i]?.reason ?? null,
      })),
    });
  }

  const overall = aggregate(grades);
  const byCategory = aggregateByCategory(grades);
  const intentSplit = scoreByIntent(set, resultsByCase, k);

  const chunkTypeCases = grades.filter((g) => g.expectedChunkTypeHit !== null);
  const chunkTypeHits = chunkTypeCases.filter((g) => g.expectedChunkTypeHit === true).length;

  const outcome: SetOutcome = {
    label,
    grades,
    overall,
    byCategory,
    intentSplit,
    chunkTypeHits,
    chunkTypeTotal: chunkTypeCases.length,
    perQuery,
  };

  if (judge) {
    outcome.graded = graded;
    outcome.gradedOverall = aggregateGraded(graded);
    outcome.gradedByCategory = aggregateGradedByCategory(graded);
  }

  return outcome;
}

function printSet(outcome: SetOutcome): void {
  console.log('\n' + '-'.repeat(70));
  console.log(`${outcome.label.toUpperCase()} — component-level (structural sanity)`);
  console.log('-'.repeat(70));
  printAggregateRow('all', outcome.overall);
  console.log(`  malformed payloads: ${outcome.overall.malformedPayloads}`);

  console.log('\n  by category:');
  for (const [category, agg] of Object.entries(outcome.byCategory)) {
    printAggregateRow(category, agg);
  }

  console.log('\n  diagnostics:');
  console.log(
    `    expected-chunk-type hit: ${outcome.chunkTypeHits}/${outcome.chunkTypeTotal} ` +
      `(${pct(outcome.chunkTypeTotal === 0 ? null : outcome.chunkTypeHits / outcome.chunkTypeTotal)})`
  );
  console.log(
    `    mean score  generic hits: ${num(outcome.intentSplit.generic.meanScore)} (n=${outcome.intentSplit.generic.count})`
  );
  console.log(
    `    mean score specific hits: ${num(outcome.intentSplit.specific.meanScore)} (n=${outcome.intentSplit.specific.count})`
  );

  if (outcome.gradedOverall && outcome.gradedByCategory) {
    console.log('\n  LLM-JUDGE graded relevance (HEADLINE = gP@k + no-rel; nDCG* = diagnostic):');
    printGradedRow('all', outcome.gradedOverall);
    console.log('\n  by category:');
    for (const [category, agg] of Object.entries(outcome.gradedByCategory)) {
      printGradedRow(category, agg);
    }
  }
}

function printLeakage(golden: SetOutcome, paraphrased: SetOutcome): void {
  console.log('\n' + '='.repeat(70));
  console.log('LEAKAGE / ROBUSTNESS — golden vs paraphrased (lower drop = more real)');
  console.log('='.repeat(70));

  const gHit = golden.overall.hitRate;
  const pHit = paraphrased.overall.hitRate;
  console.log(
    `  component hit@k : ${pct(gHit)} -> ${pct(pHit)}   ` +
      `(Δ ${gHit !== null && pHit !== null ? `${((pHit - gHit) * 100).toFixed(0)}%` : 'n/a'})`
  );

  if (golden.gradedOverall && paraphrased.gradedOverall) {
    const gP = golden.gradedOverall.meanGradedPrecision;
    const pP = paraphrased.gradedOverall.meanGradedPrecision;
    console.log(
      `  graded P@k (HL) : ${num(gP)} -> ${num(pP)}   ` +
        `(Δ ${gP !== null && pP !== null ? (pP - gP).toFixed(3) : 'n/a'})`
    );
    const gNoRel = golden.gradedOverall.noRelevantQueries;
    const pNoRel = paraphrased.gradedOverall.noRelevantQueries;
    console.log(`  no-rel queries  : ${gNoRel} -> ${pNoRel}   (Δ ${pNoRel - gNoRel})`);

    const gN = golden.gradedOverall.meanNdcg;
    const pN = paraphrased.gradedOverall.meanNdcg;
    console.log(
      `  nDCG* (diag)    : ${num(gN)} -> ${num(pN)}   ` +
        `(Δ ${gN !== null && pN !== null ? (pN - gN).toFixed(3) : 'n/a'})`
    );
  }
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

interface EvalOptions {
  k: number;
  useJudge: boolean;
  useParaphrased: boolean;
}

async function runEval(options: EvalOptions): Promise<void> {
  const { k, useJudge, useParaphrased } = options;
  const collectionName = getCollectionName();
  const model = getEmbeddingModel();
  const dimensions = getEmbeddingDimensions();

  // ---- Provenance + drift detection --------------------------------------
  const vectorStore = new VectorStoreService();
  const pointCount = await vectorStore.getPointCount(collectionName);
  const diskChunkCount = countDiskChunks(NORMALIZED_DIR);

  const judge = useJudge ? new RelevanceJudge() : null;

  console.log('\n' + '='.repeat(70));
  console.log('RETRIEVAL EVALUATION');
  console.log('='.repeat(70));
  console.log(`Collection : ${collectionName}`);
  console.log(`Model      : ${model} (${dimensions} dims)`);
  console.log(`Top-K      : ${k}`);
  console.log(`Golden     : ${GOLDEN_SET.length} queries`);
  console.log(`Paraphrased: ${useParaphrased ? `${PARAPHRASED_SET.length} queries` : 'skipped'}`);
  console.log(`LLM judge  : ${judge ? judge.modelName : 'off (component metrics only)'}`);
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

  const retrieval = new RetrievalService({ collectionName });

  // ---- Evaluate set(s) ----------------------------------------------------
  const golden = await evaluateSet('golden', GOLDEN_SET, k, retrieval, judge);
  printSet(golden);

  let paraphrased: SetOutcome | null = null;
  if (useParaphrased) {
    paraphrased = await evaluateSet('paraphrased', PARAPHRASED_SET, k, retrieval, judge);
    printSet(paraphrased);
    printLeakage(golden, paraphrased);
  }

  if (judge) judge.saveCache();

  // ---- Write report -------------------------------------------------------
  fs.mkdirSync(EVAL_DIR, { recursive: true });
  const report = {
    generatedAt: new Date().toISOString(),
    provenance: {
      collectionName,
      model,
      dimensions,
      pointCount,
      diskChunkCount,
      stale,
      judgeModel: judge ? judge.modelName : null,
    },
    k,
    sets: {
      golden: serializeSet(golden),
      ...(paraphrased ? { paraphrased: serializeSet(paraphrased) } : {}),
    },
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(EVAL_DIR, `eval-${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n💾 Report written: ${path.relative(process.cwd(), reportPath)}`);
  console.log('='.repeat(70) + '\n');
}

function serializeSet(outcome: SetOutcome): Record<string, unknown> {
  return {
    overall: outcome.overall,
    byCategory: outcome.byCategory,
    diagnostics: {
      expectedChunkType: { hits: outcome.chunkTypeHits, total: outcome.chunkTypeTotal },
      intentScoreSplit: outcome.intentSplit,
    },
    graded: outcome.gradedOverall
      ? { overall: outcome.gradedOverall, byCategory: outcome.gradedByCategory }
      : null,
    perQuery: outcome.perQuery,
  };
}

function parseArgs(argv: string[]): EvalOptions {
  let k = 5;
  let useJudge = false;
  let useParaphrased = false;

  for (const arg of argv) {
    if (arg === '--judge') useJudge = true;
    else if (arg === '--paraphrased' || arg === '--both') useParaphrased = true;
    else if (arg.startsWith('--k=')) {
      const parsed = Number.parseInt(arg.slice('--k='.length), 10);
      if (Number.isFinite(parsed) && parsed > 0) k = parsed;
    } else {
      // Back-compat: a bare positional number sets k.
      const parsed = Number.parseInt(arg, 10);
      if (Number.isFinite(parsed) && parsed > 0) k = parsed;
    }
  }
  return { k, useJudge, useParaphrased };
}

async function main(): Promise<void> {
  await runEval(parseArgs(process.argv.slice(2)));
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
