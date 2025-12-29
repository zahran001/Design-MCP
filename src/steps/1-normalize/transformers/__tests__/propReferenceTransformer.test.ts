// =============================================================================
// PropReferenceTransformer Tests
// =============================================================================
// Created: 2025-12-28
// Framework: Jest
//
// Tests for core transformer functions:
// - categorizeProp() - 6-category classification
// - parsePropertyType() - type parsing with 8+ edge cases
// - findRelatedProps() - common prop relationships
// - transformProp() - complete transformation pipeline
//
// Design: Tests focus on critical edge cases and error handling.
// All tests verify safe fallbacks (no crashes, always valid output).
// =============================================================================

import { describe, it, expect } from '@jest/globals';
import { transformProp, categorizeProp, parsePropertyType, findRelatedProps } from '../propReferenceTransformer';
import type { Prop } from '../../../../schemas/RAGResultSchema';

describe('propReferenceTransformer', () => {
  describe('categorizeProp', () => {
    it('categorizes appearance props correctly', () => {
      const appearanceProps = [
        'size',
        'variant',
        'colorPalette',
        'colorScheme',
        'theme',
        'width',
        'height',
        'padding',
        'margin',
        'color',
        'border',
        'radius',
        'shadow',
        'opacity'
      ];

      for (const propName of appearanceProps) {
        expect(categorizeProp(propName)).toBe('appearance');
      }
    });

    it('categorizes event handler props correctly', () => {
      const eventProps = ['onClick', 'onChange', 'onBlur', 'onFocus', 'onDoubleClick', 'onOpenChange'];

      for (const propName of eventProps) {
        expect(categorizeProp(propName)).toBe('events');
      }
    });

    it('categorizes state props correctly', () => {
      const stateProps = [
        'disabled',
        'loading',
        'invalid',
        'readOnly',
        'checked',
        'selected',
        'open',
        'error',
        'expanded',
        'active',
        'focused'
      ];

      for (const propName of stateProps) {
        expect(categorizeProp(propName)).toBe('state');
      }
    });

    it('categorizes accessibility props correctly', () => {
      const a11yProps = ['aria-label', 'aria-disabled', 'aria-hidden', 'role'];

      for (const propName of a11yProps) {
        expect(categorizeProp(propName)).toBe('accessibility');
      }
    });

    it('categorizes composition props correctly', () => {
      const compositionProps = ['as', 'asChild', 'ref', 'className', 'style', 'children'];

      for (const propName of compositionProps) {
        expect(categorizeProp(propName)).toBe('composition');
      }
    });

    it('falls back to behavior for unknown props', () => {
      const unknownProps = ['customProp', 'unknownFeature', 'randomAttr'];

      for (const propName of unknownProps) {
        expect(categorizeProp(propName)).toBe('behavior');
      }
    });

    it('prioritizes state category over aria prefix', () => {
      expect(categorizeProp('disabled')).toBe('state');
    });

    it('handles mixed case prop names correctly', () => {
      expect(categorizeProp('AriaLabel')).toBe('accessibility');
      expect(categorizeProp('colorPalette')).toBe('appearance');
      expect(categorizeProp('onClick')).toBe('events');
    });

    it('avoids false positives from substring matches', () => {
      // These should NOT match composition regex (as|asChild|ref|className|style|children)
      expect(categorizeProp('hasError')).not.toBe('composition'); // "as" in "hasError"
      expect(categorizeProp('baseline')).not.toBe('composition'); // "as" in "baseline"
      expect(categorizeProp('reference')).not.toBe('composition'); // "ref" in "reference"

      // These should NOT match state regex (disabled|loading|etc.)
      expect(categorizeProp('hasError')).not.toBe('state'); // "error" in "hasError"
      expect(categorizeProp('isDisabled')).not.toBe('state'); // "disabled" in "isDisabled" (substring)
      expect(categorizeProp('isLoading')).not.toBe('state'); // "loading" in "isLoading"

      // These should NOT match appearance regex (size|color|etc.)
      expect(categorizeProp('fullSize')).not.toBe('appearance'); // "size" in "fullSize"
      expect(categorizeProp('primaryColor')).not.toBe('appearance'); // "color" in "primaryColor"

      // All should fall back to behavior
      expect(categorizeProp('hasError')).toBe('behavior');
      expect(categorizeProp('baseline')).toBe('behavior');
      expect(categorizeProp('reference')).toBe('behavior');
      expect(categorizeProp('isDisabled')).toBe('behavior');
      expect(categorizeProp('isLoading')).toBe('behavior');
      expect(categorizeProp('fullSize')).toBe('behavior');
      expect(categorizeProp('primaryColor')).toBe('behavior');
    });
  });

  describe('parsePropertyType', () => {
    it('parses quoted unions with spacing', () => {
      const result = parsePropertyType("'xs' | 'sm' | 'md'");
      expect(result.kind).toBe('union');
      expect(result.options).toEqual(['xs', 'sm', 'md']);
    });

    it('parses unquoted unions', () => {
      const result = parsePropertyType('xs | sm | md');
      expect(result.kind).toBe('union');
      expect(result.options).toEqual(['xs', 'sm', 'md']);
    });

    it('parses unions with no spacing', () => {
      const result = parsePropertyType("'xs'|'sm'|'md'");
      expect(result.kind).toBe('union');
      expect(result.options).toEqual(['xs', 'sm', 'md']);
    });

    it('parses mixed quote unions', () => {
      const result = parsePropertyType("string | 'literal' | 'another'");
      expect(result.kind).toBe('union');
      expect(result.options).toEqual(['string', 'literal', 'another']);
    });

    it('parses primitive types', () => {
      const primitiveTypes = ['string', 'number', 'boolean', 'any', 'unknown', 'void'];

      for (const typeStr of primitiveTypes) {
        const result = parsePropertyType(typeStr);
        expect(result.kind).toBe('primitive');
        expect(result.raw).toBe(typeStr);
      }
    });

    it('parses array types', () => {
      const arrayTypes = ['string[]', 'number[]', 'Type[]', 'Array<string>', 'Array<Component>', 'Component[]'];

      for (const typeStr of arrayTypes) {
        const result = parsePropertyType(typeStr);
        expect(result.kind).toBe('array');
      }
    });

    it('excludes single-letter generic placeholders from array detection', () => {
      // T[], K[], V[], U[] are TypeScript generic placeholders → should be 'complex'
      // NOT 'array' (which implies concrete types like string[], Component[])
      const genericPlaceholders = ['T[]', 'K[]', 'V[]', 'U[]', 'P[]'];

      for (const typeStr of genericPlaceholders) {
        const result = parsePropertyType(typeStr);
        expect(result.kind).toBe('complex');
        expect(result.raw).toBe(typeStr);
      }
    });

    it('includes multi-letter concrete array types', () => {
      // MyType[], Component[], Response[] are concrete types → should be 'array'
      const concreteArrays = ['MyType[]', 'Component[]', 'Response[]', 'string[]'];

      for (const typeStr of concreteArrays) {
        const result = parsePropertyType(typeStr);
        expect(result.kind).toBe('array');
      }
    });

    it('parses function types', () => {
      const functionTypes = [
        '() => void',
        '(e: MouseEvent) => void',
        '(value: string) => Promise<void>',
        '(a: number, b: number) => number'
      ];

      for (const typeStr of functionTypes) {
        const result = parsePropertyType(typeStr);
        expect(result.kind).toBe('function');
        expect(result.returnType).toBeDefined();
      }
    });

    it('parses object types', () => {
      const result = parsePropertyType('{ prop: string; value: number }');
      expect(result.kind).toBe('object');
    });

    it('parses generic types as complex', () => {
      const genericTypes = [
        'Record<string, unknown>',
        'Map<string, T>',
        'Promise<void>',
        'Partial<T>',
        'T[]'
      ];

      for (const typeStr of genericTypes) {
        const result = parsePropertyType(typeStr);
        expect(result.kind).toBe('complex');
        expect(result.raw).toBe(typeStr);
      }
    });

    it('handles empty/whitespace type strings gracefully', () => {
      const emptyInputs = ['', '   ', '\t', '\n'];

      for (const typeStr of emptyInputs) {
        const result = parsePropertyType(typeStr);
        expect(result.kind).toBe('complex');
      }
    });

    it('never throws on malformed type strings', () => {
      const malformedTypes = ['((( )))', 'some random text', '!!!@@##', '|||||', '| | | |'];

      for (const typeStr of malformedTypes) {
        expect(() => {
          parsePropertyType(typeStr);
        }).not.toThrow();
      }
    });
  });

  describe('findRelatedProps', () => {
    it('finds related props when they exist', () => {
      const allProps: Prop[] = [
        { name: 'size', type: 'string' },
        { name: 'variant', type: 'string' },
        { name: 'colorPalette', type: 'string' },
        { name: 'colorScheme', type: 'string' }
      ];

      const result = findRelatedProps('size', allProps);
      expect(result).toContain('variant');
      expect(result).toContain('colorPalette');
    });

    it('returns empty array for unknown props with no pairings', () => {
      const allProps: Prop[] = [{ name: 'size', type: 'string' }];
      const result = findRelatedProps('unknownProp', allProps);
      expect(result).toEqual([]);
    });

    it('filters related props to only existing ones', () => {
      const allProps: Prop[] = [
        { name: 'size', type: 'string' },
        { name: 'variant', type: 'string' }
      ];

      const result = findRelatedProps('size', allProps);
      expect(result).toContain('variant');
      expect(result).not.toContain('colorPalette');
      expect(result).not.toContain('colorScheme');
    });

    it('handles state prop relationships correctly', () => {
      const allProps: Prop[] = [
        { name: 'disabled', type: 'boolean' },
        { name: 'loading', type: 'boolean' },
        { name: 'readOnly', type: 'boolean' }
      ];

      const result = findRelatedProps('disabled', allProps);
      expect(result).toContain('loading');
      expect(result).toContain('readOnly');
    });

    it('handles event handler relationships correctly', () => {
      const allProps: Prop[] = [
        { name: 'onClick', type: '() => void' },
        { name: 'onDoubleClick', type: '() => void' }
      ];

      const result = findRelatedProps('onClick', allProps);
      expect(result).toContain('onDoubleClick');
    });

    it('handles casing variations in prop names (case-insensitive lookup)', () => {
      // CRITICAL: Props may be defined as 'readonly' (lowercase) or 'readOnly' (camelCase)
      // The lookup must be case-insensitive to find related props regardless of casing
      const allPropsLowercase: Prop[] = [
        { name: 'disabled', type: 'boolean' },
        { name: 'readonly', type: 'boolean' } // lowercase variant
      ];

      const resultFromLowercase = findRelatedProps('readonly', allPropsLowercase);
      expect(resultFromLowercase).toContain('disabled');

      // Also test with camelCase
      const allPropsUpper: Prop[] = [
        { name: 'disabled', type: 'boolean' },
        { name: 'readOnly', type: 'boolean' } // camelCase variant
      ];

      const resultFromUpper = findRelatedProps('readOnly', allPropsUpper);
      expect(resultFromUpper).toContain('disabled');

      // Mixed case: prop defined as 'readonly', lookup as 'readOnly'
      const allPropsMixed: Prop[] = [
        { name: 'disabled', type: 'boolean' },
        { name: 'readonly', type: 'boolean' }
      ];

      const resultMixed = findRelatedProps('readOnly', allPropsMixed); // lookup with camelCase
      expect(resultMixed).toContain('disabled'); // should still find disabled
    });
  });

  describe('transformProp', () => {
    it('creates valid PropReferenceChunk structure', () => {
      const prop: Prop = {
        name: 'size',
        type: "'xs' | 'sm' | 'md' | 'lg' | 'xl'",
        description: 'Controls the size of the button',
        required: false
      };

      const result = transformProp(prop, 'Button', 'https://chakra-ui.com/docs/components/button', [prop]);

      expect(result.metadata.chunkId).toBeDefined();
      expect(result.metadata.chunkType).toBe('prop-reference');
      expect(result.metadata.componentName).toBe('Button');
      expect(result.metadata.sourceUrl).toBe('https://chakra-ui.com/docs/components/button');
      expect(result.metadata.tags).toContain('prop');
      expect(result.metadata.tags).toContain('size');

      expect(result.prop.name).toBe('size');
      expect(result.prop.category).toBeDefined();
      expect(result.prop.fullName).toBe('size');

      expect(result.content.description).toBe('Controls the size of the button');
      expect(result.content.typeExplanation).toBeDefined();

      expect(result.apiReference.type).toBeDefined();
      expect(result.apiReference.required).toBe(false);
      expect(result.apiReference.defaultValue).toBeUndefined();
    });

    it('handles props with default values', () => {
      const prop: Prop = {
        name: 'size',
        type: "'xs' | 'sm' | 'md'",
        description: 'Button size',
        defaultValue: 'md',
        required: false
      };

      const result = transformProp(prop, 'Button', 'https://example.com', [prop]);

      expect(result.apiReference.defaultValue).toBe('md');
      expect(result.content.defaultBehavior).toContain('md');
    });

    it('handles required props', () => {
      const prop: Prop = {
        name: 'value',
        type: 'string',
        required: true
      };

      const result = transformProp(prop, 'Input', 'https://example.com', [prop]);

      expect(result.apiReference.required).toBe(true);
    });

    it('handles props without descriptions', () => {
      const prop: Prop = {
        name: 'customProp',
        type: 'string'
      };

      const result = transformProp(prop, 'Button', 'https://example.com', [prop]);

      expect(result.content.description).toBeDefined();
      expect(result.content.description.length).toBeGreaterThan(0);
    });

    it('generates unique chunk IDs', () => {
      const props: Prop[] = [
        { name: 'size', type: 'string' },
        { name: 'variant', type: 'string' }
      ];

      const result1 = transformProp(props[0], 'Button', 'https://example.com', props);
      const result2 = transformProp(props[1], 'Button', 'https://example.com', props);

      expect(result1.metadata.chunkId).not.toBe(result2.metadata.chunkId);
      expect(result1.metadata.chunkId).toContain('size');
      expect(result2.metadata.chunkId).toContain('variant');
    });

    it('generates tags correctly', () => {
      const prop: Prop = {
        name: 'disabled',
        type: 'boolean'
      };

      const result = transformProp(prop, 'Button', 'https://example.com', [prop]);

      expect(result.metadata.tags).toContain('prop');
      expect(result.metadata.tags).toContain('state');
      expect(result.metadata.tags).toContain('disabled');
    });

    it('handles all prop categories consistently', () => {
      const categoryProps: Array<{ name: string; type: string }> = [
        { name: 'size', type: 'string' },
        { name: 'onClick', type: '() => void' },
        { name: 'disabled', type: 'boolean' },
        { name: 'aria-label', type: 'string' },
        { name: 'as', type: 'string' },
        { name: 'customProp', type: 'string' }
      ];

      for (const prop of categoryProps) {
        const result = transformProp(prop, 'Button', 'https://example.com', categoryProps);
        const validCategories = ['appearance', 'events', 'state', 'accessibility', 'composition', 'behavior'];
        expect(validCategories).toContain(result.prop.category);
      }
    });

    it('never throws on edge case inputs', () => {
      const edgeCases: Array<Prop> = [
        { name: '', type: '' },
        { name: 'prop', type: '' },
        { name: '', type: 'string' },
        { name: 'a', type: '|||||' },
        { name: 'normal', type: 'Record<string, unknown>' }
      ];

      for (const prop of edgeCases) {
        expect(() => {
          transformProp(prop, 'Button', 'https://example.com', [prop]);
        }).not.toThrow();
      }
    });

    it('includes accessibility nuance in usage guidance', () => {
      // CRITICAL: disabled and aria-disabled have DIFFERENT accessibility implications
      // disabled: Removes from keyboard navigation (native HTML behavior)
      // aria-disabled: Keeps element focusable but indicates disabled state (accessible)

      const disabledProp: Prop = {
        name: 'disabled',
        type: 'boolean',
        description: 'Disables the button'
      };

      const ariaDisabledProp: Prop = {
        name: 'aria-disabled',
        type: 'boolean',
        description: 'ARIA disabled state'
      };

      const disabledResult = transformProp(disabledProp, 'Button', 'https://example.com', [disabledProp]);
      const ariaResult = transformProp(ariaDisabledProp, 'Button', 'https://example.com', [ariaDisabledProp]);

      // Verify disabled guidance mentions keyboard navigation removal
      expect(disabledResult.content.usageGuidance).toContain('removed from keyboard navigation');
      expect(disabledResult.content.usageGuidance).toContain('aria-disabled');

      // Verify aria-disabled guidance mentions keeping focusable
      expect(ariaResult.content.usageGuidance).toContain('focusable for accessibility');
      expect(ariaResult.content.usageGuidance).toContain('keyboard navigation');

      // They should have different guidance (not the same)
      expect(disabledResult.content.usageGuidance).not.toBe(ariaResult.content.usageGuidance);
    });
  });
});
