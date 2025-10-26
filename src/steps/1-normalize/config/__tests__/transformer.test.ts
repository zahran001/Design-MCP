import { describe, it, expect } from '@jest/globals';
import {
  TRANSFORMER_CONFIG,
  getConfigValue,
  isOptimalTokenCount,
  isAcceptableTokenCount,
  meetsConfidenceThreshold
} from '../transformer.config.js';

describe('transformer.config', () => {
  describe('TRANSFORMER_CONFIG', () => {
    it('should have version defined', () => {
      expect(TRANSFORMER_CONFIG.version).toBeDefined();
      expect(typeof TRANSFORMER_CONFIG.version).toBe('string');
      expect(TRANSFORMER_CONFIG.version.length).toBeGreaterThan(0);
    });

    it('should have valid token limits', () => {
      expect(TRANSFORMER_CONFIG.tokenLimits.min).toBeLessThan(TRANSFORMER_CONFIG.tokenLimits.max);
      expect(TRANSFORMER_CONFIG.tokenLimits.optimal.min).toBeLessThan(TRANSFORMER_CONFIG.tokenLimits.optimal.max);
      expect(TRANSFORMER_CONFIG.tokenLimits.optimal.min).toBeGreaterThanOrEqual(TRANSFORMER_CONFIG.tokenLimits.min);
      expect(TRANSFORMER_CONFIG.tokenLimits.optimal.max).toBeLessThanOrEqual(TRANSFORMER_CONFIG.tokenLimits.max);
    });

    it('should have valid confidence thresholds', () => {
      expect(TRANSFORMER_CONFIG.confidenceThresholds.intent).toBeGreaterThan(0);
      expect(TRANSFORMER_CONFIG.confidenceThresholds.intent).toBeLessThanOrEqual(1);
      expect(TRANSFORMER_CONFIG.confidenceThresholds.section).toBeGreaterThan(0);
      expect(TRANSFORMER_CONFIG.confidenceThresholds.section).toBeLessThanOrEqual(1);
    });

    it('should have fallback behavior configured', () => {
      expect(TRANSFORMER_CONFIG.fallbackBehavior.onInvalidInput).toBeDefined();
      expect(TRANSFORMER_CONFIG.fallbackBehavior.onAnalysisFailure).toBeDefined();
      expect(TRANSFORMER_CONFIG.fallbackBehavior.onLowConfidence).toBeDefined();
    });

    it('should have metrics configuration', () => {
      expect(typeof TRANSFORMER_CONFIG.metrics.enabled).toBe('boolean');
      expect(typeof TRANSFORMER_CONFIG.metrics.logToConsole).toBe('boolean');
      expect(typeof TRANSFORMER_CONFIG.metrics.logToFile).toBe('boolean');
      expect(TRANSFORMER_CONFIG.metrics.logPath).toBeDefined();
    });

    it('should have logging configuration', () => {
      expect(typeof TRANSFORMER_CONFIG.logging.enabled).toBe('boolean');
      expect(typeof TRANSFORMER_CONFIG.logging.logToConsole).toBe('boolean');
      expect(typeof TRANSFORMER_CONFIG.logging.logToFile).toBe('boolean');
      expect(TRANSFORMER_CONFIG.logging.logPath).toBeDefined();
      expect(['error', 'warn', 'info', 'debug']).toContain(TRANSFORMER_CONFIG.logging.logLevel);
    });
  });

  describe('getConfigValue', () => {
    it('should get top-level config value', () => {
      expect(getConfigValue('version')).toBe(TRANSFORMER_CONFIG.version);
    });

    it('should get nested config value', () => {
      expect(getConfigValue('tokenLimits.min')).toBe(TRANSFORMER_CONFIG.tokenLimits.min);
      expect(getConfigValue('tokenLimits.optimal.min')).toBe(TRANSFORMER_CONFIG.tokenLimits.optimal.min);
    });

    it('should get deeply nested config value', () => {
      expect(getConfigValue('metrics.logPath')).toBe(TRANSFORMER_CONFIG.metrics.logPath);
      expect(getConfigValue('logging.logLevel')).toBe(TRANSFORMER_CONFIG.logging.logLevel);
    });

    it('should throw error for invalid path', () => {
      expect(() => getConfigValue('invalid.path')).toThrow('Config path not found');
      expect(() => getConfigValue('tokenLimits.invalid')).toThrow('Config path not found');
    });
  });

  describe('isOptimalTokenCount', () => {
    it('should return true for token count in optimal range', () => {
      expect(isOptimalTokenCount(200)).toBe(true);
      expect(isOptimalTokenCount(300)).toBe(true);
      expect(isOptimalTokenCount(500)).toBe(true);
    });

    it('should return false for token count below optimal range', () => {
      expect(isOptimalTokenCount(150)).toBe(false);
      expect(isOptimalTokenCount(199)).toBe(false);
    });

    it('should return false for token count above optimal range', () => {
      expect(isOptimalTokenCount(501)).toBe(false);
      expect(isOptimalTokenCount(600)).toBe(false);
    });

    it('should handle edge cases', () => {
      const optimalMin = TRANSFORMER_CONFIG.tokenLimits.optimal.min;
      const optimalMax = TRANSFORMER_CONFIG.tokenLimits.optimal.max;

      expect(isOptimalTokenCount(optimalMin)).toBe(true);
      expect(isOptimalTokenCount(optimalMax)).toBe(true);
      expect(isOptimalTokenCount(optimalMin - 1)).toBe(false);
      expect(isOptimalTokenCount(optimalMax + 1)).toBe(false);
    });
  });

  describe('isAcceptableTokenCount', () => {
    it('should return true for token count in acceptable range', () => {
      expect(isAcceptableTokenCount(150)).toBe(true);
      expect(isAcceptableTokenCount(300)).toBe(true);
      expect(isAcceptableTokenCount(600)).toBe(true);
    });

    it('should return false for token count below minimum', () => {
      expect(isAcceptableTokenCount(149)).toBe(false);
      expect(isAcceptableTokenCount(100)).toBe(false);
    });

    it('should return false for token count above maximum', () => {
      expect(isAcceptableTokenCount(601)).toBe(false);
      expect(isAcceptableTokenCount(1000)).toBe(false);
    });

    it('should handle edge cases', () => {
      const min = TRANSFORMER_CONFIG.tokenLimits.min;
      const max = TRANSFORMER_CONFIG.tokenLimits.max;

      expect(isAcceptableTokenCount(min)).toBe(true);
      expect(isAcceptableTokenCount(max)).toBe(true);
      expect(isAcceptableTokenCount(min - 1)).toBe(false);
      expect(isAcceptableTokenCount(max + 1)).toBe(false);
    });

    it('should allow non-optimal but acceptable counts', () => {
      // Between min and optimal.min
      expect(isAcceptableTokenCount(175)).toBe(true);
      // Between optimal.max and max
      expect(isAcceptableTokenCount(550)).toBe(true);
    });
  });

  describe('meetsConfidenceThreshold', () => {
    it('should return true for confidence above intent threshold', () => {
      const threshold = TRANSFORMER_CONFIG.confidenceThresholds.intent;
      expect(meetsConfidenceThreshold(threshold + 0.1, 'intent')).toBe(true);
      expect(meetsConfidenceThreshold(0.9, 'intent')).toBe(true);
    });

    it('should return false for confidence below intent threshold', () => {
      const threshold = TRANSFORMER_CONFIG.confidenceThresholds.intent;
      expect(meetsConfidenceThreshold(threshold - 0.1, 'intent')).toBe(false);
      expect(meetsConfidenceThreshold(0.3, 'intent')).toBe(false);
    });

    it('should return true for confidence above section threshold', () => {
      const threshold = TRANSFORMER_CONFIG.confidenceThresholds.section;
      expect(meetsConfidenceThreshold(threshold + 0.1, 'section')).toBe(true);
      expect(meetsConfidenceThreshold(0.9, 'section')).toBe(true);
    });

    it('should return false for confidence below section threshold', () => {
      const threshold = TRANSFORMER_CONFIG.confidenceThresholds.section;
      expect(meetsConfidenceThreshold(threshold - 0.1, 'section')).toBe(false);
      expect(meetsConfidenceThreshold(0.2, 'section')).toBe(false);
    });

    it('should handle edge cases', () => {
      const intentThreshold = TRANSFORMER_CONFIG.confidenceThresholds.intent;
      const sectionThreshold = TRANSFORMER_CONFIG.confidenceThresholds.section;

      expect(meetsConfidenceThreshold(intentThreshold, 'intent')).toBe(true);
      expect(meetsConfidenceThreshold(sectionThreshold, 'section')).toBe(true);
    });
  });

  describe('Configuration consistency', () => {
    it('should have consistent fallback behavior values', () => {
      const validBehaviors = ['create_minimal_chunk', 'throw_error', 'use_fallback_chunk', 'log_warning'];
      expect(validBehaviors).toContain(TRANSFORMER_CONFIG.fallbackBehavior.onInvalidInput);
      expect(validBehaviors).toContain(TRANSFORMER_CONFIG.fallbackBehavior.onAnalysisFailure);
      expect(validBehaviors).toContain(TRANSFORMER_CONFIG.fallbackBehavior.onLowConfidence);
    });

    it('should have metrics and logging paths defined', () => {
      expect(TRANSFORMER_CONFIG.metrics.logPath).toBeTruthy();
      expect(TRANSFORMER_CONFIG.logging.logPath).toBeTruthy();
      expect(typeof TRANSFORMER_CONFIG.metrics.logPath).toBe('string');
      expect(typeof TRANSFORMER_CONFIG.logging.logPath).toBe('string');
    });

    it('should have valid default values', () => {
      expect(TRANSFORMER_CONFIG.defaultComplexity).toBeGreaterThan(0);
      expect(['default', 'named', 'namespace']).toContain(TRANSFORMER_CONFIG.defaultImportType);
    });
  });
});
