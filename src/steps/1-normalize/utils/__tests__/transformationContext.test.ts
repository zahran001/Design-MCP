import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createContext,
  addWarning,
  recordMetric,
  addPatternMatch,
  recordConfidence,
  getTotalTime,
  getContextId,
  hasWarnings,
  getWarningsForPhase,
  createSummary,
  measureTime,
  measureTimeAsync,
  setCustomData,
  getCustomData,
  type TransformationContext
} from '../transformationContext.js';

describe('createContext', () => {
  it('should create context with componentName only', () => {
    const ctx = createContext('Button');

    expect(ctx.componentName).toBe('Button');
    expect(ctx.exampleIndex).toBeUndefined();
    expect(ctx.totalExamples).toBeUndefined();
    expect(ctx.startTime).toBeLessThanOrEqual(Date.now());
    expect(ctx.warnings).toEqual([]);
    expect(ctx.metrics.patternMatches).toEqual([]);
  });

  it('should create context with exampleIndex', () => {
    const ctx = createContext('Button', 5);

    expect(ctx.componentName).toBe('Button');
    expect(ctx.exampleIndex).toBe(5);
    expect(ctx.totalExamples).toBeUndefined();
  });

  it('should create context with exampleIndex and totalExamples', () => {
    const ctx = createContext('Button', 5, 16);

    expect(ctx.componentName).toBe('Button');
    expect(ctx.exampleIndex).toBe(5);
    expect(ctx.totalExamples).toBe(16);
  });

  it('should initialize metrics correctly', () => {
    const ctx = createContext('Button');

    expect(ctx.metrics.patternMatches).toEqual([]);
    expect(ctx.metrics.analysisTimeMs).toBeUndefined();
    expect(ctx.metrics.inferenceTimeMs).toBeUndefined();
    expect(ctx.metrics.generationTimeMs).toBeUndefined();
    expect(ctx.metrics.tokenCount).toBeUndefined();
    expect(ctx.metrics.confidenceScores).toBeUndefined();
  });

  it('should have recent startTime', () => {
    const before = Date.now();
    const ctx = createContext('Button');
    const after = Date.now();

    expect(ctx.startTime).toBeGreaterThanOrEqual(before);
    expect(ctx.startTime).toBeLessThanOrEqual(after);
  });
});

describe('addWarning', () => {
  let ctx: TransformationContext;

  beforeEach(() => {
    ctx = createContext('Button');
  });

  it('should add warning with phase and message', () => {
    addWarning(ctx, 'validation', 'Test warning');

    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0].phase).toBe('validation');
    expect(ctx.warnings[0].message).toBe('Test warning');
  });

  it('should add warning with context', () => {
    const warningContext = { code: '<Button>', error: 'Empty code' };
    addWarning(ctx, 'validation', 'Invalid input', warningContext);

    expect(ctx.warnings).toHaveLength(1);
    expect(ctx.warnings[0].context).toEqual(warningContext);
  });

  it('should add multiple warnings', () => {
    addWarning(ctx, 'validation', 'Warning 1');
    addWarning(ctx, 'analysis', 'Warning 2');
    addWarning(ctx, 'inference', 'Warning 3');

    expect(ctx.warnings).toHaveLength(3);
    expect(ctx.warnings[0].message).toBe('Warning 1');
    expect(ctx.warnings[1].message).toBe('Warning 2');
    expect(ctx.warnings[2].message).toBe('Warning 3');
  });

  it('should add timestamp to warnings', () => {
    const before = Date.now();
    addWarning(ctx, 'validation', 'Test');
    const after = Date.now();

    expect(ctx.warnings[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(ctx.warnings[0].timestamp).toBeLessThanOrEqual(after);
  });

  it('should handle all transformation phases', () => {
    addWarning(ctx, 'validation', 'Val warning');
    addWarning(ctx, 'analysis', 'Ana warning');
    addWarning(ctx, 'inference', 'Inf warning');
    addWarning(ctx, 'generation', 'Gen warning');
    addWarning(ctx, 'assembly', 'Asm warning');

    expect(ctx.warnings).toHaveLength(5);
    expect(ctx.warnings[0].phase).toBe('validation');
    expect(ctx.warnings[1].phase).toBe('analysis');
    expect(ctx.warnings[2].phase).toBe('inference');
    expect(ctx.warnings[3].phase).toBe('generation');
    expect(ctx.warnings[4].phase).toBe('assembly');
  });
});

describe('recordMetric', () => {
  let ctx: TransformationContext;

  beforeEach(() => {
    ctx = createContext('Button');
  });

  it('should record analysisTimeMs', () => {
    recordMetric(ctx, 'analysisTimeMs', 15);

    expect(ctx.metrics.analysisTimeMs).toBe(15);
  });

  it('should record inferenceTimeMs', () => {
    recordMetric(ctx, 'inferenceTimeMs', 25);

    expect(ctx.metrics.inferenceTimeMs).toBe(25);
  });

  it('should record generationTimeMs', () => {
    recordMetric(ctx, 'generationTimeMs', 35);

    expect(ctx.metrics.generationTimeMs).toBe(35);
  });

  it('should record tokenCount', () => {
    recordMetric(ctx, 'tokenCount', 320);

    expect(ctx.metrics.tokenCount).toBe(320);
  });

  it('should record multiple metrics', () => {
    recordMetric(ctx, 'analysisTimeMs', 10);
    recordMetric(ctx, 'inferenceTimeMs', 20);
    recordMetric(ctx, 'tokenCount', 300);

    expect(ctx.metrics.analysisTimeMs).toBe(10);
    expect(ctx.metrics.inferenceTimeMs).toBe(20);
    expect(ctx.metrics.tokenCount).toBe(300);
  });

  it('should overwrite previous metric values', () => {
    recordMetric(ctx, 'analysisTimeMs', 10);
    recordMetric(ctx, 'analysisTimeMs', 15);

    expect(ctx.metrics.analysisTimeMs).toBe(15);
  });
});

describe('addPatternMatch', () => {
  let ctx: TransformationContext;

  beforeEach(() => {
    ctx = createContext('Button');
  });

  it('should add pattern match', () => {
    addPatternMatch(ctx, 'multiple_size_values');

    expect(ctx.metrics.patternMatches).toContain('multiple_size_values');
  });

  it('should add multiple pattern matches', () => {
    addPatternMatch(ctx, 'pattern_1');
    addPatternMatch(ctx, 'pattern_2');
    addPatternMatch(ctx, 'pattern_3');

    expect(ctx.metrics.patternMatches).toEqual(['pattern_1', 'pattern_2', 'pattern_3']);
  });

  it('should preserve order of pattern matches', () => {
    addPatternMatch(ctx, 'first');
    addPatternMatch(ctx, 'second');
    addPatternMatch(ctx, 'third');

    expect(ctx.metrics.patternMatches[0]).toBe('first');
    expect(ctx.metrics.patternMatches[1]).toBe('second');
    expect(ctx.metrics.patternMatches[2]).toBe('third');
  });
});

describe('recordConfidence', () => {
  let ctx: TransformationContext;

  beforeEach(() => {
    ctx = createContext('Button');
  });

  it('should record section confidence', () => {
    recordConfidence(ctx, 'section', 0.85);

    expect(ctx.metrics.confidenceScores?.section).toBe(0.85);
  });

  it('should record intent confidence', () => {
    recordConfidence(ctx, 'intent', 0.92);

    expect(ctx.metrics.confidenceScores?.intent).toBe(0.92);
  });

  it('should record both confidence scores', () => {
    recordConfidence(ctx, 'section', 0.75);
    recordConfidence(ctx, 'intent', 0.88);

    expect(ctx.metrics.confidenceScores?.section).toBe(0.75);
    expect(ctx.metrics.confidenceScores?.intent).toBe(0.88);
  });

  it('should initialize confidenceScores if undefined', () => {
    expect(ctx.metrics.confidenceScores).toBeUndefined();
    recordConfidence(ctx, 'section', 0.5);
    expect(ctx.metrics.confidenceScores).toBeDefined();
  });

  it('should overwrite previous confidence scores', () => {
    recordConfidence(ctx, 'section', 0.5);
    recordConfidence(ctx, 'section', 0.9);

    expect(ctx.metrics.confidenceScores?.section).toBe(0.9);
  });
});

describe('getTotalTime', () => {
  it('should return elapsed time since context creation', async () => {
    const ctx = createContext('Button');

    // Wait at least 10ms
    await new Promise(resolve => setTimeout(resolve, 10));

    const totalTime = getTotalTime(ctx);

    expect(totalTime).toBeGreaterThanOrEqual(10);
    expect(totalTime).toBeLessThan(1000); // Should be less than 1 second
  });

  it('should return 0 or very small value immediately after creation', () => {
    const ctx = createContext('Button');
    const totalTime = getTotalTime(ctx);

    expect(totalTime).toBeLessThan(10); // Should be less than 10ms
  });
});

describe('getContextId', () => {
  it('should return componentName only when no example info', () => {
    const ctx = createContext('Button');

    expect(getContextId(ctx)).toBe('Button');
  });

  it('should return full identifier with example info', () => {
    const ctx = createContext('Button', 5, 16);

    expect(getContextId(ctx)).toBe('Button example 5/16');
  });

  it('should handle first example', () => {
    const ctx = createContext('Input', 1, 10);

    expect(getContextId(ctx)).toBe('Input example 1/10');
  });

  it('should handle last example', () => {
    const ctx = createContext('Input', 10, 10);

    expect(getContextId(ctx)).toBe('Input example 10/10');
  });

  it('should return componentName when only exampleIndex is set', () => {
    const ctx = createContext('Button', 5, undefined);

    expect(getContextId(ctx)).toBe('Button');
  });
});

describe('hasWarnings', () => {
  it('should return false when no warnings', () => {
    const ctx = createContext('Button');

    expect(hasWarnings(ctx)).toBe(false);
  });

  it('should return true when warnings exist', () => {
    const ctx = createContext('Button');
    addWarning(ctx, 'validation', 'Test warning');

    expect(hasWarnings(ctx)).toBe(true);
  });

  it('should return true even with single warning', () => {
    const ctx = createContext('Button');
    addWarning(ctx, 'analysis', 'Single warning');

    expect(hasWarnings(ctx)).toBe(true);
  });
});

describe('getWarningsForPhase', () => {
  let ctx: TransformationContext;

  beforeEach(() => {
    ctx = createContext('Button');
    addWarning(ctx, 'validation', 'Val warning 1');
    addWarning(ctx, 'validation', 'Val warning 2');
    addWarning(ctx, 'analysis', 'Ana warning');
    addWarning(ctx, 'inference', 'Inf warning');
  });

  it('should return warnings for validation phase', () => {
    const warnings = getWarningsForPhase(ctx, 'validation');

    expect(warnings).toHaveLength(2);
    expect(warnings[0].message).toBe('Val warning 1');
    expect(warnings[1].message).toBe('Val warning 2');
  });

  it('should return warnings for analysis phase', () => {
    const warnings = getWarningsForPhase(ctx, 'analysis');

    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toBe('Ana warning');
  });

  it('should return empty array for phase with no warnings', () => {
    const warnings = getWarningsForPhase(ctx, 'generation');

    expect(warnings).toEqual([]);
  });

  it('should not modify original warnings array', () => {
    const originalCount = ctx.warnings.length;
    getWarningsForPhase(ctx, 'validation');

    expect(ctx.warnings).toHaveLength(originalCount);
  });
});

describe('createSummary', () => {
  it('should create summary with all context info', () => {
    const ctx = createContext('Button', 5, 16);
    addWarning(ctx, 'validation', 'Warning 1');
    addWarning(ctx, 'analysis', 'Warning 2');
    recordMetric(ctx, 'analysisTimeMs', 15);
    recordMetric(ctx, 'tokenCount', 300);
    addPatternMatch(ctx, 'pattern_1');

    const summary = createSummary(ctx);

    expect(summary.contextId).toBe('Button example 5/16');
    expect(summary.warnings).toBe(2);
    expect(summary.metrics.analysisTimeMs).toBe(15);
    expect(summary.metrics.tokenCount).toBe(300);
    expect(summary.metrics.patternMatches).toContain('pattern_1');
  });

  it('should include totalTimeMs', () => {
    const ctx = createContext('Button');
    const summary = createSummary(ctx);

    expect(summary.totalTimeMs).toBeGreaterThanOrEqual(0);
    expect(summary.totalTimeMs).toBeLessThan(100);
  });

  it('should handle context with no warnings', () => {
    const ctx = createContext('Button');
    const summary = createSummary(ctx);

    expect(summary.warnings).toBe(0);
  });
});

describe('measureTime', () => {
  it('should measure execution time and record metric', () => {
    const ctx = createContext('Button');

    const result = measureTime(ctx, 'analysisTimeMs', () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
      return sum;
    });

    expect(result).toBe(499500); // Sum of 0 to 999
    expect(ctx.metrics.analysisTimeMs).toBeGreaterThanOrEqual(0);
    expect(ctx.metrics.analysisTimeMs).toBeLessThan(100); // Should be very fast
  });

  it('should return function result', () => {
    const ctx = createContext('Button');

    const result = measureTime(ctx, 'analysisTimeMs', () => {
      return { data: 'test' };
    });

    expect(result).toEqual({ data: 'test' });
  });

  it('should record different metrics', () => {
    const ctx = createContext('Button');

    measureTime(ctx, 'analysisTimeMs', () => 'analysis');
    measureTime(ctx, 'inferenceTimeMs', () => 'inference');
    measureTime(ctx, 'generationTimeMs', () => 'generation');

    expect(ctx.metrics.analysisTimeMs).toBeGreaterThanOrEqual(0);
    expect(ctx.metrics.inferenceTimeMs).toBeGreaterThanOrEqual(0);
    expect(ctx.metrics.generationTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should preserve thrown errors', () => {
    const ctx = createContext('Button');

    expect(() => {
      measureTime(ctx, 'analysisTimeMs', () => {
        throw new Error('Test error');
      });
    }).toThrow('Test error');
  });
});

describe('measureTimeAsync', () => {
  it('should measure async execution time and record metric', async () => {
    const ctx = createContext('Button');

    const result = await measureTimeAsync(ctx, 'analysisTimeMs', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'done';
    });

    expect(result).toBe('done');
    expect(ctx.metrics.analysisTimeMs).toBeGreaterThanOrEqual(10);
    expect(ctx.metrics.analysisTimeMs).toBeLessThan(100);
  });

  it('should return async function result', async () => {
    const ctx = createContext('Button');

    const result = await measureTimeAsync(ctx, 'inferenceTimeMs', async () => {
      return { async: true };
    });

    expect(result).toEqual({ async: true });
  });

  it('should preserve rejected promises', async () => {
    const ctx = createContext('Button');

    await expect(
      measureTimeAsync(ctx, 'analysisTimeMs', async () => {
        throw new Error('Async error');
      })
    ).rejects.toThrow('Async error');
  });

  it('should record metric even if promise rejects', async () => {
    const ctx = createContext('Button');

    try {
      await measureTimeAsync(ctx, 'analysisTimeMs', async () => {
        await new Promise(resolve => setTimeout(resolve, 5));
        throw new Error('Test');
      });
    } catch (error) {
      // Expected error
    }

    // Metric should still be recorded
    expect(ctx.metrics.analysisTimeMs).toBeGreaterThanOrEqual(5);
  });
});

describe('setCustomData and getCustomData', () => {
  let ctx: TransformationContext;

  beforeEach(() => {
    ctx = createContext('Button');
  });

  it('should set and get custom string data', () => {
    setCustomData(ctx, 'testKey', 'testValue');

    expect(getCustomData(ctx, 'testKey')).toBe('testValue');
  });

  it('should set and get custom number data', () => {
    setCustomData(ctx, 'count', 42);

    expect(getCustomData<number>(ctx, 'count')).toBe(42);
  });

  it('should set and get custom object data', () => {
    const data = { nested: { value: 'test' } };
    setCustomData(ctx, 'config', data);

    expect(getCustomData(ctx, 'config')).toEqual(data);
  });

  it('should return undefined for non-existent keys', () => {
    expect(getCustomData(ctx, 'nonExistent')).toBeUndefined();
  });

  it('should initialize customData on first set', () => {
    expect(ctx.customData).toBeUndefined();
    setCustomData(ctx, 'key', 'value');
    expect(ctx.customData).toBeDefined();
  });

  it('should store multiple custom data entries', () => {
    setCustomData(ctx, 'key1', 'value1');
    setCustomData(ctx, 'key2', 'value2');
    setCustomData(ctx, 'key3', 'value3');

    expect(getCustomData(ctx, 'key1')).toBe('value1');
    expect(getCustomData(ctx, 'key2')).toBe('value2');
    expect(getCustomData(ctx, 'key3')).toBe('value3');
  });

  it('should overwrite existing keys', () => {
    setCustomData(ctx, 'key', 'original');
    setCustomData(ctx, 'key', 'updated');

    expect(getCustomData(ctx, 'key')).toBe('updated');
  });

  it('should handle null and undefined values', () => {
    setCustomData(ctx, 'nullKey', null);
    setCustomData(ctx, 'undefinedKey', undefined);

    expect(getCustomData(ctx, 'nullKey')).toBeNull();
    expect(getCustomData(ctx, 'undefinedKey')).toBeUndefined();
  });
});

describe('Integration tests', () => {
  it('should track complete transformation flow', async () => {
    const ctx = createContext('Button', 1, 5);

    // Analysis phase
    measureTime(ctx, 'analysisTimeMs', () => {
      addPatternMatch(ctx, 'has_size_prop');
      addPatternMatch(ctx, 'has_variant_prop');
    });

    // Inference phase with warning
    measureTime(ctx, 'inferenceTimeMs', () => {
      recordConfidence(ctx, 'section', 0.55);
      addWarning(ctx, 'inference', 'Low confidence', { confidence: 0.55 });
    });

    // Generation phase
    await measureTimeAsync(ctx, 'generationTimeMs', async () => {
      recordMetric(ctx, 'tokenCount', 350);
      await new Promise(resolve => setTimeout(resolve, 5));
    });

    // Verify complete context
    expect(ctx.metrics.analysisTimeMs).toBeGreaterThanOrEqual(0);
    expect(ctx.metrics.inferenceTimeMs).toBeGreaterThanOrEqual(0);
    expect(ctx.metrics.generationTimeMs).toBeGreaterThanOrEqual(5);
    expect(ctx.metrics.tokenCount).toBe(350);
    expect(ctx.metrics.patternMatches).toHaveLength(2);
    expect(ctx.metrics.confidenceScores?.section).toBe(0.55);
    expect(ctx.warnings).toHaveLength(1);

    const summary = createSummary(ctx);
    expect(summary.contextId).toBe('Button example 1/5');
    expect(summary.warnings).toBe(1);
  });
});
