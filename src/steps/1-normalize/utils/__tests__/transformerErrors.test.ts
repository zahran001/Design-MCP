import { describe, it, expect } from '@jest/globals';
import {
  TransformationError,
  ValidationError,
  AnalysisError,
  InferenceError,
  GenerationError,
  AssemblyError,
  isTransformationError,
  isValidationError,
  isAnalysisError,
  isInferenceError,
  isGenerationError,
  isAssemblyError,
  getErrorPhase,
  formatTransformationError
} from '../transformerErrors.js';

describe('TransformationError', () => {
  it('should create error with required fields', () => {
    const error = new TransformationError('Test error', 'validation');

    expect(error.message).toBe('Test error');
    expect(error.phase).toBe('validation');
    expect(error.name).toBe('TransformationError');
    expect(error.originalError).toBeUndefined();
    expect(error.context).toBeUndefined();
  });

  it('should create error with original error', () => {
    const originalError = new Error('Original error');
    const error = new TransformationError('Wrapped error', 'analysis', originalError);

    expect(error.message).toBe('Wrapped error');
    expect(error.phase).toBe('analysis');
    expect(error.originalError).toBe(originalError);
  });

  it('should create error with context', () => {
    const context = { componentName: 'Button', exampleIndex: 0 };
    const error = new TransformationError('Test error', 'inference', undefined, context);

    expect(error.context).toEqual(context);
    expect(error.context?.componentName).toBe('Button');
    expect(error.context?.exampleIndex).toBe(0);
  });

  it('should create error with all fields', () => {
    const originalError = new Error('Original');
    const context = { foo: 'bar' };
    const error = new TransformationError('Message', 'generation', originalError, context);

    expect(error.message).toBe('Message');
    expect(error.phase).toBe('generation');
    expect(error.originalError).toBe(originalError);
    expect(error.context).toEqual(context);
  });

  it('should have proper stack trace', () => {
    const error = new TransformationError('Test', 'validation');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('TransformationError');
  });
});

describe('ValidationError', () => {
  it('should create validation error', () => {
    const error = new ValidationError('Invalid input');

    expect(error.message).toBe('Invalid input');
    expect(error.phase).toBe('validation');
    expect(error.name).toBe('ValidationError');
  });

  it('should create validation error with original error', () => {
    const originalError = new Error('Zod error');
    const error = new ValidationError('Validation failed', originalError);

    expect(error.message).toBe('Validation failed');
    expect(error.originalError).toBe(originalError);
  });

  it('should create validation error with context', () => {
    const context = { field: 'code', value: '' };
    const error = new ValidationError('Code is empty', undefined, context);

    expect(error.context).toEqual(context);
  });

  it('should extend TransformationError', () => {
    const error = new ValidationError('Test');
    expect(error).toBeInstanceOf(TransformationError);
    expect(error).toBeInstanceOf(ValidationError);
  });
});

describe('AnalysisError', () => {
  it('should create analysis error', () => {
    const error = new AnalysisError('Analysis failed');

    expect(error.message).toBe('Analysis failed');
    expect(error.phase).toBe('analysis');
    expect(error.name).toBe('AnalysisError');
  });

  it('should extend TransformationError', () => {
    const error = new AnalysisError('Test');
    expect(error).toBeInstanceOf(TransformationError);
    expect(error).toBeInstanceOf(AnalysisError);
  });
});

describe('InferenceError', () => {
  it('should create inference error', () => {
    const error = new InferenceError('Inference failed');

    expect(error.message).toBe('Inference failed');
    expect(error.phase).toBe('inference');
    expect(error.name).toBe('InferenceError');
  });

  it('should extend TransformationError', () => {
    const error = new InferenceError('Test');
    expect(error).toBeInstanceOf(TransformationError);
    expect(error).toBeInstanceOf(InferenceError);
  });
});

describe('GenerationError', () => {
  it('should create generation error', () => {
    const error = new GenerationError('Generation failed');

    expect(error.message).toBe('Generation failed');
    expect(error.phase).toBe('generation');
    expect(error.name).toBe('GenerationError');
  });

  it('should extend TransformationError', () => {
    const error = new GenerationError('Test');
    expect(error).toBeInstanceOf(TransformationError);
    expect(error).toBeInstanceOf(GenerationError);
  });
});

describe('AssemblyError', () => {
  it('should create assembly error', () => {
    const error = new AssemblyError('Assembly failed');

    expect(error.message).toBe('Assembly failed');
    expect(error.phase).toBe('assembly');
    expect(error.name).toBe('AssemblyError');
  });

  it('should extend TransformationError', () => {
    const error = new AssemblyError('Test');
    expect(error).toBeInstanceOf(TransformationError);
    expect(error).toBeInstanceOf(AssemblyError);
  });
});

describe('Type Guards', () => {
  describe('isTransformationError', () => {
    it('should return true for TransformationError', () => {
      const error = new TransformationError('Test', 'validation');
      expect(isTransformationError(error)).toBe(true);
    });

    it('should return true for subclass errors', () => {
      expect(isTransformationError(new ValidationError('Test'))).toBe(true);
      expect(isTransformationError(new AnalysisError('Test'))).toBe(true);
      expect(isTransformationError(new InferenceError('Test'))).toBe(true);
      expect(isTransformationError(new GenerationError('Test'))).toBe(true);
      expect(isTransformationError(new AssemblyError('Test'))).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');
      expect(isTransformationError(error)).toBe(false);
    });

    it('should return false for non-errors', () => {
      expect(isTransformationError('string')).toBe(false);
      expect(isTransformationError(123)).toBe(false);
      expect(isTransformationError(null)).toBe(false);
      expect(isTransformationError(undefined)).toBe(false);
      expect(isTransformationError({})).toBe(false);
    });

    it('should provide type narrowing', () => {
      const error: unknown = new TransformationError('Test', 'validation');

      if (isTransformationError(error)) {
        // TypeScript should know error is TransformationError
        expect(error.phase).toBe('validation');
      }
    });
  });

  describe('isValidationError', () => {
    it('should return true for ValidationError', () => {
      const error = new ValidationError('Test');
      expect(isValidationError(error)).toBe(true);
    });

    it('should return false for other TransformationErrors', () => {
      expect(isValidationError(new AnalysisError('Test'))).toBe(false);
      expect(isValidationError(new InferenceError('Test'))).toBe(false);
      expect(isValidationError(new GenerationError('Test'))).toBe(false);
      expect(isValidationError(new AssemblyError('Test'))).toBe(false);
    });

    it('should return false for regular Error', () => {
      expect(isValidationError(new Error('Test'))).toBe(false);
    });
  });

  describe('isAnalysisError', () => {
    it('should return true for AnalysisError', () => {
      const error = new AnalysisError('Test');
      expect(isAnalysisError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isAnalysisError(new ValidationError('Test'))).toBe(false);
      expect(isAnalysisError(new InferenceError('Test'))).toBe(false);
    });
  });

  describe('isInferenceError', () => {
    it('should return true for InferenceError', () => {
      const error = new InferenceError('Test');
      expect(isInferenceError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isInferenceError(new ValidationError('Test'))).toBe(false);
      expect(isInferenceError(new AnalysisError('Test'))).toBe(false);
    });
  });

  describe('isGenerationError', () => {
    it('should return true for GenerationError', () => {
      const error = new GenerationError('Test');
      expect(isGenerationError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isGenerationError(new ValidationError('Test'))).toBe(false);
      expect(isGenerationError(new AnalysisError('Test'))).toBe(false);
    });
  });

  describe('isAssemblyError', () => {
    it('should return true for AssemblyError', () => {
      const error = new AssemblyError('Test');
      expect(isAssemblyError(error)).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isAssemblyError(new ValidationError('Test'))).toBe(false);
      expect(isAssemblyError(new AnalysisError('Test'))).toBe(false);
    });
  });
});

describe('getErrorPhase', () => {
  it('should return phase for TransformationError', () => {
    const error = new TransformationError('Test', 'analysis');
    expect(getErrorPhase(error)).toBe('analysis');
  });

  it('should return phase for ValidationError', () => {
    const error = new ValidationError('Test');
    expect(getErrorPhase(error)).toBe('validation');
  });

  it('should return phase for all error types', () => {
    expect(getErrorPhase(new ValidationError('Test'))).toBe('validation');
    expect(getErrorPhase(new AnalysisError('Test'))).toBe('analysis');
    expect(getErrorPhase(new InferenceError('Test'))).toBe('inference');
    expect(getErrorPhase(new GenerationError('Test'))).toBe('generation');
    expect(getErrorPhase(new AssemblyError('Test'))).toBe('assembly');
  });

  it('should return undefined for regular Error', () => {
    const error = new Error('Regular error');
    expect(getErrorPhase(error)).toBeUndefined();
  });

  it('should return undefined for non-errors', () => {
    expect(getErrorPhase('string')).toBeUndefined();
    expect(getErrorPhase(null)).toBeUndefined();
    expect(getErrorPhase(undefined)).toBeUndefined();
  });
});

describe('formatTransformationError', () => {
  it('should format simple error', () => {
    const error = new ValidationError('Invalid code');
    const formatted = formatTransformationError(error);

    expect(formatted).toContain('ValidationError');
    expect(formatted).toContain('Invalid code');
    expect(formatted).toContain('[validation]');
  });

  it('should include original error message', () => {
    const originalError = new Error('Original message');
    const error = new ValidationError('Wrapped', originalError);
    const formatted = formatTransformationError(error);

    expect(formatted).toContain('Wrapped');
    expect(formatted).toContain('Original message');
  });

  it('should include context if present', () => {
    const context = { componentName: 'Button', exampleIndex: 0 };
    const error = new ValidationError('Test', undefined, context);
    const formatted = formatTransformationError(error);

    expect(formatted).toContain('Button');
    expect(formatted).toContain('exampleIndex');
  });

  it('should handle error without context', () => {
    const error = new AnalysisError('No context');
    const formatted = formatTransformationError(error);

    expect(formatted).toContain('AnalysisError');
    expect(formatted).toContain('No context');
    expect(formatted).not.toContain('Context:');
  });

  it('should format all error types correctly', () => {
    const errors = [
      new ValidationError('Val error'),
      new AnalysisError('Ana error'),
      new InferenceError('Inf error'),
      new GenerationError('Gen error'),
      new AssemblyError('Asm error')
    ];

    errors.forEach(error => {
      const formatted = formatTransformationError(error);
      expect(formatted).toContain(error.name);
      expect(formatted).toContain(error.message);
      expect(formatted).toContain(`[${error.phase}]`);
    });
  });

  it('should handle regular Error gracefully', () => {
    const error = new Error('Regular error');
    const formatted = formatTransformationError(error);

    expect(formatted).toContain('Error');
    expect(formatted).toContain('Regular error');
  });
});

describe('Error chaining', () => {
  it('should preserve error chain', () => {
    const rootError = new Error('Root cause');
    const analysisError = new AnalysisError('Analysis failed', rootError);
    const validationError = new ValidationError('Validation failed', analysisError);

    expect(validationError.originalError).toBe(analysisError);
    expect(analysisError.originalError).toBe(rootError);
  });

  it('should format nested errors', () => {
    const rootError = new Error('Root cause');
    const wrappedError = new AnalysisError('Wrapped', rootError);
    const formatted = formatTransformationError(wrappedError);

    expect(formatted).toContain('Wrapped');
    expect(formatted).toContain('Root cause');
  });
});

describe('Context preservation', () => {
  it('should preserve complex context objects', () => {
    const context = {
      componentName: 'Button',
      exampleIndex: 5,
      code: '<Button>Test</Button>',
      metadata: { score: 80, complexity: 'basic' }
    };

    const error = new ValidationError('Test', undefined, context);

    expect(error.context).toEqual(context);
    expect(error.context?.componentName).toBe('Button');
    expect(error.context?.metadata).toEqual({ score: 80, complexity: 'basic' });
  });

  it('should handle undefined context gracefully', () => {
    const error = new ValidationError('Test', undefined, undefined);
    expect(error.context).toBeUndefined();
  });
});
