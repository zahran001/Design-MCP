// =============================================================================
// Explanation Generator Tests
// =============================================================================

import { describe, it, expect } from '@jest/globals';
import { generateContent, type GeneratedContent } from '../explanationGenerator.js';
import type {
  SizingTemplateData,
  VariantsTemplateData,
  StatesTemplateData,
  CompositionTemplateData,
  InteractionTemplateData,
  GenericTemplateData
} from '../templateDataExtractor.js';

describe('generateContent', () => {
  describe('Sizing Templates', () => {
    it('should generate natural language for sizing with layout', () => {
      const data: SizingTemplateData = {
        component: 'Button',
        sizes: ['xs', 'sm', 'md', 'lg', 'xl'],
        sizeCount: 5,
        layoutComponent: 'HStack',
        layoutProps: { gap: '6', wrap: 'wrap' }
      };

      const result = generateContent({ intent: 'sizing', data });

      // Check explanation
      expect(result.explanation).toContain('Button');
      expect(result.explanation).toContain('size prop');
      expect(result.explanation).toContain('5 available size options');
      expect(result.explanation).toContain('HStack');

      // Check demonstrates
      expect(result.demonstrates).toContain('Using the size prop to control Button dimensions');
      expect(result.demonstrates.some(d => d.includes('xs'))).toBe(true);
      expect(result.demonstrates.some(d => d.includes('HStack'))).toBe(true);

      // Check keyPoints
      expect(result.keyPoints.some(k => k.includes('size prop accepts'))).toBe(true);
      expect(result.keyPoints.some(k => k.includes('gap'))).toBe(true);
    });

    it('should handle sizing without layout component', () => {
      const data: SizingTemplateData = {
        component: 'Button',
        sizes: ['sm', 'lg'],
        sizeCount: 2
      };

      const result = generateContent({ intent: 'sizing', data });

      expect(result.explanation).toContain('2 available size options');
      expect(result.explanation).not.toContain('HStack');
      expect(result.demonstrates.length).toBeGreaterThan(0);
      expect(result.keyPoints.length).toBeGreaterThan(0);
    });

    it('should handle sizing with no sizes extracted', () => {
      const data: SizingTemplateData = {
        component: 'Input',
        sizes: [],
        sizeCount: 0
      };

      const result = generateContent({ intent: 'sizing', data });

      expect(result.explanation).toContain('Input');
      expect(result.demonstrates.length).toBeGreaterThan(0);
      expect(result.keyPoints.length).toBeGreaterThan(0);
    });
  });

  describe('Variants Templates', () => {
    it('should generate natural language for variants', () => {
      const data: VariantsTemplateData = {
        component: 'Button',
        variants: ['solid', 'outline', 'ghost', 'subtle'],
        variantCount: 4,
        otherProps: {
          colorPalette: ['blue', 'red'],
          size: ['md']
        }
      };

      const result = generateContent({ intent: 'variants', data });

      // Check explanation
      expect(result.explanation).toContain('Button');
      expect(result.explanation).toContain('variant prop');
      expect(result.explanation).toContain('4 variants');
      expect(result.explanation).toContain('visual appearance');

      // Check demonstrates
      expect(result.demonstrates.some(d => d.includes('variant prop'))).toBe(true);
      expect(result.demonstrates.some(d => d.includes('solid'))).toBe(true);

      // Check keyPoints
      expect(result.keyPoints.some(k => k.includes('variant prop accepts'))).toBe(true);
    });

    it('should mention color palette integration', () => {
      const data: VariantsTemplateData = {
        component: 'Button',
        variants: ['solid', 'outline'],
        variantCount: 2,
        otherProps: { colorPalette: ['blue', 'green', 'red'] }
      };

      const result = generateContent({ intent: 'variants', data });

      expect(result.demonstrates.some(d => d.includes('colorPalette'))).toBe(true);
    });
  });

  describe('States Templates', () => {
    it('should generate natural language for states', () => {
      const data: StatesTemplateData = {
        component: 'Button',
        states: ['loading', 'disabled'],
        stateDescriptions: {
          loading: 'loading state',
          disabled: 'disabled state'
        },
        demonstrations: [
          'How to show loading state using the loading prop',
          'How to show disabled state using the disabled prop'
        ]
      };

      const result = generateContent({ intent: 'states', data });

      // Check explanation
      expect(result.explanation).toContain('Button');
      expect(result.explanation).toContain('loading state');
      expect(result.explanation).toContain('disabled state');

      // Check demonstrates
      expect(result.demonstrates).toContain('How to show loading state using the loading prop');
      expect(result.demonstrates).toContain('How to show disabled state using the disabled prop');

      // Check keyPoints
      expect(result.keyPoints.some(k => k.includes('loading prop'))).toBe(true);
      expect(result.keyPoints.some(k => k.includes('disabled prop'))).toBe(true);
    });

    it('should handle single state', () => {
      const data: StatesTemplateData = {
        component: 'Input',
        states: ['isInvalid'],
        stateDescriptions: { isInvalid: 'invalid state' },
        demonstrations: ['How to show invalid state using the isInvalid prop']
      };

      const result = generateContent({ intent: 'states', data });

      expect(result.explanation).toContain('Input');
      expect(result.explanation).toContain('invalid state');
      expect(result.keyPoints.some(k => k.includes('isInvalid'))).toBe(true);
    });
  });

  describe('Composition Templates', () => {
    it('should generate content for subcomponent composition', () => {
      const data: CompositionTemplateData = {
        primaryComponent: 'Checkbox',
        subComponents: ['Checkbox.Root', 'Checkbox.Control', 'Checkbox.Label', 'Checkbox.Indicator'],
        componentCount: 4,
        pattern: 'subcomponent composition',
        imports: ['Checkbox']
      };

      const result = generateContent({ intent: 'composition', data });

      // Check explanation
      expect(result.explanation).toContain('Checkbox');
      expect(result.explanation).toContain('composition pattern');
      expect(result.explanation).toContain('subcomponent');

      // Check demonstrates
      expect(result.demonstrates.some(d => d.includes('subcomponents'))).toBe(true);
      expect(result.demonstrates.some(d => d.includes('Structure'))).toBe(true);

      // Check keyPoints
      expect(result.keyPoints.some(k => k.includes('subcomponent pattern'))).toBe(true);
    });

    it('should generate content for multi-component composition', () => {
      const data: CompositionTemplateData = {
        primaryComponent: 'Form',
        subComponents: ['Input', 'Button', 'HStack'],
        componentCount: 3,
        pattern: 'multi-component',
        imports: ['Input', 'Button', 'HStack']
      };

      const result = generateContent({ intent: 'composition', data });

      expect(result.explanation).toContain('multiple components');
      expect(result.demonstrates.some(d => d.includes('Composing multiple components'))).toBe(true);
      expect(result.keyPoints.some(k => k.includes('composition promotes reusability'))).toBe(true);
    });

    it('should handle many subcomponents gracefully', () => {
      const data: CompositionTemplateData = {
        primaryComponent: 'Menu',
        subComponents: ['Menu.Root', 'Menu.Trigger', 'Menu.Content', 'Menu.Item', 'Menu.Separator'],
        componentCount: 5,
        pattern: 'subcomponent composition',
        imports: ['Menu']
      };

      const result = generateContent({ intent: 'composition', data });

      // Should show first 3 components + ellipsis
      expect(result.demonstrates.some(d => d.includes('...'))).toBe(true);
    });
  });

  describe('Interaction Templates', () => {
    it('should generate content for click interaction with state', () => {
      const data: InteractionTemplateData = {
        component: 'Button',
        hooks: ['useState'],
        eventHandlers: ['onClick'],
        stateVariables: ['state'],
        interactionType: 'click handling'
      };

      const result = generateContent({ intent: 'interaction', data });

      // Check explanation
      expect(result.explanation).toContain('Button');
      expect(result.explanation).toContain('click handling');
      expect(result.explanation).toContain('useState');

      // Check demonstrates
      expect(result.demonstrates.some(d => d.includes('onClick'))).toBe(true);
      expect(result.demonstrates.some(d => d.includes('useState'))).toBe(true);

      // Check keyPoints
      expect(result.keyPoints.some(k => k.includes('onClick'))).toBe(true);
      expect(result.keyPoints.some(k => k.includes('useState'))).toBe(true);
    });

    it('should generate content for form submission', () => {
      const data: InteractionTemplateData = {
        component: 'Button',
        hooks: [],
        eventHandlers: ['onSubmit'],
        stateVariables: [],
        interactionType: 'form submission'
      };

      const result = generateContent({ intent: 'interaction', data });

      expect(result.explanation).toContain('form submission');
      expect(result.demonstrates.some(d => d.includes('onSubmit'))).toBe(true);
    });

    it('should handle multiple hooks', () => {
      const data: InteractionTemplateData = {
        component: 'Input',
        hooks: ['useState', 'useEffect'],
        eventHandlers: ['onChange'],
        stateVariables: [],
        interactionType: 'change handling'
      };

      const result = generateContent({ intent: 'interaction', data });

      expect(result.demonstrates.some(d => d.includes('useState'))).toBe(true);
      expect(result.demonstrates.some(d => d.includes('useEffect'))).toBe(true);
    });
  });

  describe('Generic Templates', () => {
    it('should generate content for simple examples', () => {
      const data: GenericTemplateData = {
        component: 'Button',
        props: { variant: ['primary'], size: ['md'] },
        components: ['Button'],
        hasInteractivity: false,
        hasState: false
      };

      const result = generateContent({ intent: 'generic', data });

      // Check explanation
      expect(result.explanation).toContain('Button');
      expect(result.explanation).toContain('2 props');

      // Check demonstrates
      expect(result.demonstrates).toContain('Basic usage of the Button component');
      expect(result.demonstrates.some(d => d.includes('Configuring Button with props'))).toBe(true);

      // Check keyPoints
      expect(result.keyPoints.some(k => k.includes('variant'))).toBe(true);
    });

    it('should mention interactivity when present', () => {
      const data: GenericTemplateData = {
        component: 'Button',
        props: {},
        components: ['Button'],
        hasInteractivity: true,
        hasState: true
      };

      const result = generateContent({ intent: 'generic', data });

      expect(result.demonstrates.some(d => d.includes('Interactive behavior'))).toBe(true);
      expect(result.keyPoints.some(k => k.includes('React state'))).toBe(true);
    });

    it('should handle examples with no props', () => {
      const data: GenericTemplateData = {
        component: 'Spinner',
        props: {},
        components: ['Spinner'],
        hasInteractivity: false,
        hasState: false
      };

      const result = generateContent({ intent: 'generic', data });

      expect(result.explanation).toContain('Spinner');
      expect(result.demonstrates.length).toBeGreaterThan(0);
      expect(result.keyPoints.length).toBeGreaterThan(0);
    });
  });
});

describe('GeneratedContent Structure', () => {
  it('should always return required fields', () => {
    const testCases = [
      { intent: 'sizing' as const, data: { component: 'Button', sizes: [], sizeCount: 0 } },
      { intent: 'variants' as const, data: { component: 'Button', variants: [], variantCount: 0 } },
      { intent: 'states' as const, data: { component: 'Button', states: [], stateDescriptions: {}, demonstrations: [] } },
      { intent: 'composition' as const, data: { primaryComponent: 'Button', subComponents: [], componentCount: 1, pattern: 'multi-component' as const, imports: [] } },
      { intent: 'interaction' as const, data: { component: 'Button', hooks: [], eventHandlers: [], stateVariables: [], interactionType: 'user interaction' } },
      { intent: 'generic' as const, data: { component: 'Button', props: {}, components: ['Button'], hasInteractivity: false, hasState: false } }
    ];

    testCases.forEach(testCase => {
      const result = generateContent(testCase);

      expect(result).toHaveProperty('explanation');
      expect(result).toHaveProperty('demonstrates');
      expect(result).toHaveProperty('keyPoints');

      expect(typeof result.explanation).toBe('string');
      expect(result.explanation.length).toBeGreaterThan(0);
      expect(Array.isArray(result.demonstrates)).toBe(true);
      expect(result.demonstrates.length).toBeGreaterThan(0);
      expect(Array.isArray(result.keyPoints)).toBe(true);
      expect(result.keyPoints.length).toBeGreaterThan(0);
    });
  });

  it('should generate natural language (not code-like)', () => {
    const data: SizingTemplateData = {
      component: 'Button',
      sizes: ['xs', 'sm', 'md'],
      sizeCount: 3,
      layoutComponent: 'HStack',
      layoutProps: { gap: '4' }
    };

    const result = generateContent({ intent: 'sizing', data });

    // Check explanation is natural language
    expect(result.explanation).toMatch(/demonstrates|showing|provides|enables/i);
    expect(result.explanation.length).toBeGreaterThan(50); // Reasonable length

    // Check demonstrates are descriptive
    result.demonstrates.forEach(item => {
      expect(item.length).toBeGreaterThan(10);
      expect(item).toMatch(/[A-Z]/); // Starts with capital
    });

    // Check keyPoints are informative
    result.keyPoints.forEach(item => {
      expect(item.length).toBeGreaterThan(10);
    });
  });
});
