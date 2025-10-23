// =============================================================================
// Section Inferrer Tests
// =============================================================================
// Test section title inference with real patterns
//
// Run with: npm test -- sectionInferrer.test.ts
// =============================================================================

import { describe, it, expect } from '@jest/globals';
import { inferSectionTitle } from '../sectionInferrer.js';

describe('inferSectionTitle', () => {
  describe('Size Variants Pattern', () => {
    it('should detect multiple size values', () => {
      const code = `
        <Button size="xs">Small</Button>
        <Button size="sm">Medium</Button>
        <Button size="lg">Large</Button>
      `;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Size Variants');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.method).toBe('pattern_match');
    });

    it('should not match single size value', () => {
      const code = `<Button size="md">Medium</Button>`;

      const result = inferSectionTitle(code);

      expect(result.title).not.toBe('Size Variants');
    });
  });

  describe('Visual Variants Pattern', () => {
    it('should detect multiple variant values', () => {
      const code = `
        <Button variant="solid">Solid</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
      `;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Visual Variants');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('Color Palettes Pattern', () => {
    it('should detect multiple colorPalette values', () => {
      const code = `
        <Button colorPalette="blue">Blue</Button>
        <Button colorPalette="red">Red</Button>
      `;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Color Palettes');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should detect multiple colorScheme values', () => {
      const code = `
        <Button colorScheme="teal">Teal</Button>
        <Button colorScheme="purple">Purple</Button>
      `;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Color Palettes');
    });
  });

  describe('Loading State Pattern', () => {
    it('should detect loading prop', () => {
      const code = `<Button loading>Loading...</Button>`;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Loading State');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should detect isLoading prop', () => {
      const code = `<Button isLoading={true}>Loading...</Button>`;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Loading State');
    });

    it('should detect Spinner component', () => {
      const code = `<Button><Spinner /> Loading...</Button>`;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Loading State');
    });
  });

  describe('Disabled State Pattern', () => {
    it('should detect disabled prop', () => {
      const code = `<Button disabled>Disabled</Button>`;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Disabled State');
    });

    it('should detect isDisabled prop', () => {
      const code = `<Button isDisabled={true}>Disabled</Button>`;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Disabled State');
    });
  });

  describe('Error State Pattern', () => {
    it('should detect error prop', () => {
      const code = `<Input error="Invalid input" />`;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Error State');
    });

    it('should detect invalid prop', () => {
      const code = `<Input invalid />`;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Error State');
    });
  });

  describe('Icon Pattern', () => {
    it('should detect Icon component', () => {
      const code = `<Button><Icon as={FaCheck} />Confirm</Button>`;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('With Icons');
    });

    it('should include component name if provided', () => {
      const code = `<Button leftIcon={<Icon />}>Submit</Button>`;

      const result = inferSectionTitle(code, undefined, 'Button');

      expect(result.title).toBe('Button with Icons');
    });
  });

  describe('Interactive Pattern', () => {
    it('should detect onClick with useState', () => {
      const code = `
        const [count, setCount] = useState(0);
        <Button onClick={() => setCount(count + 1)}>Count: {count}</Button>
      `;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Interactive Example');
    });

    it('should not match onClick without state', () => {
      const code = `<Button onClick={console.log}>Click</Button>`;

      const result = inferSectionTitle(code);

      expect(result.title).not.toBe('Interactive Example');
    });
  });

  describe('Form Integration Pattern', () => {
    it('should detect form usage', () => {
      const code = `<Form onSubmit={handleSubmit}><Button>Submit</Button></Form>`;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Form Integration');
    });

    it('should include component name if provided', () => {
      const code = `<Form><Input name="email" /></Form>`;

      const result = inferSectionTitle(code, undefined, 'Input');

      expect(result.title).toBe('Input in Forms');
    });
  });

  describe('Composition Pattern', () => {
    it('should detect subcomponent composition', () => {
      const code = `
        <Checkbox.Root>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Checkbox.Label />
        </Checkbox.Root>
      `;

      const result = inferSectionTitle(code, undefined, 'Checkbox');

      expect(result.title).toBe('Composition Structure');
    });
  });

  describe('Existing Section', () => {
    it('should use existing section if not generic', () => {
      const code = `<Button>Click</Button>`;
      const result = inferSectionTitle(code, 'Custom Action Button');

      expect(result.title).toBe('Custom Action Button');
      expect(result.method).toBe('existing_section');
    });

    it('should ignore generic sections', () => {
      const genericSections = ['Usage', 'Example', 'Example 1', 'Demo', 'Basic'];

      genericSections.forEach(section => {
        const result = inferSectionTitle(`<Button>Click</Button>`, section);
        expect(result.title).not.toBe(section);
      });
    });
  });

  describe('Fallback', () => {
    it('should fallback to Usage Example', () => {
      const code = `<Button>Plain button</Button>`;

      const result = inferSectionTitle(code);

      expect(result.title).toBe('Usage Example');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.method).toBe('fallback');
    });
  });

  describe('Priority Order', () => {
    it('should prioritize size variants over icons', () => {
      const code = `
        <Button size="xs"><Icon /></Button>
        <Button size="lg"><Icon /></Button>
      `;

      const result = inferSectionTitle(code);

      // Size variants has higher priority
      expect(result.title).toBe('Size Variants');
    });

    it('should prioritize loading state over interactive', () => {
      const code = `
        const [loading, setLoading] = useState(false);
        <Button loading={loading} onClick={handleClick}>Submit</Button>
      `;

      const result = inferSectionTitle(code);

      // Loading state has higher priority
      expect(result.title).toBe('Loading State');
    });
  });

  describe('Real Chakra UI Examples', () => {
    it('should handle Button size example', () => {
      const code = `import { Button, HStack } from "@chakra-ui/react"

const Demo = () => {
  return (
    <HStack wrap="wrap" gap="6">
      <Button size="xs">Button (xs)</Button>
      <Button size="sm">Button (sm)</Button>
      <Button size="md">Button (md)</Button>
      <Button size="lg">Button (lg)</Button>
      <Button size="xl">Button (xl)</Button>
    </HStack>
  )
}`;

      const result = inferSectionTitle(code, undefined, 'Button');

      expect(result.title).toBe('Size Variants');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('should handle Checkbox composition example', () => {
      const code = `<Checkbox.Root>
  <Checkbox.HiddenInput />
  <Checkbox.Control>
    <Checkbox.Indicator />
  </Checkbox.Control>
  <Checkbox.Label />
</Checkbox.Root>`;

      const result = inferSectionTitle(code, 'Usage', 'Checkbox');

      expect(result.title).toBe('Composition Structure');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });
});
