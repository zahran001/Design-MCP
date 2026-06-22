import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import {
  getMetricsLogPath,
  getErrorLogPath,
  ensureLogDirectories,
  createMetricsEntry,
  writeMetricsToFile,
  writeErrorToFile,
  logSuccess,
  logFailure,
  formatWarnings,
  formatMetricsSummary,
  readAllMetrics,
  getMetricsSummary,
  clearMetricsLog,
  clearErrorLog,
  resetMetricsState,
  type MetricsLogEntry
} from '../transformationMetrics.js';
import {
  createContext,
  addWarning,
  recordMetric,
  addPatternMatch,
  recordConfidence
} from '../transformationContext.js';

// Global test suite setup - clear state before and after all tests
beforeAll(() => {
  resetMetricsState();
});

afterAll(() => {
  resetMetricsState();
});

describe('Path Functions', () => {
  it('should return metrics log path', () => {
    const logPath = getMetricsLogPath();

    expect(logPath).toContain('transformation-metrics.jsonl');
    expect(path.isAbsolute(logPath)).toBe(true);
  });

  it('should return error log path', () => {
    const logPath = getErrorLogPath();

    expect(logPath).toContain('transformation-errors.log');
    expect(path.isAbsolute(logPath)).toBe(true);
  });
});

describe('ensureLogDirectories', () => {
  it('should create directories if they don\'t exist', () => {
    ensureLogDirectories();

    const metricsDir = path.dirname(getMetricsLogPath());
    const errorDir = path.dirname(getErrorLogPath());

    expect(fs.existsSync(metricsDir)).toBe(true);
    expect(fs.existsSync(errorDir)).toBe(true);
  });

  it('should not fail if directories already exist', () => {
    ensureLogDirectories();
    ensureLogDirectories(); // Call again

    const metricsDir = path.dirname(getMetricsLogPath());
    expect(fs.existsSync(metricsDir)).toBe(true);
  });
});

describe('createMetricsEntry', () => {
  it('should create success metrics entry', () => {
    const ctx = createContext('Button', 1, 5);
    recordMetric(ctx, 'analysisTimeMs', 15);
    recordMetric(ctx, 'tokenCount', 300);
    addPatternMatch(ctx, 'pattern_1');

    const entry = createMetricsEntry(ctx, 'success');

    expect(entry.status).toBe('success');
    expect(entry.componentName).toBe('Button');
    expect(entry.exampleIndex).toBe(1);
    expect(entry.timings?.analysisTimeMs).toBe(15);
    expect(entry.tokenCount).toBe(300);
    expect(entry.patternMatches).toContain('pattern_1');
    expect(entry.warningCount).toBe(0);
    expect(entry.errorMessage).toBeUndefined();
  });

  it('should create failure metrics entry', () => {
    const ctx = createContext('Button');
    const error = new Error('Test error');
    (error as any).phase = 'analysis';

    const entry = createMetricsEntry(ctx, 'failure', error);

    expect(entry.status).toBe('failure');
    expect(entry.errorMessage).toBe('Test error');
    expect(entry.errorPhase).toBe('analysis');
  });

  it('should include warnings in entry', () => {
    const ctx = createContext('Button');
    addWarning(ctx, 'inference', 'Low confidence', { confidence: 0.5 });
    addWarning(ctx, 'generation', 'Token limit reached');

    const entry = createMetricsEntry(ctx, 'success');

    expect(entry.warningCount).toBe(2);
    expect(entry.warnings).toHaveLength(2);
    expect(entry.warnings![0].phase).toBe('inference');
    expect(entry.warnings![0].message).toBe('Low confidence');
    expect(entry.warnings![1].phase).toBe('generation');
  });

  it('should include confidence scores', () => {
    const ctx = createContext('Button');
    recordConfidence(ctx, 'section', 0.85);
    recordConfidence(ctx, 'intent', 0.92);

    const entry = createMetricsEntry(ctx, 'success');

    expect(entry.confidenceScores?.section).toBe(0.85);
    expect(entry.confidenceScores?.intent).toBe(0.92);
  });

  it('should include timestamp', () => {
    const ctx = createContext('Button');
    const before = new Date().toISOString();
    const entry = createMetricsEntry(ctx, 'success');
    const after = new Date().toISOString();

    expect(entry.timestamp).toBeDefined();
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
    expect(entry.timestamp >= before).toBe(true);
    expect(entry.timestamp <= after).toBe(true);
  });

  it('should calculate totalTimeMs', () => {
    const ctx = createContext('Button');
    const entry = createMetricsEntry(ctx, 'success');

    expect(entry.totalTimeMs).toBeGreaterThanOrEqual(0);
    expect(entry.totalTimeMs).toBeLessThan(100);
  });
});

describe('writeMetricsToFile', () => {
  beforeEach(() => {
    resetMetricsState();
  });

  afterEach(() => {
    try {
      clearMetricsLog();
      clearErrorLog();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should write metrics entry to file', () => {
    const ctx = createContext('Button');
    const entry = createMetricsEntry(ctx, 'success');

    writeMetricsToFile(entry);

    const logPath = getMetricsLogPath();
    expect(fs.existsSync(logPath)).toBe(true);

    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('Button');
    expect(content).toContain('success');
  });

  it('should append multiple entries', () => {
    const ctx1 = createContext('Button');
    const ctx2 = createContext('Input');

    writeMetricsToFile(createMetricsEntry(ctx1, 'success'));
    writeMetricsToFile(createMetricsEntry(ctx2, 'success'));

    const content = fs.readFileSync(getMetricsLogPath(), 'utf-8');
    const lines = content.trim().split('\n');

    expect(lines).toHaveLength(2);
  });

  it('should write valid JSON lines', () => {
    const ctx = createContext('Button');
    writeMetricsToFile(createMetricsEntry(ctx, 'success'));

    const content = fs.readFileSync(getMetricsLogPath(), 'utf-8');
    const parsed = JSON.parse(content.trim());

    expect(parsed.componentName).toBe('Button');
    expect(parsed.status).toBe('success');
  });
});

describe('writeErrorToFile', () => {
  beforeEach(() => {
    resetMetricsState();
  });

  afterEach(() => {
    try {
      clearMetricsLog();
      clearErrorLog();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should write error to file', () => {
    const ctx = createContext('Button', 1, 5);
    const error = new Error('Test error');

    writeErrorToFile(ctx, error);

    const logPath = getErrorLogPath();
    expect(fs.existsSync(logPath)).toBe(true);

    const content = fs.readFileSync(logPath, 'utf-8');
    expect(content).toContain('Button example 1/5');
    expect(content).toContain('Test error');
  });

  it('should append multiple errors', () => {
    const ctx1 = createContext('Button');
    const ctx2 = createContext('Input');

    writeErrorToFile(ctx1, new Error('Error 1'));
    writeErrorToFile(ctx2, new Error('Error 2'));

    const content = fs.readFileSync(getErrorLogPath(), 'utf-8');

    expect(content).toContain('Error 1');
    expect(content).toContain('Error 2');
  });

  it('should include stack trace when configured', () => {
    const ctx = createContext('Button');
    const error = new Error('Error with stack');

    writeErrorToFile(ctx, error);

    const content = fs.readFileSync(getErrorLogPath(), 'utf-8');
    // Stack trace should be included
    expect(content.length).toBeGreaterThan(50);
  });
});

describe('logSuccess and logFailure', () => {
  beforeEach(() => {
    resetMetricsState();

    // Verify clean state
    const metrics = readAllMetrics();
    if (metrics.length !== 0) {
      clearMetricsLog();
      ensureLogDirectories();
    }
  });

  afterEach(() => {
    try {
      clearMetricsLog();
      clearErrorLog();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should log success', () => {
    const ctx = createContext('Button');
    recordMetric(ctx, 'analysisTimeMs', 15);

    logSuccess(ctx);

    // Check metrics file
    const metrics = readAllMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0].status).toBe('success');
    expect(metrics[0].componentName).toBe('Button');
  });

  it('should log failure', () => {
    const ctx = createContext('Button');
    const error = new Error('Analysis failed');
    (error as any).phase = 'analysis';

    logFailure(ctx, error);

    // Check metrics file
    const metrics = readAllMetrics();
    expect(metrics).toHaveLength(1);
    expect(metrics[0].status).toBe('failure');
    expect(metrics[0].errorMessage).toBe('Analysis failed');

    // Check error file
    const errorContent = fs.readFileSync(getErrorLogPath(), 'utf-8');
    expect(errorContent).toContain('Analysis failed');
  });
});

describe('formatWarnings', () => {
  it('should format no warnings', () => {
    const ctx = createContext('Button');
    const formatted = formatWarnings(ctx.warnings);

    expect(formatted).toBe('No warnings');
  });

  it('should format single warning', () => {
    const ctx = createContext('Button');
    addWarning(ctx, 'inference', 'Low confidence');

    const formatted = formatWarnings(ctx.warnings);

    expect(formatted).toContain('[inference]');
    expect(formatted).toContain('Low confidence');
  });

  it('should format multiple warnings', () => {
    const ctx = createContext('Button');
    addWarning(ctx, 'validation', 'Warning 1');
    addWarning(ctx, 'analysis', 'Warning 2');

    const formatted = formatWarnings(ctx.warnings);

    expect(formatted).toContain('[validation] Warning 1');
    expect(formatted).toContain('[analysis] Warning 2');
  });
});

describe('formatMetricsSummary', () => {
  it('should format basic context', () => {
    const ctx = createContext('Button');
    const formatted = formatMetricsSummary(ctx);

    expect(formatted).toContain('Context: Button');
    expect(formatted).toContain('Total Time:');
    expect(formatted).toContain('Warnings: 0');
  });

  it('should format context with example info', () => {
    const ctx = createContext('Button', 5, 16);
    const formatted = formatMetricsSummary(ctx);

    expect(formatted).toContain('Button example 5/16');
  });

  it('should include timing metrics', () => {
    const ctx = createContext('Button');
    recordMetric(ctx, 'analysisTimeMs', 15);
    recordMetric(ctx, 'inferenceTimeMs', 25);
    recordMetric(ctx, 'generationTimeMs', 35);

    const formatted = formatMetricsSummary(ctx);

    expect(formatted).toContain('Analysis: 15ms');
    expect(formatted).toContain('Inference: 25ms');
    expect(formatted).toContain('Generation: 35ms');
  });

  it('should include token count', () => {
    const ctx = createContext('Button');
    recordMetric(ctx, 'tokenCount', 350);

    const formatted = formatMetricsSummary(ctx);

    expect(formatted).toContain('Tokens: 350');
  });

  it('should include pattern matches', () => {
    const ctx = createContext('Button');
    addPatternMatch(ctx, 'pattern_1');
    addPatternMatch(ctx, 'pattern_2');

    const formatted = formatMetricsSummary(ctx);

    expect(formatted).toContain('Patterns: pattern_1, pattern_2');
  });

  it('should include confidence scores', () => {
    const ctx = createContext('Button');
    recordConfidence(ctx, 'section', 0.85);
    recordConfidence(ctx, 'intent', 0.92);

    const formatted = formatMetricsSummary(ctx);

    expect(formatted).toContain('Section Confidence: 85.0%');
    expect(formatted).toContain('Intent Confidence: 92.0%');
  });

  it('should include warning count', () => {
    const ctx = createContext('Button');
    addWarning(ctx, 'inference', 'Warning 1');
    addWarning(ctx, 'generation', 'Warning 2');

    const formatted = formatMetricsSummary(ctx);

    expect(formatted).toContain('Warnings: 2');
  });
});

describe('readAllMetrics', () => {
  beforeEach(() => {
    resetMetricsState();
  });

  afterEach(() => {
    try {
      clearMetricsLog();
      clearErrorLog();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should return empty array when no metrics file', () => {
    const metrics = readAllMetrics();

    expect(metrics).toEqual([]);
  });

  it('should read all metrics entries', () => {
    const ctx1 = createContext('Button');
    const ctx2 = createContext('Input');
    const ctx3 = createContext('Stack');

    writeMetricsToFile(createMetricsEntry(ctx1, 'success'));
    writeMetricsToFile(createMetricsEntry(ctx2, 'success'));
    writeMetricsToFile(createMetricsEntry(ctx3, 'failure', new Error('Test')));

    const metrics = readAllMetrics();

    expect(metrics).toHaveLength(3);
    expect(metrics[0].componentName).toBe('Button');
    expect(metrics[1].componentName).toBe('Input');
    expect(metrics[2].componentName).toBe('Stack');
    expect(metrics[2].status).toBe('failure');
  });

  it('should parse JSONL format correctly', () => {
    const ctx = createContext('Button', 1, 5);
    recordMetric(ctx, 'tokenCount', 300);
    addPatternMatch(ctx, 'test_pattern');

    writeMetricsToFile(createMetricsEntry(ctx, 'success'));

    const metrics = readAllMetrics();

    expect(metrics[0].componentName).toBe('Button');
    expect(metrics[0].exampleIndex).toBe(1);
    expect(metrics[0].tokenCount).toBe(300);
    expect(metrics[0].patternMatches).toContain('test_pattern');
  });
});

describe('getMetricsSummary', () => {
  beforeEach(() => {
    resetMetricsState();
  });

  afterEach(() => {
    try {
      clearMetricsLog();
      clearErrorLog();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should return zeros when no metrics', () => {
    const summary = getMetricsSummary();

    expect(summary.totalTransformations).toBe(0);
    expect(summary.successCount).toBe(0);
    expect(summary.failureCount).toBe(0);
    expect(summary.averageTimeMs).toBe(0);
    expect(summary.totalWarnings).toBe(0);
    expect(summary.commonPatterns).toEqual([]);
  });

  it('should calculate success and failure counts', () => {
    const ctx1 = createContext('Button');
    const ctx2 = createContext('Input');
    const ctx3 = createContext('Stack');

    writeMetricsToFile(createMetricsEntry(ctx1, 'success'));
    writeMetricsToFile(createMetricsEntry(ctx2, 'success'));
    writeMetricsToFile(createMetricsEntry(ctx3, 'failure', new Error('Test')));

    const summary = getMetricsSummary();

    expect(summary.totalTransformations).toBe(3);
    expect(summary.successCount).toBe(2);
    expect(summary.failureCount).toBe(1);
  });

  it('should calculate average time', () => {
    // Create contexts with small delays to get measurable times
    const ctx1 = createContext('Button');
    const ctx2 = createContext('Input');

    writeMetricsToFile(createMetricsEntry(ctx1, 'success'));
    writeMetricsToFile(createMetricsEntry(ctx2, 'success'));

    const summary = getMetricsSummary();

    expect(summary.averageTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should count total warnings', () => {
    const ctx1 = createContext('Button');
    addWarning(ctx1, 'inference', 'Warning 1');
    addWarning(ctx1, 'generation', 'Warning 2');

    const ctx2 = createContext('Input');
    addWarning(ctx2, 'validation', 'Warning 3');

    writeMetricsToFile(createMetricsEntry(ctx1, 'success'));
    writeMetricsToFile(createMetricsEntry(ctx2, 'success'));

    const summary = getMetricsSummary();

    expect(summary.totalWarnings).toBe(3);
  });

  it('should identify common patterns', () => {
    const ctx1 = createContext('Button');
    addPatternMatch(ctx1, 'pattern_A');
    addPatternMatch(ctx1, 'pattern_B');

    const ctx2 = createContext('Input');
    addPatternMatch(ctx2, 'pattern_A');
    addPatternMatch(ctx2, 'pattern_C');

    const ctx3 = createContext('Stack');
    addPatternMatch(ctx3, 'pattern_A');

    writeMetricsToFile(createMetricsEntry(ctx1, 'success'));
    writeMetricsToFile(createMetricsEntry(ctx2, 'success'));
    writeMetricsToFile(createMetricsEntry(ctx3, 'success'));

    const summary = getMetricsSummary();

    // pattern_A should be most common (3 occurrences)
    expect(summary.commonPatterns[0]).toBe('pattern_A');
  });

  it('should limit common patterns to top 5', () => {
    const ctx = createContext('Button');
    for (let i = 0; i < 10; i++) {
      addPatternMatch(ctx, `pattern_${i}`);
    }

    writeMetricsToFile(createMetricsEntry(ctx, 'success'));

    const summary = getMetricsSummary();

    expect(summary.commonPatterns.length).toBeLessThanOrEqual(5);
  });
});

describe('clearMetricsLog and clearErrorLog', () => {
  it('should clear metrics log file', () => {
    ensureLogDirectories();
    const ctx = createContext('Button');
    writeMetricsToFile(createMetricsEntry(ctx, 'success'));

    expect(fs.existsSync(getMetricsLogPath())).toBe(true);

    clearMetricsLog();

    expect(fs.existsSync(getMetricsLogPath())).toBe(false);
  });

  it('should clear error log file', () => {
    ensureLogDirectories();
    const ctx = createContext('Button');
    writeErrorToFile(ctx, new Error('Test'));

    expect(fs.existsSync(getErrorLogPath())).toBe(true);

    clearErrorLog();

    expect(fs.existsSync(getErrorLogPath())).toBe(false);
  });

  it('should not fail if files don\'t exist', () => {
    clearMetricsLog();
    clearErrorLog();

    expect(fs.existsSync(getMetricsLogPath())).toBe(false);
    expect(fs.existsSync(getErrorLogPath())).toBe(false);
  });
});

describe('Integration tests', () => {
  beforeEach(() => {
    resetMetricsState();
  });

  afterEach(() => {
    try {
      clearMetricsLog();
      clearErrorLog();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should track multiple component transformations', () => {
    // Success transformation
    const ctx1 = createContext('Button', 1, 3);
    recordMetric(ctx1, 'analysisTimeMs', 15);
    recordMetric(ctx1, 'tokenCount', 250);
    addPatternMatch(ctx1, 'size_prop');
    logSuccess(ctx1);

    // Success with warning
    const ctx2 = createContext('Input', 2, 3);
    recordMetric(ctx2, 'analysisTimeMs', 20);
    addWarning(ctx2, 'inference', 'Low confidence');
    logSuccess(ctx2);

    // Failure
    const ctx3 = createContext('Stack', 3, 3);
    const error = new Error('Generation failed');
    (error as any).phase = 'generation';
    logFailure(ctx3, error);

    // Verify metrics file
    const metrics = readAllMetrics();
    expect(metrics).toHaveLength(3);

    // Verify summary
    const summary = getMetricsSummary();
    expect(summary.totalTransformations).toBe(3);
    expect(summary.successCount).toBe(2);
    expect(summary.failureCount).toBe(1);
    expect(summary.totalWarnings).toBe(1);
  });
});
