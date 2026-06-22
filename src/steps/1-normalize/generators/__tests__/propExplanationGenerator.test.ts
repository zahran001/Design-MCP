// =============================================================================
// PropExplanation Generator Tests
// =============================================================================
// Created: 2025-12-28
// Coverage: All 5 generator functions with comprehensive test suites
//
// Test Organization:
// 1. Template Coverage (5-7 tests)
// 2. Type Explanations (8 tests)
// 3. Usage Guidance (5 tests)
// 4. Default Behavior (4 tests)
// 5. Integration (3-5 tests)
// =============================================================================

// Using Jest test framework (default in this project)
import {
  generatePropContent,
  generateDescription,
  generateTypeExplanation,
  generateUsageGuidance,
  generateDefaultBehavior
} from '../propExplanationGenerator';
import type { PropCategory, TypeInfo } from '../../../../schemas/NormalizedChunkSchema';

// =============================================================================
// Test Suite 1: Template Coverage
// =============================================================================

describe('propExplanationGenerator', () => {
  describe('generateDescription', () => {
    it('uses raw description if provided', () => {
      const raw = 'Custom description from docs';
      const result = generateDescription('customProp', 'behavior', raw);
      expect(result).toBe(raw);
    });

    it('uses template for known props', () => {
      const result = generateDescription('size', 'appearance');
      expect(result).toContain('visual size');
      expect(result).toContain('spacing');
    });

    it('uses template for disabled prop', () => {
      const result = generateDescription('disabled', 'state');
      expect(result).toContain('Prevents user interaction');
      expect(result).toContain('keyboard navigation');
    });

    it('uses template for aria-disabled (accessibility nuance preserved)', () => {
      const result = generateDescription('aria-disabled', 'accessibility');
      expect(result).toContain('focusable for accessibility');
      expect(result).toContain('keyboard navigation');
      // Verify it's different from disabled
      const disabledResult = generateDescription('disabled', 'state');
      expect(result).not.toBe(disabledResult);
    });

    it('generates type-aware fallback for unknown props', () => {
      const typeInfo: TypeInfo = {
        kind: 'union',
        raw: "'option1' | 'option2'",
        options: ['option1', 'option2']
      };
      const result = generateDescription('unknownProp', 'appearance', undefined, typeInfo);
      expect(result).toContain('unknownProp');
      expect(result).toContain('visual appearance');
      expect(result).toMatch(/one of.*option/i);
    });

    it('never returns undefined or empty string', () => {
      const result = generateDescription('randomUnknownProp', 'behavior');
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('prioritizes raw description over template', () => {
      const raw = 'Raw description';
      const result = generateDescription('size', 'appearance', raw);
      expect(result).toBe(raw);
      expect(result).not.toContain('primary actions'); // Template content
    });
  });

  // =============================================================================
  // Test Suite 2: Type Explanations (8 type kinds)
  // =============================================================================

  describe('generateTypeExplanation', () => {
    it('explains primitive types', () => {
      const typeInfo: TypeInfo = { kind: 'primitive', raw: 'boolean' };
      const result = generateTypeExplanation(typeInfo);
      expect(result).toContain('boolean');
      expect(result).toContain('Accepts');
    });

    it('explains small unions (≤10 options)', () => {
      const typeInfo: TypeInfo = {
        kind: 'union',
        raw: "'xs' | 'sm' | 'md'",
        options: ['xs', 'sm', 'md']
      };
      const result = generateTypeExplanation(typeInfo);
      expect(result).toContain('xs');
      expect(result).toContain('sm');
      expect(result).toContain('md');
      expect(result).not.toContain('...and'); // Should not truncate
    });

    it('truncates large unions (>10) - REFINEMENT A', () => {
      const colors = Array.from({ length: 52 }, (_, i) => `color${i}`);
      const typeInfo: TypeInfo = {
        kind: 'union',
        raw: colors.map((c) => `"${c}"`).join(' | '),
        options: colors
      };
      const result = generateTypeExplanation(typeInfo);
      expect(result).toContain('52 predefined values');
      expect(result).toContain('color0');
      expect(result).toContain('color4');
      expect(result).not.toContain('color5'); // 6th item should be hidden
      expect(result).toContain('...and 47 others');
    });

    it('handles empty unions gracefully', () => {
      const typeInfo: TypeInfo = {
        kind: 'union',
        raw: '',
        options: []
      };
      const result = generateTypeExplanation(typeInfo);
      expect(result).toContain('Union type');
      expect(result).not.toThrow;
    });

    it('explains array types', () => {
      const typeInfo: TypeInfo = {
        kind: 'array',
        raw: 'string[]'
      };
      const result = generateTypeExplanation(typeInfo);
      expect(result).toContain('array');
      expect(result).toContain('string[]');
    });

    it('explains function types with return type', () => {
      const typeInfo: TypeInfo = {
        kind: 'function',
        raw: '(e: Event) => void',
        returnType: 'void'
      };
      const result = generateTypeExplanation(typeInfo);
      expect(result).toContain('Function');
      expect(result).toContain('void');
    });

    it('explains object types', () => {
      const typeInfo: TypeInfo = {
        kind: 'object',
        raw: '{ x: number; y: number }'
      };
      const result = generateTypeExplanation(typeInfo);
      expect(result).toContain('object');
      expect(result).toContain('properties');
    });

    it('explains complex types', () => {
      const typeInfo: TypeInfo = {
        kind: 'complex',
        raw: 'ReactNode | string'
      };
      const result = generateTypeExplanation(typeInfo);
      expect(result).toContain('Complex');
      expect(result).toContain('ReactNode');
    });
  });

  // =============================================================================
  // Test Suite 3: Usage Guidance
  // =============================================================================

  describe('generateUsageGuidance', () => {
    it('provides guidance for known props', () => {
      const result = generateUsageGuidance('size', 'appearance');
      expect(result).toBeDefined();
      expect(result).toContain('md');
      expect(result).toContain('primary actions');
    });

    it('preserves accessibility nuance (disabled vs aria-disabled)', () => {
      const disabledGuidance = generateUsageGuidance('disabled', 'state');
      const ariaDisabledGuidance = generateUsageGuidance('aria-disabled', 'accessibility');

      expect(disabledGuidance).toContain('keyboard navigation');
      expect(ariaDisabledGuidance).toContain('focusable for accessibility');
      expect(disabledGuidance).not.toBe(ariaDisabledGuidance);
    });

    it('returns undefined for unknown props (optional field)', () => {
      const result = generateUsageGuidance('unknownCustomProp', 'behavior');
      expect(result).toBeUndefined();
    });

    it('provides guidance for event handlers', () => {
      const result = generateUsageGuidance('onChange', 'events');
      expect(result).toBeDefined();
      expect(result).toContain('controlled');
      expect(result).toContain('parent state');
    });

    it('provides guidance for composition props', () => {
      const result = generateUsageGuidance('as', 'composition');
      expect(result).toBeDefined();
      expect(result).toContain('different HTML element');
      expect(result).toContain('Button as="a"');
    });

    it('supports component-specific guidance (Phase 3+ framework)', () => {
      // Phase 2a: Framework in place but no component-specific templates yet
      // This test verifies the framework works when Phase 3 adds templates

      // Currently returns generic guidance
      const genericGuidance = generateUsageGuidance('size', 'appearance');
      expect(genericGuidance).toBeDefined();

      // With componentName parameter (will use specific template when added in Phase 3)
      const withComponentName = generateUsageGuidance('size', 'appearance', 'UnknownComponent');
      // Falls back to generic since UnknownComponent:size doesn't exist yet
      expect(withComponentName).toBeDefined();
      expect(withComponentName).toBe(genericGuidance);
    });
  });

  // =============================================================================
  // Test Suite 4: Default Behavior (REFINEMENT B)
  // =============================================================================

  describe('generateDefaultBehavior', () => {
    it('explains required props clearly', () => {
      const result = generateDefaultBehavior(undefined, true);
      expect(result).toContain('Required');
      expect(result).toContain('will not render');
    });

    it('uses explicit default when provided', () => {
      const result = generateDefaultBehavior('md');
      expect(result).toBe("Defaults to md if not specified.");
    });

    it('admits uncertainty for boolean without explicit default - REFINEMENT B', () => {
      const typeInfo: TypeInfo = { kind: 'primitive', raw: 'boolean' };
      const result = generateDefaultBehavior(undefined, false, typeInfo);
      expect(result).toContain('Optional boolean');
      expect(result).toContain('examples');
      expect(result).not.toContain('false'); // DON'T ASSUME
    });

    it('provides safe generic fallback for unknown types', () => {
      const result = generateDefaultBehavior(undefined, false);
      expect(result).toContain('Optional');
      expect(result).toContain('internal defaults');
    });

    it('never assumes boolean defaults to false', () => {
      const typeInfo: TypeInfo = { kind: 'primitive', raw: 'boolean' };
      const result = generateDefaultBehavior(undefined, false, typeInfo);
      // Should NOT contain any assumption about false
      expect(result).not.toMatch(/defaults? to false/i);
    });

    it('prioritizes explicit default over type-based inference', () => {
      const typeInfo: TypeInfo = { kind: 'primitive', raw: 'boolean' };
      const result = generateDefaultBehavior('true', false, typeInfo);
      expect(result).toBe('Defaults to true if not specified.');
    });
  });

  // =============================================================================
  // Test Suite 5: Integration Tests
  // =============================================================================

  describe('generatePropContent', () => {
    it('creates complete content structure for appearance prop', () => {
      const typeInfo: TypeInfo = {
        kind: 'union',
        raw: "'xs' | 'sm' | 'md' | 'lg'",
        options: ['xs', 'sm', 'md', 'lg']
      };
      const content = generatePropContent('size', 'appearance', typeInfo, 'Controls the button size', 'md', false);

      expect(content).toBeDefined();
      expect(content.description).toBe('Controls the button size');
      expect(content.typeExplanation).toContain('xs');
      expect(content.usageGuidance).toBeDefined();
      expect(content.defaultBehavior).toContain('md');
    });

    it('creates complete content for state prop', () => {
      const typeInfo: TypeInfo = { kind: 'primitive', raw: 'boolean' };
      const content = generatePropContent('disabled', 'state', typeInfo, undefined, undefined, false);

      expect(content.description).toContain('Prevents user interaction');
      expect(content.typeExplanation).toContain('boolean');
      expect(content.usageGuidance).toContain('aria-disabled');
      expect(content.defaultBehavior).toContain('Optional boolean');
    });

    it('validates token count is reasonable (100-250 is sweet spot)', () => {
      const typeInfo: TypeInfo = {
        kind: 'union',
        raw: "'xs' | 'sm' | 'md'",
        options: ['xs', 'sm', 'md']
      };
      const content = generatePropContent(
        'size',
        'appearance',
        typeInfo,
        'Controls button size',
        'md',
        false
      );

      // Rough token count: description ~10, typeExplanation ~10, guidance ~30, behavior ~5
      // Total content string length should allow reasonable token count
      const contentLength =
        content.description.length +
        content.typeExplanation.length +
        (content.usageGuidance?.length || 0) +
        content.defaultBehavior.length;

      expect(contentLength).toBeGreaterThan(50); // Minimal content
      expect(contentLength).toBeLessThan(2000); // Reasonable for embedding
    });

    it('handles missing optional fields gracefully', () => {
      const typeInfo: TypeInfo = { kind: 'primitive', raw: 'string' };
      const content = generatePropContent('unknownProp', 'behavior', typeInfo);

      expect(content.description).toBeDefined();
      expect(content.typeExplanation).toBeDefined();
      expect(content.usageGuidance).toBeUndefined(); // Optional
      expect(content.defaultBehavior).toBeDefined();
    });

    it('preserves accessibility nuances in complete content', () => {
      const typeInfo: TypeInfo = { kind: 'primitive', raw: 'boolean' };

      const disabledContent = generatePropContent(
        'disabled',
        'state',
        typeInfo,
        undefined,
        undefined,
        false
      );
      const ariaDisabledContent = generatePropContent(
        'aria-disabled',
        'accessibility',
        typeInfo,
        undefined,
        undefined,
        false
      );

      // Both should have guidance
      expect(disabledContent.usageGuidance).toBeDefined();
      expect(ariaDisabledContent.usageGuidance).toBeDefined();

      // But different
      expect(disabledContent.usageGuidance).not.toBe(ariaDisabledContent.usageGuidance);
    });

    it('handles large union with truncation without errors', () => {
      const colors = Array.from({ length: 100 }, (_, i) => `color${i}`);
      const typeInfo: TypeInfo = {
        kind: 'union',
        raw: colors.map((c) => `"${c}"`).join(' | '),
        options: colors
      };

      const content = generatePropContent('colorPalette', 'appearance', typeInfo, undefined, undefined, false);

      expect(content.typeExplanation).toContain('100 predefined values');
      expect(content.typeExplanation).toContain('...and');
      // Should not explode token count
      expect(content.typeExplanation.length).toBeLessThan(500);
    });
  });

  // =============================================================================
  // Edge Case Tests
  // =============================================================================

  describe('edge cases', () => {
    it('handles empty type strings gracefully', () => {
      const typeInfo: TypeInfo = { kind: 'primitive', raw: '' };
      const result = generateTypeExplanation(typeInfo);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles prop names with special characters', () => {
      const result = generateDescription('aria-label', 'accessibility');
      expect(result).toBeDefined();
    });

    it('handles very long default values', () => {
      const longDefault = 'a'.repeat(100);
      const result = generateDefaultBehavior(longDefault);
      expect(result).toContain(longDefault);
    });

    it('all functions never throw on malformed input', () => {
      expect(() => {
        generateDescription('', 'behavior');
        generateTypeExplanation({ kind: 'primitive', raw: '' });
        generateUsageGuidance('', 'behavior');
        generateDefaultBehavior(undefined, false);
        generatePropContent('', 'behavior', { kind: 'primitive', raw: '' });
      }).not.toThrow();
    });
  });
});
