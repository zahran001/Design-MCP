// =============================================================================
// Template Data Extractor Tests
// =============================================================================

import { describe, it, expect } from '@jest/globals';
import { analyzeCode } from '../../inference/codeAnalyzer.js';
import {
  extractTemplateData,
  getPrimaryComponent,
  type SizingTemplateData,
  type VariantsTemplateData,
  type StatesTemplateData,
  type CompositionTemplateData,
  type InteractionTemplateData,
  type GenericTemplateData
} from '../templateDataExtractor.js';

describe('extractTemplateData', () => {
  describe('Sizing Intent', () => {
    it('should extract sizing data from Button size example', () => {
      const code = `
        import { Button, HStack } from "@chakra-ui/react"

        const Demo = () => {
          return (
            <HStack gap="6" wrap="wrap">
              <Button size="xs">Button (xs)</Button>
              <Button size="sm">Button (sm)</Button>
              <Button size="md">Button (md)</Button>
              <Button size="lg">Button (lg)</Button>
              <Button size="xl">Button (xl)</Button>
            </HStack>
          )
        }
      `;

      const analysis = analyzeCode(code);
      const result = extractTemplateData('sizing', analysis, 'Button');

      expect(result.intent).toBe('sizing');
      expect(result.data).toMatchObject({
        component: 'Button',
        sizes: ['xs', 'sm', 'md', 'lg', 'xl'],
        sizeCount: 5,
        layoutComponent: 'HStack',
        layoutProps: { gap: '6', wrap: 'wrap' }
      });
    });

    it('should handle sizing without layout component', () => {
      const code = `
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      `;

      const analysis = analyzeCode(code);
      const result = extractTemplateData('sizing', analysis, 'Button');

      expect(result.intent).toBe('sizing');
      const data = result.data as SizingTemplateData;
      expect(data.sizes).toEqual(['sm', 'lg']);
      expect(data.layoutComponent).toBeUndefined();
    });
  });

  describe('Variants Intent', () => {
    it('should extract variants data from Button variant example', () => {
      const code = `
        import { Button, HStack } from "@chakra-ui/react"

        const Demo = () => {
          return (
            <HStack>
              <Button variant="solid">Solid</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="subtle">Subtle</Button>
            </HStack>
          )
        }
      `;

      const analysis = analyzeCode(code);
      const result = extractTemplateData('variants', analysis, 'Button');

      expect(result.intent).toBe('variants');
      expect(result.data).toMatchObject({
        component: 'Button',
        variants: ['solid', 'outline', 'ghost', 'subtle'],
        variantCount: 4
      });
    });

    it('should include other styling props', () => {
      const code = `
        <Button variant="solid" colorPalette="blue" size="md">Button</Button>
        <Button variant="outline" colorPalette="red" size="lg">Button</Button>
      `;

      const analysis = analyzeCode(code);
      const result = extractTemplateData('variants', analysis, 'Button');

      expect(result.intent).toBe('variants');
      const data = result.data as VariantsTemplateData;
      expect(data.variants).toEqual(['solid', 'outline']);
      expect(data.otherProps).toMatchObject({
        colorPalette: ['blue', 'red'],
        size: ['md', 'lg']
      });
    });
  });

  describe('States Intent', () => {
    it('should extract state props from Button example', () => {
      const code = `
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
        <Button isInvalid>Invalid</Button>
      `;

      const analysis = analyzeCode(code);
      const result = extractTemplateData('states', analysis, 'Button');

      expect(result.intent).toBe('states');
      const data = result.data as StatesTemplateData;
      expect(data.component).toBe('Button');
      expect(data.states).toContain('loading');
      expect(data.states).toContain('disabled');
      expect(data.states).toContain('isInvalid');
      expect(data.stateDescriptions['loading']).toBe('loading state');
      expect(data.stateDescriptions['disabled']).toBe('disabled state');
    });

    it('should generate state demonstrations', () => {
      const code = `
        <Input readOnly value="Read only" />
        <Input isRequired placeholder="Required" />
      `;

      const analysis = analyzeCode(code);
      const result = extractTemplateData('states', analysis, 'Input');

      expect(result.intent).toBe('states');
      const data = result.data as StatesTemplateData;
      expect(data.demonstrations).toContain('How to show read-only state using the readOnly prop');
      expect(data.demonstrations).toContain('How to show required state using the isRequired prop');
    });
  });

  describe('Composition Intent', () => {
    it('should detect subcomponent composition pattern', () => {
      const code = `
        import { Checkbox } from "@chakra-ui/react"

        const Demo = () => {
          return (
            <Checkbox.Root>
              <Checkbox.HiddenInput />
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              <Checkbox.Label>Accept terms</Checkbox.Label>
            </Checkbox.Root>
          )
        }
      `;

      const analysis = analyzeCode(code);
      const result = extractTemplateData('composition', analysis, 'Checkbox');

      expect(result.intent).toBe('composition');
      const data = result.data as CompositionTemplateData;
      expect(data.primaryComponent).toBe('Checkbox');
      expect(data.pattern).toBe('subcomponent composition');
      expect(data.subComponents).toContain('Checkbox.Root');
      expect(data.subComponents).toContain('Checkbox.Label');
      expect(data.subComponents).toContain('Checkbox.Control');
    });

    it('should detect multi-component pattern', () => {
      const code = `
        import { Button, Input, HStack } from "@chakra-ui/react"

        <HStack>
          <Input placeholder="Enter text" />
          <Button>Submit</Button>
        </HStack>
      `;

      const analysis = analyzeCode(code);
      const result = extractTemplateData('composition', analysis, 'Input');

      expect(result.intent).toBe('composition');
      const data = result.data as CompositionTemplateData;
      expect(data.pattern).toBe('multi-component');
      expect(data.componentCount).toBeGreaterThan(1);
    });
  });

  describe('Interaction Intent', () => {
    it('should extract interaction data with hooks and handlers', () => {
      const code = `
        import { Button } from "@chakra-ui/react"
        import { useState } from "react"

        const Demo = () => {
          const [count, setCount] = useState(0)

          return (
            <Button onClick={() => setCount(count + 1)}>
              Count: {count}
            </Button>
          )
        }
      `;

      const analysis = analyzeCode(code);
      const result = extractTemplateData('interaction', analysis, 'Button');

      expect(result.intent).toBe('interaction');
      const data = result.data as InteractionTemplateData;
      expect(data.component).toBe('Button');
      expect(data.hooks).toContain('useState');
      expect(data.eventHandlers).toContain('onClick');
      expect(data.interactionType).toBe('click handling');
    });

    it('should detect form submission interaction', () => {
      const code = `
        <form onSubmit={handleSubmit}>
          <Input name="email" />
          <Button type="submit">Submit</Button>
        </form>
      `;

      const analysis = analyzeCode(code);
      const result = extractTemplateData('interaction', analysis, 'Button');

      expect(result.intent).toBe('interaction');
      const data = result.data as InteractionTemplateData;
      expect(data.interactionType).toBe('form submission');
    });
  });

  describe('Generic Intent', () => {
    it('should extract generic data for simple examples', () => {
      const code = `
        <Button variant="primary" size="md">Click Me</Button>
      `;

      const analysis = analyzeCode(code);
      const result = extractTemplateData('generic', analysis, 'Button');

      expect(result.intent).toBe('generic');
      const data = result.data as GenericTemplateData;
      expect(data.component).toBe('Button');
      expect(data.props).toMatchObject({
        variant: ['primary'],
        size: ['md']
      });
      expect(data.hasInteractivity).toBe(false);
      expect(data.hasState).toBe(false);
    });

    it('should detect interactivity and state in generic', () => {
      const code = `
        const [value, setValue] = useState('')
        <Input value={value} onChange={(e) => setValue(e.target.value)} />
      `;

      const analysis = analyzeCode(code);
      const result = extractTemplateData('generic', analysis, 'Input');

      expect(result.intent).toBe('generic');
      const data = result.data as GenericTemplateData;
      expect(data.hasState).toBe(true);
      expect(data.hasInteractivity).toBe(true);
    });
  });
});

describe('getPrimaryComponent', () => {
  it('should identify most frequently used non-layout component', () => {
    const code = `
      <HStack>
        <Button size="xs">XS</Button>
        <Button size="sm">SM</Button>
        <Button size="md">MD</Button>
      </HStack>
    `;

    const analysis = analyzeCode(code);
    const primary = getPrimaryComponent(analysis);

    expect(primary).toBe('Button');
  });

  it('should prioritize non-layout components', () => {
    const code = `
      <HStack gap="4">
        <Box padding="2">
          <Input placeholder="Enter text" />
        </Box>
      </HStack>
    `;

    const analysis = analyzeCode(code);
    const primary = getPrimaryComponent(analysis);

    // Should prioritize Input over HStack/Box
    expect(primary).toBe('Input');
  });

  it('should fallback to first component if no props', () => {
    const code = `
      <Button>Click</Button>
      <Input />
    `;

    const analysis = analyzeCode(code);
    const primary = getPrimaryComponent(analysis);

    expect(primary).toBeTruthy();
    expect(['Button', 'Input']).toContain(primary);
  });
});
