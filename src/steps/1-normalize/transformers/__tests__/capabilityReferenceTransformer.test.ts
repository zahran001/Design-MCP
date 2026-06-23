import { describe, it, expect } from '@jest/globals';
import {
  transformCapabilities,
  isCapabilityHeading,
} from '../capabilityReferenceTransformer.js';
import type { ComponentDoc } from '../../../../schemas/RAGResultSchema.js';

function doc(overrides: Partial<ComponentDoc> = {}): ComponentDoc {
  return {
    componentName: 'Button',
    sourceUrl: 'https://chakra-ui.com/docs/components/button',
    description: 'Used to trigger an action or event',
    codeExamples: [
      { code: 'x', section: 'Button' }, // intro
      { code: 'x', section: 'Sizes', sectionDescription: 'Use the size prop to change the size of the button.' },
      { code: 'x', section: 'Variants', sectionDescription: 'Use the variant prop to change the visual style.' },
      { code: 'x', section: 'Disabled Link', sectionDescription: 'When using the disabled prop with a link, prevent default.' },
      { code: 'x', section: 'Ref', sectionDescription: 'Access the underlying element reference.' },
    ],
    props: [
      { name: 'size', type: "'xs' | 'sm' | 'md' | 'lg' | 'xl'", defaultValue: "'md'" },
      { name: 'variant', type: "'solid' | 'outline'" },
    ],
    ...overrides,
  };
}

describe('isCapabilityHeading', () => {
  it('recognizes capability headings (incl. multi-word / unevenly named)', () => {
    expect(isCapabilityHeading('Sizes')).toBe(true);
    expect(isCapabilityHeading('Responsive Size')).toBe(true);
    expect(isCapabilityHeading('Spinner Placement')).toBe(true);
    expect(isCapabilityHeading('Disabled Link')).toBe(false);
    expect(isCapabilityHeading('Ref')).toBe(false);
  });
});

describe('transformCapabilities', () => {
  it('emits one chunk per capability section using REAL prose, with options from the mapped prop union', () => {
    const { chunks } = transformCapabilities(doc());
    const sizes = chunks.find((c) => c.capability.name === 'Sizes');
    expect(sizes).toBeDefined();
    expect(sizes!.metadata.chunkType).toBe('capability-reference');
    expect(sizes!.content.description).toBe('Use the size prop to change the size of the button.');
    expect(sizes!.content.options.map((o) => o.value)).toEqual(['xs', 'sm', 'md', 'lg', 'xl']);
    expect(sizes!.content.options.every((o) => o.description === '')).toBe(true); // honest-minimal
    expect(sizes!.reference.propNames).toEqual(['size']);
    expect(sizes!.reference.defaultValue).toBe("'md'");
  });

  it('excludes pure-demo sections (Disabled Link, Ref)', () => {
    const { chunks } = transformCapabilities(doc());
    const names = chunks.map((c) => c.capability.name);
    expect(names).toContain('Sizes');
    expect(names).toContain('Variants');
    expect(names).not.toContain('Disabled Link');
    expect(names).not.toContain('Ref');
  });

  it('handles the States capability by aggregating boolean state props', () => {
    const { chunks } = transformCapabilities(
      doc({
        componentName: 'Checkbox',
        codeExamples: [
          { code: 'x', section: 'States', sectionDescription: 'Pass the disabled or invalid prop to change the state.' },
        ],
        props: [
          { name: 'disabled', type: 'boolean' },
          { name: 'invalid', type: 'boolean' },
          { name: 'size', type: "'sm' | 'md'" },
        ],
      })
    );
    const states = chunks.find((c) => c.capability.name === 'States');
    expect(states).toBeDefined();
    expect(states!.content.options.map((o) => o.value).sort()).toEqual(['disabled', 'invalid']);
  });

  it('emits a gate-skip warning for an unevenly named, prose-bearing section (observability)', () => {
    const { chunks, warnings } = transformCapabilities(
      doc({
        codeExamples: [
          { code: 'x', section: 'Dimensions', sectionDescription: 'Control how large the button renders on screen.' },
        ],
        props: [],
      })
    );
    expect(chunks).toHaveLength(0); // gate is conservative (precision)
    expect(warnings.some((w) => w.type === 'gate-skip' && w.message.includes('Dimensions'))).toBe(true);
  });

  it('matches composite props ("Root.size") so options populate for composite components', () => {
    const { chunks } = transformCapabilities(
      doc({
        componentName: 'Checkbox',
        codeExamples: [
          { code: 'x', section: 'Sizes', sectionDescription: 'Pass the size prop to change the size.' },
        ],
        props: [{ name: 'Root.size', type: "'xs' | 'sm' | 'md' | 'lg'" }],
      })
    );
    const sizes = chunks.find((c) => c.capability.name === 'Sizes');
    expect(sizes!.content.options.map((o) => o.value)).toEqual(['xs', 'sm', 'md', 'lg']);
    expect(sizes!.reference.propNames).toEqual(['Root.size']);
  });

  it('aggregates composite state props by base name for the States capability', () => {
    const { chunks } = transformCapabilities(
      doc({
        componentName: 'Checkbox',
        codeExamples: [
          { code: 'x', section: 'States', sectionDescription: 'Use the disabled or invalid prop.' },
        ],
        props: [
          { name: 'Root.disabled', type: 'boolean' },
          { name: 'Root.invalid', type: 'boolean' },
        ],
      })
    );
    const states = chunks.find((c) => c.capability.name === 'States');
    expect(states!.content.options.map((o) => o.value).sort()).toEqual(['disabled', 'invalid']);
  });

  it('excludes recipe-customization meta sections even when their heading contains a capability word', () => {
    const { chunks } = transformCapabilities(
      doc({
        codeExamples: [
          { code: 'x', section: 'Adding a new variant', sectionDescription: 'Use defineRecipe to add a variant.' },
          { code: 'x', section: 'Changing the default size', sectionDescription: 'Use defaultVariants to change size.' },
        ],
      })
    );
    expect(chunks).toHaveLength(0);
  });

  it('does not warn for prose-less skipped sections', () => {
    const { warnings } = transformCapabilities(
      doc({ codeExamples: [{ code: 'x', section: 'Mystery', sectionDescription: 'hi' }], props: [] })
    );
    expect(warnings).toHaveLength(0);
  });
});
