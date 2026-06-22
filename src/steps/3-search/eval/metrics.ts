// =============================================================================
// Retrieval Evaluation - Metrics
// =============================================================================
// Pure, unit-testable scoring functions for the retrieval eval harness.
//
// Design rules (see plan):
// - Grade at COMPONENT level (gating); chunkType is a secondary diagnostic.
//   Never grade on chunkId (it is content-derived and changes on every repolish).
// - Treat payloads and every field as optional. A missing field is a graded MISS,
//   never a thrown error.
// - safeDiv distinguishes "no data" (null -> rendered "n/a") from a real zero.
// =============================================================================

export type Payload = Record<string, unknown> | null | undefined;

/** A single retrieved result, trimmed to what grading needs. */
export interface GradeableResult {
  rank: number;
  score: number;
  payload: Payload;
}

/** A golden-set query case. */
export interface GoldenCase {
  id: string;
  query: string;
  /** Acceptable component answers (any match counts as a hit). */
  expectedComponents: string[];
  /** Optional: the chunk type that *should* answer this query (diagnostic only). */
  expectedChunkType?: string;
  category: string;
}

/** Per-query grade. */
export interface QueryGrade {
  id: string;
  category: string;
  /** Did an expected component appear within top-k? (gating metric) */
  componentHit: boolean;
  /** 1-based rank of the first expected-component result, or null if none. */
  firstHitRank: number | null;
  /** 1/firstHitRank, or 0 if no hit. */
  reciprocalRank: number;
  /** Relevant results in top-k divided by results considered; 0 if none returned. */
  precisionAtK: number;
  /** chunkType of the first component-hit (diagnostic attribution), or null. */
  firstHitChunkType: string | null;
  /** If expectedChunkType set: did the first component-hit match it? null if n/a. */
  expectedChunkTypeHit: boolean | null;
  /** Count of top-k results missing componentName or chunkType (data-quality signal). */
  malformedPayloads: number;
}

// -----------------------------------------------------------------------------
// Safe payload accessors
// -----------------------------------------------------------------------------

export function getComponentName(payload: Payload): string | undefined {
  const v = payload?.['componentName'];
  return typeof v === 'string' ? v : undefined;
}

export function getChunkType(payload: Payload): string | undefined {
  const v = payload?.['chunkType'];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Best-effort intent extraction for code-example chunks, used to measure the
 * retrieval cost of "generic" boilerplate chunks. Reads the stringified
 * fullChunk payload defensively; returns undefined for anything else.
 */
export function getIntent(payload: Payload): string | undefined {
  const raw = payload?.['fullChunk'];
  if (typeof raw !== 'string') return undefined;
  try {
    const parsed = JSON.parse(raw) as { example?: { intent?: unknown } };
    const intent = parsed?.example?.intent;
    return typeof intent === 'string' ? intent : undefined;
  } catch {
    return undefined;
  }
}

// -----------------------------------------------------------------------------
// Pure helpers
// -----------------------------------------------------------------------------

/**
 * Normalize a component name for tolerant comparison:
 * lowercase, and collapse any run of non-alphanumeric chars to a single space.
 * So "Icon Button", "icon-button", and "Icon  Button" all compare equal.
 */
export function normalizeComponentName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Division that returns null when the denominator is zero, so callers can
 * render "n/a" instead of emitting NaN/Infinity. Use ONLY where a zero
 * denominator means "no data" (e.g. a category with no queries) — not where
 * zero is a real failure (e.g. a query that returned no results).
 */
export function safeDiv(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return numerator / denominator;
}

// -----------------------------------------------------------------------------
// Grading
// -----------------------------------------------------------------------------

/**
 * Grade a single query's retrieval results against its golden case.
 * `k` bounds how many top results are considered.
 */
export function gradeQuery(
  testCase: GoldenCase,
  results: GradeableResult[],
  k: number
): QueryGrade {
  const topK = results.slice(0, k);
  const expected = new Set(testCase.expectedComponents.map(normalizeComponentName));

  let firstHitRank: number | null = null;
  let firstHitChunkType: string | null = null;
  let relevantCount = 0;
  let malformedPayloads = 0;

  topK.forEach((result, index) => {
    const component = getComponentName(result.payload);
    const chunkType = getChunkType(result.payload);

    if (component === undefined || chunkType === undefined) {
      malformedPayloads++;
    }

    const isMatch =
      component !== undefined && expected.has(normalizeComponentName(component));

    if (isMatch) {
      relevantCount++;
      if (firstHitRank === null) {
        firstHitRank = index + 1;
        firstHitChunkType = chunkType ?? null;
      }
    }
  });

  const componentHit = firstHitRank !== null;
  const reciprocalRank = firstHitRank !== null ? 1 / firstHitRank : 0;

  // Precision: relevant results / results actually considered.
  // Zero results returned is a real failure -> precision 0 (NOT n/a).
  const considered = topK.length;
  const precisionAtK = considered === 0 ? 0 : relevantCount / considered;

  let expectedChunkTypeHit: boolean | null = null;
  if (testCase.expectedChunkType !== undefined) {
    expectedChunkTypeHit =
      firstHitChunkType !== null &&
      firstHitChunkType === testCase.expectedChunkType;
  }

  return {
    id: testCase.id,
    category: testCase.category,
    componentHit,
    firstHitRank,
    reciprocalRank,
    precisionAtK,
    firstHitChunkType,
    expectedChunkTypeHit,
    malformedPayloads,
  };
}

// -----------------------------------------------------------------------------
// Aggregation
// -----------------------------------------------------------------------------

export interface Aggregate {
  count: number;
  /** Fraction of queries with a component hit in top-k; null if count === 0. */
  hitRate: number | null;
  /** Mean reciprocal rank; null if count === 0. */
  mrr: number | null;
  /** Mean precision@k; null if count === 0. */
  meanPrecision: number | null;
  /** Total malformed payloads across the queries. */
  malformedPayloads: number;
}

export function aggregate(grades: QueryGrade[]): Aggregate {
  const count = grades.length;
  const hits = grades.filter((g) => g.componentHit).length;
  const rrSum = grades.reduce((sum, g) => sum + g.reciprocalRank, 0);
  const precSum = grades.reduce((sum, g) => sum + g.precisionAtK, 0);
  const malformed = grades.reduce((sum, g) => sum + g.malformedPayloads, 0);

  return {
    count,
    hitRate: safeDiv(hits, count),
    mrr: safeDiv(rrSum, count),
    meanPrecision: safeDiv(precSum, count),
    malformedPayloads: malformed,
  };
}

/** Aggregate grades grouped by category (preserves first-seen order). */
export function aggregateByCategory(grades: QueryGrade[]): Record<string, Aggregate> {
  const groups = new Map<string, QueryGrade[]>();
  for (const grade of grades) {
    const bucket = groups.get(grade.category) ?? [];
    bucket.push(grade);
    groups.set(grade.category, bucket);
  }

  const out: Record<string, Aggregate> = {};
  for (const [category, bucket] of groups) {
    out[category] = aggregate(bucket);
  }
  return out;
}

/**
 * Mean retrieval score split by whether a code-example hit is "generic"
 * boilerplate vs a specific intent. Quantifies the cost of low-value chunks.
 * Only considers results whose component matched an expected answer.
 */
export interface IntentScoreSplit {
  generic: { count: number; meanScore: number | null };
  specific: { count: number; meanScore: number | null };
}

export function scoreByIntent(
  cases: GoldenCase[],
  resultsByCase: GradeableResult[][],
  k: number
): IntentScoreSplit {
  let genericSum = 0;
  let genericCount = 0;
  let specificSum = 0;
  let specificCount = 0;

  cases.forEach((testCase, i) => {
    const expected = new Set(testCase.expectedComponents.map(normalizeComponentName));
    const topK = (resultsByCase[i] ?? []).slice(0, k);
    for (const result of topK) {
      const component = getComponentName(result.payload);
      if (component === undefined || !expected.has(normalizeComponentName(component))) {
        continue;
      }
      const intent = getIntent(result.payload);
      if (intent === undefined) continue;
      if (intent === 'generic') {
        genericSum += result.score;
        genericCount++;
      } else {
        specificSum += result.score;
        specificCount++;
      }
    }
  });

  return {
    generic: { count: genericCount, meanScore: safeDiv(genericSum, genericCount) },
    specific: { count: specificCount, meanScore: safeDiv(specificSum, specificCount) },
  };
}

// =============================================================================
// Graded relevance (LLM-as-judge) — Phase 1 headline metric
// =============================================================================
// The component-level metrics above are a coarse, structural sanity layer: they
// only ask "did a chunk from the right component show up." They cannot see
// whether the *right chunk* — the one that actually answers a developer — ranked
// highly. These functions consume per-rank graded relevance labels (typically
// produced by an LLM judge, see judge.ts) and turn them into nDCG / graded
// precision, the honest headline the plan calls for.
//
// Grade scale (convention; the judge must emit these):
//   0 = irrelevant, 1 = partially relevant, 2 = directly answers the query.
// These functions are PURE: they take a number[] of grades in rank order and
// never call an LLM, so they are fully unit-testable.
// =============================================================================

/** Highest grade on the scale; used to normalize gains. */
export const MAX_RELEVANCE = 2;

/**
 * Discounted Cumulative Gain over the top-k grades (in rank order).
 * Uses the standard exponential gain (2^rel - 1) with a log2 positional
 * discount, so a "2" at rank 1 is worth far more than a "2" at rank 5.
 */
export function dcgAtK(grades: number[], k: number): number {
  const topK = grades.slice(0, k);
  return topK.reduce((sum, rel, index) => {
    const gain = Math.pow(2, rel) - 1;
    const discount = Math.log2(index + 2); // rank i (0-based) -> log2(i+2)
    return sum + gain / discount;
  }, 0);
}

/**
 * Normalized DCG over the top-k grades. Returns null when the ideal DCG is 0
 * (i.e. the judge found nothing even partially relevant for this query) so the
 * caller can render "n/a" instead of dividing by zero. A null nDCG means "no
 * relevant chunk existed to rank", which is itself a retrieval finding.
 */
export function ndcgAtK(grades: number[], k: number): number | null {
  const dcg = dcgAtK(grades, k);
  const ideal = [...grades].sort((a, b) => b - a);
  const idcg = dcgAtK(ideal, k);
  if (idcg === 0) return null;
  return dcg / idcg;
}

/**
 * Fraction of the top-k that clears a relevance threshold (default: grade >= 1,
 * i.e. at least partially relevant). Denominator is k, not results-returned,
 * so under-retrieval is correctly penalized — same philosophy as precisionAtK.
 */
export function gradedPrecisionAtK(grades: number[], k: number, threshold = 1): number {
  if (k <= 0) return 0;
  const relevant = grades.slice(0, k).filter((rel) => rel >= threshold).length;
  return relevant / k;
}

/** A single query graded by the LLM judge. */
export interface GradedQuery {
  id: string;
  category: string;
  /** Relevance grade per result, in rank order (top-k). */
  grades: number[];
  /** nDCG@k; null when no relevant chunk was found (idcg === 0). */
  ndcg: number | null;
  /** Fraction of top-k with grade >= 1. */
  gradedPrecision: number;
  /** Count of directly-relevant (grade === 2) results in top-k. */
  directHits: number;
}

/** Grade one query from its per-rank relevance labels. */
export function gradeGradedQuery(
  id: string,
  category: string,
  grades: number[],
  k: number
): GradedQuery {
  return {
    id,
    category,
    grades: grades.slice(0, k),
    ndcg: ndcgAtK(grades, k),
    gradedPrecision: gradedPrecisionAtK(grades, k),
    directHits: grades.slice(0, k).filter((rel) => rel >= MAX_RELEVANCE).length,
  };
}

export interface GradedAggregate {
  count: number;
  /**
   * Mean nDCG across queries that had at least one relevant chunk (null nDCGs
   * are excluded from the mean and reported separately as `noRelevantQueries`).
   * null if no query had any relevant chunk.
   */
  meanNdcg: number | null;
  /** Mean graded precision@k across all queries. */
  meanGradedPrecision: number | null;
  /** Queries the judge found NO relevant chunk for (nDCG was null). */
  noRelevantQueries: number;
}

export function aggregateGraded(graded: GradedQuery[]): GradedAggregate {
  const count = graded.length;
  const withNdcg = graded.filter((g) => g.ndcg !== null);
  const ndcgSum = withNdcg.reduce((sum, g) => sum + (g.ndcg as number), 0);
  const precSum = graded.reduce((sum, g) => sum + g.gradedPrecision, 0);

  return {
    count,
    meanNdcg: safeDiv(ndcgSum, withNdcg.length),
    meanGradedPrecision: safeDiv(precSum, count),
    noRelevantQueries: count - withNdcg.length,
  };
}

/** Aggregate graded queries grouped by category (preserves first-seen order). */
export function aggregateGradedByCategory(
  graded: GradedQuery[]
): Record<string, GradedAggregate> {
  const groups = new Map<string, GradedQuery[]>();
  for (const g of graded) {
    const bucket = groups.get(g.category) ?? [];
    bucket.push(g);
    groups.set(g.category, bucket);
  }
  const out: Record<string, GradedAggregate> = {};
  for (const [category, bucket] of groups) {
    out[category] = aggregateGraded(bucket);
  }
  return out;
}
