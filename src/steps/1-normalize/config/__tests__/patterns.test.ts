import { describe, it, expect } from '@jest/globals';
import {
  IMPORT_PATTERNS,
  COMPONENT_PATTERNS,
  PROP_PATTERNS,
  HOOK_PATTERNS,
  EVENT_HANDLER_PATTERNS,
  SECTION_PATTERNS,
  STATE_PROPS,
  hasMultipleValues,
  testPattern,
  getPatternConfigMetadata
} from '../patterns.config.js';

describe('patterns.config', () => {
  describe('IMPORT_PATTERNS', () => {
    it('should match named imports', () => {
      const code = 'import { Button, HStack } from "@chakra-ui/react"';
      const regex = IMPORT_PATTERNS.named;
      regex.lastIndex = 0;
      const match = regex.exec(code);
      expect(match).not.toBeNull();
      expect(match![1]).toContain('Button');
      expect(match![2]).toBe('@chakra-ui/react');
    });

    it('should match default imports', () => {
      const code = 'import React from "react"';
      const regex = IMPORT_PATTERNS.default;
      regex.lastIndex = 0;
      const match = regex.exec(code);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('React');
      expect(match![2]).toBe('react');
    });

    it('should match namespace imports', () => {
      const code = 'import * as Icons from "react-icons"';
      const regex = IMPORT_PATTERNS.namespace;
      regex.lastIndex = 0;
      const match = regex.exec(code);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('Icons');
      expect(match![2]).toBe('react-icons');
    });
  });

  describe('COMPONENT_PATTERNS', () => {
    it('should match JSX components', () => {
      const code = '<Button size="xs">Click</Button>';
      const regex = COMPONENT_PATTERNS.jsx;
      regex.lastIndex = 0;
      const match = regex.exec(code);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('Button');
    });

    it('should match composite components', () => {
      const code = '<Checkbox.Root><Checkbox.Control /></Checkbox.Root>';
      const regex = COMPONENT_PATTERNS.jsx;
      regex.lastIndex = 0;

      const matches = [];
      let match;
      while ((match = regex.exec(code)) !== null) {
        matches.push(match[1]);
      }

      expect(matches).toContain('Checkbox.Root');
      expect(matches).toContain('Checkbox.Control');
    });
  });

  describe('PROP_PATTERNS', () => {
    it('should match string literal props', () => {
      const code = '<Button size="xs" variant="solid">';
      const regex = PROP_PATTERNS.stringLiteral;
      regex.lastIndex = 0;

      const matches = [];
      let match;
      while ((match = regex.exec(code)) !== null) {
        matches.push({ prop: match[1], value: match[2] });
      }

      expect(matches).toContainEqual({ prop: 'size', value: 'xs' });
      expect(matches).toContainEqual({ prop: 'variant', value: 'solid' });
    });

    it('should match expression props', () => {
      const code = '<Button size={size} onClick={handleClick}>';
      const regex = PROP_PATTERNS.expression;
      regex.lastIndex = 0;

      const matches = [];
      let match;
      while ((match = regex.exec(code)) !== null) {
        matches.push({ prop: match[1], value: match[2] });
      }

      expect(matches.length).toBeGreaterThan(0);
      expect(matches.some(m => m.prop === 'size')).toBe(true);
      expect(matches.some(m => m.prop === 'onClick')).toBe(true);
    });
  });

  describe('HOOK_PATTERNS', () => {
    it('should match React hooks', () => {
      const code = 'const [state, setState] = useState(0); useEffect(() => {});';
      const regex = HOOK_PATTERNS.pattern;
      regex.lastIndex = 0;

      const matches = [];
      let match;
      while ((match = regex.exec(code)) !== null) {
        matches.push(match[1]);
      }

      expect(matches).toContain('useState');
      expect(matches).toContain('useEffect');
    });

    it('should detect state hooks', () => {
      expect(HOOK_PATTERNS.state.test('useState')).toBe(true);
      expect(HOOK_PATTERNS.state.test('useReducer')).toBe(true);
      expect(HOOK_PATTERNS.state.test('useEffect')).toBe(false);
    });

    it('should detect effect hooks', () => {
      expect(HOOK_PATTERNS.effect.test('useEffect')).toBe(true);
      expect(HOOK_PATTERNS.effect.test('useLayoutEffect')).toBe(true);
      expect(HOOK_PATTERNS.effect.test('useState')).toBe(false);
    });
  });

  describe('EVENT_HANDLER_PATTERNS', () => {
    it('should match event handlers', () => {
      const code = '<Button onClick={handleClick} onChange={handleChange}>';
      const regex = EVENT_HANDLER_PATTERNS.pattern;
      regex.lastIndex = 0;

      const matches = [];
      let match;
      while ((match = regex.exec(code)) !== null) {
        matches.push(match[1]);
      }

      expect(matches).toContain('onClick');
      expect(matches).toContain('onChange');
    });

    it('should have common handlers defined', () => {
      expect(EVENT_HANDLER_PATTERNS.commonHandlers).toContain('onClick');
      expect(EVENT_HANDLER_PATTERNS.commonHandlers).toContain('onChange');
      expect(EVENT_HANDLER_PATTERNS.commonHandlers).toContain('onSubmit');
    });
  });

  describe('SECTION_PATTERNS', () => {
    it('should detect size patterns', () => {
      const code = '<Button size="xs">Small</Button>';
      expect(SECTION_PATTERNS.size.prop.test(code)).toBe(true);
    });

    it('should detect variant patterns', () => {
      const code = '<Button variant="solid">Click</Button>';
      expect(SECTION_PATTERNS.variant.prop.test(code)).toBe(true);
    });

    it('should detect loading patterns', () => {
      expect(SECTION_PATTERNS.loading.test('<Button loading>Click</Button>')).toBe(true);
      expect(SECTION_PATTERNS.loading.test('<Button isLoading>Click</Button>')).toBe(true);
      expect(SECTION_PATTERNS.loading.test('<Spinner />')).toBe(true);
    });

    it('should detect disabled patterns', () => {
      expect(SECTION_PATTERNS.disabled.test('<Button disabled>Click</Button>')).toBe(true);
      expect(SECTION_PATTERNS.disabled.test('<Button isDisabled>Click</Button>')).toBe(true);
    });

    it('should detect invalid/error patterns', () => {
      expect(SECTION_PATTERNS.invalid.test('<Input error>Text</Input>')).toBe(true);
      expect(SECTION_PATTERNS.invalid.test('<Input invalid>Text</Input>')).toBe(true);
      expect(SECTION_PATTERNS.invalid.test('<Input isInvalid>Text</Input>')).toBe(true);
    });

    it('should detect icon patterns', () => {
      expect(SECTION_PATTERNS.icon.test('<Icon />')).toBe(true);
      expect(SECTION_PATTERNS.icon.test('<Button leftIcon={icon}>Click</Button>')).toBe(true);
      expect(SECTION_PATTERNS.icon.test('<Button startElement={icon}>Click</Button>')).toBe(true);
    });
  });

  describe('hasMultipleValues', () => {
    it('should detect multiple size values', () => {
      const code = '<Button size="xs">Small</Button><Button size="lg">Large</Button>';
      expect(hasMultipleValues(code, 'size')).toBe(true);
    });

    it('should return false for single size value', () => {
      const code = '<Button size="md">Click</Button>';
      expect(hasMultipleValues(code, 'size')).toBe(false);
    });

    it('should detect multiple variant values', () => {
      const code = '<Button variant="solid">A</Button><Button variant="outline">B</Button>';
      expect(hasMultipleValues(code, 'variant')).toBe(true);
    });

    it('should detect multiple color values', () => {
      const code = '<Button colorPalette="blue">A</Button><Button colorPalette="red">B</Button>';
      expect(hasMultipleValues(code, 'color')).toBe(true);
    });
  });

  describe('testPattern', () => {
    it('should test pattern against code', () => {
      const code = '<Button size="xs">Click</Button>';
      expect(testPattern(code, SECTION_PATTERNS.size.prop)).toBe(true);
      expect(testPattern(code, SECTION_PATTERNS.variant.prop)).toBe(false);
    });

    it('should not mutate original pattern', () => {
      const code = '<Button size="xs">Click</Button>';
      const originalLastIndex = SECTION_PATTERNS.size.prop.lastIndex;
      testPattern(code, SECTION_PATTERNS.size.prop);
      // Global patterns shouldn't be mutated
      expect(SECTION_PATTERNS.size.prop.lastIndex).toBe(originalLastIndex);
    });
  });

  describe('getPatternConfigMetadata', () => {
    it('should return valid metadata', () => {
      const metadata = getPatternConfigMetadata();
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.importPatterns).toBeGreaterThan(0);
      expect(metadata.componentPatterns).toBeGreaterThan(0);
      expect(metadata.propPatterns).toBeGreaterThan(0);
      expect(metadata.description).toBeDefined();
    });
  });

  describe('STATE_PROPS', () => {
    it('should have loading state props', () => {
      expect(STATE_PROPS.loading).toContain('loading');
      expect(STATE_PROPS.loading).toContain('isLoading');
    });

    it('should have disabled state props', () => {
      expect(STATE_PROPS.disabled).toContain('disabled');
      expect(STATE_PROPS.disabled).toContain('isDisabled');
    });

    it('should have invalid state props', () => {
      expect(STATE_PROPS.invalid).toContain('error');
      expect(STATE_PROPS.invalid).toContain('invalid');
      expect(STATE_PROPS.invalid).toContain('isInvalid');
    });
  });
});
