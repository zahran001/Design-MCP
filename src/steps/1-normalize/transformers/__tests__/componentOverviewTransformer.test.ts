import { describe, it, expect } from '@jest/globals';
import {
  transformComponentOverview,
  extractCapabilities,
  detectSubcomponents,
} from '../componentOverviewTransformer.js';
import type { ComponentDoc } from '../../../../schemas/RAGResultSchema.js';

function doc(overrides: Partial<ComponentDoc> = {}): ComponentDoc {
  return {
    componentName: 'Button',
    sourceUrl: 'https://chakra-ui.com/docs/components/button',
    description: 'Used to trigger an action or event',
    codeExamples: [
      { code: '<Button>Button</Button>', section: 'Button' }, // intro/usage block
      { code: '<Button size="sm" />', section: 'Sizes', sectionDescription: 'Use the size prop...' },
      { code: '<Button variant="solid" />', section: 'Variants', sectionDescription: 'Use the variant prop...' },
      { code: '<Button asChild />', section: 'Disabled Link', sectionDescription: 'When using disabled...' },
    ],
    relatedComponents: ['ButtonGroup', 'Icon'],
    props: [{ name: 'size', type: "'sm' | 'md'" }, { name: 'variant', type: "'solid'" }],
    ...overrides,
  };
}

describe('extractCapabilities', () => {
  it('returns distinct real section headings, excluding the intro/Usage block', () => {
    const caps = extractCapabilities(doc());
    expect(caps).toContain('Sizes');
    expect(caps).toContain('Variants');
    expect(caps).toContain('Disabled Link'); // still a capability label for overview
    expect(caps).not.toContain('Button'); // intro block excluded
  });

  it('excludes recipe-meta sections', () => {
    const caps = extractCapabilities(
      doc({
        codeExamples: [
          { code: 'x', section: 'Sizes', sectionDescription: 'p' },
          { code: 'x', section: 'Adding a new variant', sectionDescription: 'p' },
          { code: 'x', section: 'Customization', sectionDescription: 'p' },
        ],
      })
    );
    expect(caps).toEqual(['Sizes']);
  });
});

describe('detectSubcomponents', () => {
  it('finds dot-notation subcomponents in example code', () => {
    const subs = detectSubcomponents(
      doc({
        componentName: 'Checkbox',
        codeExamples: [{ code: '<Checkbox.Root><Checkbox.Control/></Checkbox.Root>', section: 'Usage' }],
      })
    );
    expect(subs).toEqual(['Checkbox.Control', 'Checkbox.Root']);
  });

  it('returns [] and never throws on malformed/renamed-import code', () => {
    expect(detectSubcomponents(doc({ codeExamples: [{ code: 'const X = Y(;;;<<', section: 's' }] }))).toEqual([]);
    expect(detectSubcomponents(doc({ componentName: '', codeExamples: [] }))).toEqual([]);
  });
});

describe('transformComponentOverview', () => {
  it('builds an overview from real description + capabilities (honest-minimal)', () => {
    const { chunk, warnings } = transformComponentOverview(doc());
    expect(warnings).toHaveLength(0);
    expect(chunk).not.toBeNull();
    expect(chunk!.metadata.chunkType).toBe('component-overview');
    expect(chunk!.content.description).toBe('Used to trigger an action or event');
    expect(chunk!.content.useCases).toEqual([]); // never fabricated
    expect(chunk!.content.commonPairings).toEqual(['ButtonGroup', 'Icon']);
    expect(chunk!.quickReference.propCount).toBe(2);
    expect(chunk!.quickReference.exampleCount).toBe(4);
  });

  it('falls back to a factual capability restatement when description is blank (+ warning, not dropped)', () => {
    const { chunk, warnings } = transformComponentOverview(doc({ description: undefined }));
    expect(chunk).not.toBeNull();
    expect(chunk!.content.description).toContain('Button — supports');
    expect(chunk!.content.description).toContain('Sizes');
    expect(warnings.some((w) => w.type === 'data-quality')).toBe(true);
  });

  it('skips (null) with a warning only when there is no description AND no capabilities', () => {
    const { chunk, warnings } = transformComponentOverview(
      doc({ description: '', codeExamples: [], relatedComponents: [] })
    );
    expect(chunk).toBeNull();
    expect(warnings.some((w) => w.type === 'data-quality')).toBe(true);
  });
});
