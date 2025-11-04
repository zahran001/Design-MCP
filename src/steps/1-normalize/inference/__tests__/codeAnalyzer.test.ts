// =============================================================================
// Code Analyzer Tests
// =============================================================================
// Test the code analysis utility with real Chakra UI examples
//
// Run with: npm test -- codeAnalyzer.test.ts
// =============================================================================

import { describe, it, expect } from '@jest/globals';
import { analyzeCode } from '../codeAnalyzer.js';

describe('analyzeCode', () => {
  describe('Import Extraction', () => {
    it('should extract simple imports', () => {
      const code = `import { Button, HStack } from "@chakra-ui/react"`;

      const result = analyzeCode(code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0]).toMatchObject({
        source: '@chakra-ui/react',
        type: 'named',
        namedImports: expect.arrayContaining(['Button', 'HStack'])
      });
    });

    it('should extract multiple import statements', () => {
      const code = `
        import { Button } from "@chakra-ui/react"
        import { useState } from "react"
      `;

      const result = analyzeCode(code);

      expect(result.imports).toHaveLength(2);
      expect(result.imports[0].source).toBe('@chakra-ui/react');
      expect(result.imports[1].source).toBe('react');
    });
  });

  describe('Component Extraction', () => {
    it('should extract JSX components', () => {
      const code = `
        <HStack gap="6">
          <Button size="xs">Small</Button>
          <Button size="md">Medium</Button>
        </HStack>
      `;

      const result = analyzeCode(code);

      expect(result.components).toContain('HStack');
      expect(result.components).toContain('Button');
      expect(result.components).toHaveLength(2);
    });

    it('should extract dot-notation components', () => {
      const code = `
        <Checkbox.Root>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
        </Checkbox.Root>
      `;

      const result = analyzeCode(code);

      expect(result.components).toContain('Checkbox.Root');
      expect(result.components).toContain('Checkbox.Control');
      expect(result.components).toContain('Checkbox.Indicator');
    });
  });

  describe('Prop Extraction', () => {
    it('should extract string props', () => {
      const code = `<Button size="xs" variant="solid">Click</Button>`;

      const result = analyzeCode(code);

      expect(result.props).toContainEqual(
        expect.objectContaining({
          component: 'Button',
          prop: 'size',
          rawValues: expect.arrayContaining(['xs'])
        })
      );
      expect(result.props).toContainEqual(
        expect.objectContaining({
          component: 'Button',
          prop: 'variant',
          rawValues: expect.arrayContaining(['solid'])
        })
      );
    });

    it('should group multiple values for same prop', () => {
      const code = `
        <Button size="xs">Small</Button>
        <Button size="sm">Medium</Button>
        <Button size="md">Large</Button>
      `;

      const result = analyzeCode(code);

      const sizeProp = result.props.find(
        p => p.component === 'Button' && p.prop === 'size'
      );

      expect(sizeProp).toBeDefined();
      expect(sizeProp!.rawValues).toContain('xs');
      expect(sizeProp!.rawValues).toContain('sm');
      expect(sizeProp!.rawValues).toContain('md');
      expect(sizeProp!.rawValues).toHaveLength(3);
    });

    it('should extract expression props', () => {
      const code = `<Button onClick={handleClick} loading={isLoading}>Click</Button>`;

      const result = analyzeCode(code);

      expect(result.props).toContainEqual(
        expect.objectContaining({
          component: 'Button',
          prop: 'onClick',
          rawValues: expect.arrayContaining(['handleClick'])
        })
      );
      expect(result.props).toContainEqual(
        expect.objectContaining({
          component: 'Button',
          prop: 'loading',
          rawValues: expect.arrayContaining(['isLoading'])
        })
      );
    });
  });

  describe('Hook Extraction', () => {
    it('should extract React hooks', () => {
      const code = `
        const [count, setCount] = useState(0);
        const value = useCallback(() => count, [count]);
      `;

      const result = analyzeCode(code);

      expect(result.hooks).toContain('useState');
      expect(result.hooks).toContain('useCallback');
    });

    it('should detect state usage', () => {
      const codeWithState = `const [value, setValue] = useState(false);`;
      const codeWithoutState = `const value = useCallback(() => {}, []);`;

      expect(analyzeCode(codeWithState).hasState).toBe(true);
      expect(analyzeCode(codeWithoutState).hasState).toBe(false);
    });
  });

  describe('Event Handler Detection', () => {
    it('should extract event handlers', () => {
      const code = `<Button onClick={handleClick} onChange={handleChange}>Click</Button>`;

      const result = analyzeCode(code);

      expect(result.eventHandlers).toContain('onClick');
      expect(result.eventHandlers).toContain('onChange');
    });

    it('should detect interactivity', () => {
      const interactive = `<Button onClick={handleClick}>Click</Button>`;
      const notInteractive = `<Button size="md">Click</Button>`;

      expect(analyzeCode(interactive).hasInteractivity).toBe(true);
      expect(analyzeCode(notInteractive).hasInteractivity).toBe(false);
    });
  });

  describe('Real Chakra UI Example', () => {
    it('should analyze Button size variants example', () => {
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

      const result = analyzeCode(code);

      // Check imports
      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].namedImports).toContain('Button');
      expect(result.imports[0].namedImports).toContain('HStack');

      // Check components
      expect(result.components).toContain('HStack');
      expect(result.components).toContain('Button');

      // Check props
      const sizeProp = result.props.find(
        p => p.component === 'Button' && p.prop === 'size'
      );
      expect(sizeProp).toBeDefined();
      expect(sizeProp!.rawValues).toHaveLength(5);
      expect(sizeProp!.rawValues).toContain('xs');
      expect(sizeProp!.rawValues).toContain('xl');

      // Check flags
      expect(result.hasInteractivity).toBe(false);
      expect(result.hasState).toBe(false);
    });

    it('should analyze interactive Button example', () => {
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

      const result = analyzeCode(code);

      expect(result.hooks).toContain('useState');
      expect(result.eventHandlers).toContain('onClick');
      expect(result.hasState).toBe(true);
      expect(result.hasInteractivity).toBe(true);
    });
  });
});
