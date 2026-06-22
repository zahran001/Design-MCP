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
