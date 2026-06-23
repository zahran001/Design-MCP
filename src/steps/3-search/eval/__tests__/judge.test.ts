// =============================================================================
// Retrieval Evaluation - Judge chunk-text builder tests
// =============================================================================
// buildJudgeChunkText is the only PURE part of the judge (no network), so it is
// the part worth unit-testing: it must render whatever payload shape Qdrant
// returns without throwing, and must never leak an empty grade target.
// =============================================================================

import { describe, it, expect } from '@jest/globals';
import { buildJudgeChunkText } from '../judge.js';

describe('buildJudgeChunkText', () => {
  it('renders a prop-reference chunk with prop fields', () => {
    const text = buildJudgeChunkText({
      componentName: 'Button',
      chunkType: 'prop-reference',
      propName: 'variant',
      propType: 'solid | outline | ghost',
      propDescription: 'Controls the visual style of the button.',
    });
    expect(text).toContain('Component: Button');
    expect(text).toContain('Prop: variant (solid | outline | ghost)');
    expect(text).toContain('Prop description: Controls the visual style');
  });

  it('renders a code-example chunk and truncates very long code', () => {
    const longCode = 'x'.repeat(5000);
    const text = buildJudgeChunkText({
      componentName: 'Stack',
      chunkType: 'code-example',
      explanation: 'Stacks children vertically.',
      demonstrates: ['spacing', 'direction'],
      code: longCode,
    });
    expect(text).toContain('Explanation: Stacks children vertically.');
    expect(text).toContain('Demonstrates: spacing, direction');
    expect(text).toContain('... (truncated)');
    expect(text.length).toBeLessThan(longCode.length);
  });

  it('never throws on null / empty / non-string fields', () => {
    expect(() => buildJudgeChunkText(null)).not.toThrow();
    expect(() => buildJudgeChunkText(undefined)).not.toThrow();
    expect(buildJudgeChunkText({ componentName: 42, code: null })).toBe('(empty chunk)');
  });

  it('falls back to fullChunk when no friendly fields exist', () => {
    const text = buildJudgeChunkText({ fullChunk: '{"some":"raw chunk json"}' });
    expect(text).toContain('raw chunk json');
  });

  it('ignores blank strings (treats them as absent)', () => {
    expect(buildJudgeChunkText({ componentName: '   ' })).toBe('(empty chunk)');
  });

  it('renders capability-reference options from fullChunk (so the judge sees the enumeration)', () => {
    const text = buildJudgeChunkText({
      componentName: 'Button',
      chunkType: 'capability-reference',
      explanation: 'Use the size prop to change the size of the button.',
      fullChunk: JSON.stringify({
        capability: { name: 'Sizes' },
        content: {
          description: 'Use the size prop to change the size of the button.',
          options: [{ value: 'xs' }, { value: 'sm' }, { value: 'md' }, { value: 'lg' }, { value: 'xl' }],
        },
      }),
    });
    expect(text).toContain('Capability: Sizes');
    expect(text).toContain('Available options: xs, sm, md, lg, xl');
  });

  it('renders component-overview capabilities + pairings from fullChunk', () => {
    const text = buildJudgeChunkText({
      componentName: 'Button',
      chunkType: 'component-overview',
      explanation: 'Used to trigger an action or event',
      fullChunk: JSON.stringify({
        content: {
          description: 'Used to trigger an action or event',
          capabilities: ['Sizes', 'Variants'],
          commonPairings: ['ButtonGroup'],
        },
      }),
    });
    expect(text).toContain('Used to trigger an action or event');
    expect(text).toContain('Capabilities: Sizes, Variants');
    expect(text).toContain('Commonly used with: ButtonGroup');
  });
});
