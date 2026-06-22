// =============================================================================
// Retrieval Evaluation - Metrics Tests
// =============================================================================
// Covers the documented engineering pitfalls: missing payloads (no throw),
// zero-result queries (real failure, not n/a), empty categories (n/a via
// safeDiv), and tolerant component-name matching.
//
// Run: npm test -- metrics.test.ts
// =============================================================================

import { describe, it, expect } from '@jest/globals';
import {
  normalizeComponentName,
  safeDiv,
  getComponentName,
  getChunkType,
  getIntent,
  gradeQuery,
  aggregate,
  aggregateByCategory,
  scoreByIntent,
  dcgAtK,
  ndcgAtK,
  gradedPrecisionAtK,
  gradeGradedQuery,
  aggregateGraded,
  aggregateGradedByCategory,
  type GoldenCase,
  type GradeableResult,
} from '../metrics.js';

function result(
  rank: number,
  score: number,
  payload: GradeableResult['payload']
): GradeableResult {
  return { rank, score, payload };
}

describe('normalizeComponentName', () => {
  it('is tolerant to case, spaces, and hyphens', () => {
    expect(normalizeComponentName('Icon Button')).toBe('icon button');
    expect(normalizeComponentName('icon-button')).toBe('icon button');
    expect(normalizeComponentName('  Icon   Button ')).toBe('icon button');
  });

  it('does NOT split camelCase words (AbsoluteCenter stays one token)', () => {
    expect(normalizeComponentName('AbsoluteCenter')).toBe('absolutecenter');
    expect(normalizeComponentName('AbsoluteCenter')).not.toBe(
      normalizeComponentName('Absolute Center')
    );
  });
});

describe('safeDiv', () => {
  it('returns null for a zero denominator (rendered "n/a")', () => {
    expect(safeDiv(0, 0)).toBeNull();
    expect(safeDiv(5, 0)).toBeNull();
  });

  it('divides normally otherwise', () => {
    expect(safeDiv(3, 4)).toBe(0.75);
  });
});

describe('safe payload accessors', () => {
  it('return undefined for missing/null/non-string fields, never throw', () => {
    expect(getComponentName(null)).toBeUndefined();
    expect(getComponentName(undefined)).toBeUndefined();
    expect(getComponentName({})).toBeUndefined();
    expect(getComponentName({ componentName: 42 })).toBeUndefined();
    expect(getComponentName({ componentName: 'Button' })).toBe('Button');
    expect(getChunkType({ chunkType: 'code-example' })).toBe('code-example');
  });

  it('getIntent parses fullChunk defensively', () => {
    expect(getIntent({ fullChunk: 'not json' })).toBeUndefined();
    expect(getIntent({ fullChunk: JSON.stringify({ example: { intent: 'generic' } }) })).toBe(
      'generic'
    );
    expect(getIntent({})).toBeUndefined();
  });
});

describe('gradeQuery', () => {
  const baseCase: GoldenCase = {
    id: 'q1',
    query: 'button color',
    expectedComponents: ['Button'],
    expectedChunkType: 'prop-reference',
    category: 'prop-lookup',
  };

  it('scores a top-rank component hit (MRR = 1)', () => {
    const results = [
      result(1, 0.6, { componentName: 'Button', chunkType: 'prop-reference' }),
      result(2, 0.5, { componentName: 'Box', chunkType: 'code-example' }),
    ];
    const grade = gradeQuery(baseCase, results, 5);

    expect(grade.componentHit).toBe(true);
    expect(grade.firstHitRank).toBe(1);
    expect(grade.reciprocalRank).toBe(1);
    expect(grade.precisionAtK).toBe(0.5); // 1 of 2 considered
    expect(grade.firstHitChunkType).toBe('prop-reference');
    expect(grade.expectedChunkTypeHit).toBe(true);
    expect(grade.malformedPayloads).toBe(0);
  });

  it('reciprocal rank reflects a lower-ranked first hit', () => {
    const results = [
      result(1, 0.6, { componentName: 'Color Mode', chunkType: 'code-example' }),
      result(2, 0.5, { componentName: 'Button', chunkType: 'code-example' }),
    ];
    const grade = gradeQuery(baseCase, results, 5);

    expect(grade.firstHitRank).toBe(2);
    expect(grade.reciprocalRank).toBe(0.5);
    // first hit is code-example, expected prop-reference -> diagnostic miss
    expect(grade.expectedChunkTypeHit).toBe(false);
  });

  it('matches component names tolerantly (Icon Button vs icon-button)', () => {
    const iconCase: GoldenCase = {
      id: 'q2',
      query: 'icon button',
      expectedComponents: ['Icon Button'],
      category: 'cross-component',
    };
    const results = [result(1, 0.7, { componentName: 'icon-button', chunkType: 'code-example' })];
    const grade = gradeQuery(iconCase, results, 5);

    expect(grade.componentHit).toBe(true);
    expect(grade.expectedChunkTypeHit).toBeNull(); // no expectedChunkType set
  });

  it('treats a zero-result query as a real failure (precision 0, not n/a)', () => {
    const grade = gradeQuery(baseCase, [], 5);

    expect(grade.componentHit).toBe(false);
    expect(grade.firstHitRank).toBeNull();
    expect(grade.reciprocalRank).toBe(0);
    expect(grade.precisionAtK).toBe(0);
    expect(grade.malformedPayloads).toBe(0);
  });

  it('counts malformed payloads and does not throw on missing fields', () => {
    const results = [
      result(1, 0.6, null),
      result(2, 0.5, { score: 1 }), // no componentName / chunkType
      result(3, 0.4, { componentName: 'Button', chunkType: 'prop-reference' }),
    ];
    const grade = gradeQuery(baseCase, results, 5);

    expect(grade.malformedPayloads).toBe(2);
    expect(grade.componentHit).toBe(true);
    expect(grade.firstHitRank).toBe(3);
  });
});

describe('aggregate', () => {
  const caseA: GoldenCase = { id: 'a', query: 'x', expectedComponents: ['Button'], category: 'how-to' };

  it('returns null metrics for an empty set (n/a, no NaN)', () => {
    const agg = aggregate([]);
    expect(agg.count).toBe(0);
    expect(agg.hitRate).toBeNull();
    expect(agg.mrr).toBeNull();
    expect(agg.meanPrecision).toBeNull();
  });

  it('averages across graded queries', () => {
    const hit = gradeQuery(caseA, [result(1, 0.9, { componentName: 'Button', chunkType: 'code-example' })], 5);
    const miss = gradeQuery(caseA, [result(1, 0.3, { componentName: 'Box', chunkType: 'code-example' })], 5);
    const agg = aggregate([hit, miss]);

    expect(agg.count).toBe(2);
    expect(agg.hitRate).toBe(0.5);
    expect(agg.mrr).toBe(0.5); // (1 + 0) / 2
  });
});

describe('aggregateByCategory', () => {
  it('groups grades by category', () => {
    const a: GoldenCase = { id: 'a', query: 'x', expectedComponents: ['Button'], category: 'how-to' };
    const b: GoldenCase = { id: 'b', query: 'y', expectedComponents: ['Field'], category: 'what-is' };

    const gA = gradeQuery(a, [result(1, 0.8, { componentName: 'Button', chunkType: 'code-example' })], 5);
    const gB = gradeQuery(b, [result(1, 0.4, { componentName: 'Box', chunkType: 'code-example' })], 5);

    const byCat = aggregateByCategory([gA, gB]);
    expect(byCat['how-to'].hitRate).toBe(1);
    expect(byCat['what-is'].hitRate).toBe(0);
  });
});

describe('scoreByIntent', () => {
  it('splits matched-component scores by generic vs specific intent', () => {
    const cases: GoldenCase[] = [
      { id: 'a', query: 'x', expectedComponents: ['Button'], category: 'how-to' },
    ];
    const resultsByCase: GradeableResult[][] = [
      [
        result(1, 0.6, {
          componentName: 'Button',
          chunkType: 'code-example',
          fullChunk: JSON.stringify({ example: { intent: 'generic' } }),
        }),
        result(2, 0.8, {
          componentName: 'Button',
          chunkType: 'code-example',
          fullChunk: JSON.stringify({ example: { intent: 'sizing' } }),
        }),
        // non-matching component is ignored
        result(3, 0.9, {
          componentName: 'Box',
          chunkType: 'code-example',
          fullChunk: JSON.stringify({ example: { intent: 'sizing' } }),
        }),
      ],
    ];

    const split = scoreByIntent(cases, resultsByCase, 5);
    expect(split.generic).toEqual({ count: 1, meanScore: 0.6 });
    expect(split.specific).toEqual({ count: 1, meanScore: 0.8 });
  });
});

// ---------------------------------------------------------------------------
// Graded relevance (LLM-as-judge headline metric)
// ---------------------------------------------------------------------------

describe('dcgAtK', () => {
  it('applies exponential gain with a log2 positional discount', () => {
    // grades [2,1,0]: 3/log2(2) + 1/log2(3) + 0 = 3 + 0.63093 = 3.63093
    expect(dcgAtK([2, 1, 0], 3)).toBeCloseTo(3 + 1 / Math.log2(3), 6);
  });

  it('honors k by ignoring results past the cutoff', () => {
    expect(dcgAtK([2, 2, 2], 1)).toBe(3); // only rank 1 counts
  });

  it('is 0 when nothing is relevant', () => {
    expect(dcgAtK([0, 0, 0], 3)).toBe(0);
  });
});

describe('ndcgAtK', () => {
  it('is 1.0 when results are already in ideal order', () => {
    expect(ndcgAtK([2, 1, 0], 3)).toBe(1);
  });

  it('drops below 1 when relevant results are ranked low', () => {
    // [0,1,2] vs ideal [2,1,0]
    const expected = (1 / Math.log2(3) + 3 / Math.log2(4)) / (3 + 1 / Math.log2(3));
    expect(ndcgAtK([0, 1, 2], 3)).toBeCloseTo(expected, 6);
    expect(ndcgAtK([0, 1, 2], 3)!).toBeLessThan(1);
  });

  it('returns null (not NaN) when no result is relevant', () => {
    expect(ndcgAtK([0, 0, 0], 5)).toBeNull();
    expect(ndcgAtK([], 5)).toBeNull();
  });
});

describe('gradedPrecisionAtK', () => {
  it('counts results clearing the threshold over k (penalizes under-retrieval)', () => {
    expect(gradedPrecisionAtK([2, 0, 1], 5)).toBe(2 / 5); // two >= 1, denominator k=5
  });

  it('respects a custom threshold (e.g. only direct hits)', () => {
    expect(gradedPrecisionAtK([2, 1, 1], 3, 2)).toBeCloseTo(1 / 3, 6);
  });
});

describe('gradeGradedQuery', () => {
  it('packages nDCG, graded precision, and direct hits for one query', () => {
    const g = gradeGradedQuery('q', 'how-to', [2, 0, 1], 5);
    expect(g.id).toBe('q');
    expect(g.grades).toEqual([2, 0, 1]);
    expect(g.ndcg).not.toBeNull();
    expect(g.gradedPrecision).toBe(2 / 5);
    expect(g.directHits).toBe(1);
  });

  it('reports null nDCG for a query with no relevant chunk', () => {
    const g = gradeGradedQuery('q', 'what-is', [0, 0], 5);
    expect(g.ndcg).toBeNull();
    expect(g.directHits).toBe(0);
  });
});

describe('aggregateGraded', () => {
  it('excludes null-nDCG queries from the mean and counts them separately', () => {
    const good = gradeGradedQuery('a', 'how-to', [2, 1], 5); // nDCG 1
    const none = gradeGradedQuery('b', 'how-to', [0, 0], 5); // nDCG null
    const agg = aggregateGraded([good, none]);

    expect(agg.count).toBe(2);
    expect(agg.meanNdcg).toBe(1); // averaged over the one query that had relevance
    expect(agg.noRelevantQueries).toBe(1);
    expect(agg.meanGradedPrecision).toBeCloseTo((2 / 5 + 0) / 2, 6);
  });

  it('returns null mean nDCG when no query had any relevant chunk', () => {
    const agg = aggregateGraded([gradeGradedQuery('a', 'x', [0], 5)]);
    expect(agg.meanNdcg).toBeNull();
    expect(agg.noRelevantQueries).toBe(1);
  });
});

describe('aggregateGradedByCategory', () => {
  it('groups graded queries by category', () => {
    const a = gradeGradedQuery('a', 'how-to', [2], 5);
    const b = gradeGradedQuery('b', 'what-is', [0], 5);
    const byCat = aggregateGradedByCategory([a, b]);
    expect(byCat['how-to'].meanNdcg).toBe(1);
    expect(byCat['what-is'].meanNdcg).toBeNull();
  });
});
