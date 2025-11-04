import { describe, it, expect } from '@jest/globals';
import {
  RawCodeExampleSchema,
  validateRawCodeExample,
  validateRawCodeExampleStrict,
  isRawCodeExample,
  formatValidationErrors,
  createMinimalRawCodeExample,
  withDefaults,
  type RawCodeExample
} from '../RawCodeExampleSchema.js';
import { ZodError } from 'zod';

describe('RawCodeExampleSchema', () => {
  describe('validateRawCodeExample', () => {
    it('should validate minimal valid example', () => {
      const result = validateRawCodeExample({
        code: '<Button>Click</Button>'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe('<Button>Click</Button>');
        expect(result.data.score).toBeUndefined();
        expect(result.data.complexity).toBeUndefined();
        expect(result.data.section).toBeUndefined();
      }
    });

    it('should validate full example with all fields', () => {
      const result = validateRawCodeExample({
        code: '<Button variant="solid">Click</Button>',
        score: 85,
        complexity: 'intermediate',
        section: 'Variants'
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.code).toBe('<Button variant="solid">Click</Button>');
        expect(result.data.score).toBe(85);
        expect(result.data.complexity).toBe('intermediate');
        expect(result.data.section).toBe('Variants');
      }
    });

    it('should reject empty code', () => {
      const result = validateRawCodeExample({
        code: ''
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Code cannot be empty');
      }
    });

    it('should reject whitespace-only code', () => {
      const result = validateRawCodeExample({
        code: '   \n\t  '
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Code cannot contain only whitespace');
      }
    });

    it('should reject negative score', () => {
      const result = validateRawCodeExample({
        code: '<Button>Click</Button>',
        score: -5
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Score cannot be negative');
      }
    });

    it('should reject score > 100', () => {
      const result = validateRawCodeExample({
        code: '<Button>Click</Button>',
        score: 150
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Score cannot exceed 100');
      }
    });

    it('should reject non-integer score', () => {
      const result = validateRawCodeExample({
        code: '<Button>Click</Button>',
        score: 85.5
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].message).toBe('Score must be an integer');
      }
    });

    it('should reject invalid complexity', () => {
      const result = validateRawCodeExample({
        code: '<Button>Click</Button>',
        complexity: 'ultra-complex'
      });

      expect(result.success).toBe(false);
    });

    it('should accept all valid complexity levels', () => {
      const complexities: Array<'basic' | 'intermediate' | 'advanced'> = [
        'basic',
        'intermediate',
        'advanced'
      ];

      complexities.forEach(complexity => {
        const result = validateRawCodeExample({
          code: '<Button>Click</Button>',
          complexity
        });
        expect(result.success).toBe(true);
      });
    });

    it('should reject missing code field', () => {
      const result = validateRawCodeExample({
        score: 50
      });

      expect(result.success).toBe(false);
    });
  });

  describe('validateRawCodeExampleStrict', () => {
    it('should return parsed data on success', () => {
      const data = validateRawCodeExampleStrict({
        code: '<Button>Click</Button>',
        score: 90
      });

      expect(data.code).toBe('<Button>Click</Button>');
      expect(data.score).toBe(90);
    });

    it('should throw ZodError on failure', () => {
      expect(() => {
        validateRawCodeExampleStrict({
          code: ''
        });
      }).toThrow(ZodError);
    });

    it('should throw on missing code', () => {
      expect(() => {
        validateRawCodeExampleStrict({
          score: 50
        });
      }).toThrow(ZodError);
    });
  });

  describe('isRawCodeExample', () => {
    it('should return true for valid example', () => {
      const data = {
        code: '<Button>Click</Button>',
        score: 80
      };

      expect(isRawCodeExample(data)).toBe(true);
    });

    it('should return false for invalid example', () => {
      const data = {
        code: '',
        score: 80
      };

      expect(isRawCodeExample(data)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(isRawCodeExample('string')).toBe(false);
      expect(isRawCodeExample(123)).toBe(false);
      expect(isRawCodeExample(null)).toBe(false);
      expect(isRawCodeExample(undefined)).toBe(false);
    });

    it('should provide type narrowing', () => {
      const data: unknown = {
        code: '<Button>Click</Button>'
      };

      if (isRawCodeExample(data)) {
        // TypeScript should know data is RawCodeExample here
        expect(data.code).toBeDefined();
      }
    });
  });

  describe('formatValidationErrors', () => {
    it('should format single error', () => {
      const result = validateRawCodeExample({
        code: ''
      });

      if (!result.success) {
        const messages = formatValidationErrors(result.error);
        expect(messages.length).toBeGreaterThan(0);
        expect(messages[0]).toContain('code');
        expect(messages[0]).toContain('cannot be empty');
      }
    });

    it('should format multiple errors', () => {
      const result = validateRawCodeExample({
        code: '',
        score: -10,
        complexity: 'invalid'
      } as any);

      if (!result.success) {
        const messages = formatValidationErrors(result.error);
        expect(messages.length).toBeGreaterThan(1);
      }
    });

    it('should include field path in error message', () => {
      const result = validateRawCodeExample({
        code: 'valid',
        score: 150
      });

      if (!result.success) {
        const messages = formatValidationErrors(result.error);
        const scoreError = messages.find(msg => msg.includes('score'));
        expect(scoreError).toBeDefined();
      }
    });
  });

  describe('createMinimalRawCodeExample', () => {
    it('should create minimal valid example', () => {
      const example = createMinimalRawCodeExample('<Button>Test</Button>');

      expect(example.code).toBe('<Button>Test</Button>');
      expect(example.score).toBeUndefined();
      expect(example.complexity).toBeUndefined();
      expect(example.section).toBeUndefined();
    });

    it('should pass validation', () => {
      const example = createMinimalRawCodeExample('<Button>Test</Button>');
      const result = validateRawCodeExample(example);

      expect(result.success).toBe(true);
    });
  });

  describe('withDefaults', () => {
    it('should merge code with optional fields', () => {
      const example = withDefaults({
        code: '<Button>Click</Button>',
        score: 75,
        complexity: 'advanced'
      });

      expect(example.code).toBe('<Button>Click</Button>');
      expect(example.score).toBe(75);
      expect(example.complexity).toBe('advanced');
      expect(example.section).toBeUndefined();
    });

    it('should handle code-only input', () => {
      const example = withDefaults({
        code: '<Button>Click</Button>'
      });

      expect(example.code).toBe('<Button>Click</Button>');
      expect(example.score).toBeUndefined();
      expect(example.complexity).toBeUndefined();
      expect(example.section).toBeUndefined();
    });

    it('should preserve all provided fields', () => {
      const example = withDefaults({
        code: '<Button>Click</Button>',
        score: 50,
        complexity: 'basic',
        section: 'Getting Started'
      });

      expect(example.code).toBe('<Button>Click</Button>');
      expect(example.score).toBe(50);
      expect(example.complexity).toBe('basic');
      expect(example.section).toBe('Getting Started');
    });
  });

  describe('Edge cases', () => {
    it('should handle very long code strings', () => {
      const longCode = '<Button>' + 'x'.repeat(10000) + '</Button>';
      const result = validateRawCodeExample({
        code: longCode
      });

      expect(result.success).toBe(true);
    });

    it('should handle code with special characters', () => {
      const result = validateRawCodeExample({
        code: '<Button onClick={() => alert("Test!")}>Click</Button>'
      });

      expect(result.success).toBe(true);
    });

    it('should handle code with newlines', () => {
      const result = validateRawCodeExample({
        code: `<Button
          variant="solid"
          size="lg"
        >
          Click Me
        </Button>`
      });

      expect(result.success).toBe(true);
    });

    it('should handle score boundaries', () => {
      expect(validateRawCodeExample({ code: 'test', score: 0 }).success).toBe(true);
      expect(validateRawCodeExample({ code: 'test', score: 100 }).success).toBe(true);
    });
  });
});
