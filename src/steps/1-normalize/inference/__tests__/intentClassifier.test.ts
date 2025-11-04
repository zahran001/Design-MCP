// =============================================================================
// Intent Classifier Tests
// =============================================================================
// Test intent classification with real patterns
//
// Run with: npm test -- intentClassifier.test.ts
// =============================================================================

import { describe, it, expect } from '@jest/globals';
import { classifyIntent } from '../intentClassifier.js';
import { analyzeCode } from '../codeAnalyzer.js';

describe('classifyIntent', () => {
  describe('Sizing Intent', () => {
    it('should classify multiple size values as sizing', () => {
      const code = `
        <Button size="xs">Small</Button>
        <Button size="lg">Large</Button>
      `;
      const analysis = analyzeCode(code);

      const result = classifyIntent(code, analysis, 'Size Variants');

      expect(result.intent).toBe('sizing');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.indicators).toContain('multiple_size_values');
    });

    it('should detect sizing from section title if no prop pattern', () => {
      const code = `<Button>Default Size</Button>`;
      const analysis = analyzeCode(code);

      const result = classifyIntent(code, analysis, 'Button Sizes');

      expect(result.intent).toBe('sizing');
      expect(result.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('Variants Intent', () => {
    it('should classify multiple variant values as variants', () => {
      const code = `
        <Button variant="solid">Solid</Button>
        <Button variant="outline">Outline</Button>
      `;
      const analysis = analyzeCode(code);

      const result = classifyIntent(code, analysis, 'Visual Variants');

      expect(result.intent).toBe('variants');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });
  });

  describe('States Intent', () => {
    it('should classify loading state', () => {
      const code = `<Button loading>Loading...</Button>`;
      const analysis = analyzeCode(code);

      const result = classifyIntent(code, analysis, 'Loading State');

      expect(result.intent).toBe('states');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('should classify disabled state', () => {
      const code = `<Button disabled>Disabled</Button>`;
      const analysis = analyzeCode(code);

      const result = classifyIntent(code, analysis, 'Disabled State');

      expect(result.intent).toBe('states');
    });

    it('should classify error state', () => {
      const code = `<Input error="Invalid" />`;
      const analysis = analyzeCode(code);

      const result = classifyIntent(code, analysis, 'Error State');

      expect(result.intent).toBe('states');
    });
  });

  describe('Composition Intent', () => {
    it('should classify multiple components as composition', () => {
      const code = `
        <HStack>
          <Button>Cancel</Button>
          <Button>Confirm</Button>
          <Icon />
        </HStack>
      `;
      const analysis = analyzeCode(code);

      const result = classifyIntent(code, analysis, 'Button Group');

      expect(result.intent).toBe('composition');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should classify subcomponent usage as composition', () => {
      const code = `
        <Checkbox.Root>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox.Root>
      `;
      const analysis = analyzeCode(code);

      const result = classifyIntent(code, analysis, 'Checkbox Structure');

      expect(result.intent).toBe('composition');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('Interaction Intent', () => {
    it('should classify event handlers with state as interaction', () => {
      const code = `
        const [count, setCount] = useState(0);
        <Button onClick={() => setCount(count + 1)}>Count: {count}</Button>
      `;
      const analysis = analyzeCode(code);

      const result = classifyIntent(code, analysis, 'Interactive Button');

      expect(result.intent).toBe('interaction');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should classify event handlers without state as interaction (lower confidence)', () => {
      const code = `<Button onClick={handleClick}>Click Me</Button>`;
      const analysis = analyzeCode(code);

      const result = classifyIntent(code, analysis, 'Clickable Button');

      expect(result.intent).toBe('interaction');
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('Generic Intent', () => {
    it('should fallback to generic for plain examples', () => {
      const code = `<Button>Click Me</Button>`;
      const analysis = analyzeCode(code);

      const result = classifyIntent(code, analysis, 'Usage Example');

      expect(result.intent).toBe('generic');
      expect(result.confidence).toBeLessThan(0.5);
    });
  });

  describe('Priority Order', () => {
    it('should prioritize sizing over section title hints', () => {
      const code = `
        <Button size="xs">Small</Button>
        <Button size="lg">Large</Button>
      `;
      const analysis = analyzeCode(code);

      // Even with a misleading title, should use prop pattern
      const result = classifyIntent(code, analysis, 'Button Variants');

      expect(result.intent).toBe('sizing');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should prioritize states over interaction', () => {
      const code = `
        const [loading, setLoading] = useState(false);
        <Button loading={loading} onClick={handleClick}>Submit</Button>
      `;
      const analysis = analyzeCode(code);

      const result = classifyIntent(code, analysis, 'Loading Button');

      expect(result.intent).toBe('states');
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

      const analysis = analyzeCode(code);
      const result = classifyIntent(code, analysis, 'Size Variants');

      expect(result.intent).toBe('sizing');
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

      const analysis = analyzeCode(code);
      const result = classifyIntent(code, analysis, 'Composition Structure');

      expect(result.intent).toBe('composition');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should handle interactive counter example', () => {
      const code = `import { Button } from "@chakra-ui/react"
import { useState } from "react"

const Demo = () => {
  const [count, setCount] = useState(0)

  return (
    <Button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </Button>
  )
}`;

      const analysis = analyzeCode(code);
      const result = classifyIntent(code, analysis, 'Interactive Example');

      expect(result.intent).toBe('interaction');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });
});
