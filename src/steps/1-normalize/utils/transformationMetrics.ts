// =============================================================================
// Transformation Metrics Logging
// =============================================================================
// Created: 2025-10-26
// Purpose: Log metrics and warnings from transformation pipeline
//
// Handles writing metrics to JSONL files and console output for tracking
// transformation performance, errors, and warnings across all components.
//
// =============================================================================

import fs from 'fs';
import path from 'path';
import type { TransformationContext, TransformationWarning } from './transformationContext.js';
import { TRANSFORMER_CONFIG } from '../config/transformer.config.js';
import { getContextId, getTotalTime, createSummary } from './transformationContext.js';

/**
 * Metrics entry for JSONL log file
 */
export interface MetricsLogEntry {
  /** Timestamp (ISO 8601) */
  timestamp: string;

  /** Component being processed */
  componentName: string;

  /** Example index (if applicable) */
  exampleIndex?: number;

  /** Total transformation time (ms) */
  totalTimeMs: number;

  /** Phase-specific timings */
  timings?: {
    analysisTimeMs?: number;
    inferenceTimeMs?: number;
    generationTimeMs?: number;
  };

  /** Token count */
  tokenCount?: number;

  /** Patterns that matched */
  patternMatches: string[];

  /** Confidence scores */
  confidenceScores?: {
    section?: number;
    intent?: number;
  };

  /** Number of warnings */
  warningCount: number;

  /** Warning details (if any) */
  warnings?: Array<{
    phase: string;
    message: string;
  }>;

  /** Status: success or failure */
  status: 'success' | 'failure';

  /** Error message (if failure) */
  errorMessage?: string;

  /** Error phase (if failure) */
  errorPhase?: string;
}

/**
 * Get metrics log file path
 *
 * @returns Absolute path to metrics log file
 */
export function getMetricsLogPath(): string {
  const metricsDir = path.resolve(process.cwd(), TRANSFORMER_CONFIG.metrics.logPath);
  return path.join(metricsDir, 'transformation-metrics.jsonl');
}

/**
 * Get error log file path
 *
 * @returns Absolute path to error log file
 */
export function getErrorLogPath(): string {
  const logDir = path.resolve(process.cwd(), TRANSFORMER_CONFIG.logging.logPath);
  return path.join(logDir, 'transformation-errors.log');
}

/**
 * Ensure log directories exist
 */
export function ensureLogDirectories(): void {
  const metricsDir = path.resolve(process.cwd(), TRANSFORMER_CONFIG.metrics.logPath);
  const logDir = path.resolve(process.cwd(), TRANSFORMER_CONFIG.logging.logPath);

  if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
  }

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

/**
 * Create metrics log entry from context
 *
 * @param ctx - Transformation context
 * @param status - Success or failure
 * @param error - Error (if failure)
 * @returns Metrics log entry
 */
export function createMetricsEntry(
  ctx: TransformationContext,
  status: 'success' | 'failure',
  error?: Error & { phase?: string }
): MetricsLogEntry {
  const entry: MetricsLogEntry = {
    timestamp: new Date().toISOString(),
    componentName: ctx.componentName,
    exampleIndex: ctx.exampleIndex,
    totalTimeMs: getTotalTime(ctx),
    timings: {
      analysisTimeMs: ctx.metrics.analysisTimeMs,
      inferenceTimeMs: ctx.metrics.inferenceTimeMs,
      generationTimeMs: ctx.metrics.generationTimeMs
    },
    tokenCount: ctx.metrics.tokenCount,
    patternMatches: ctx.metrics.patternMatches,
    confidenceScores: ctx.metrics.confidenceScores,
    warningCount: ctx.warnings.length,
    status
  };

  // Add warnings if present
  if (ctx.warnings.length > 0) {
    entry.warnings = ctx.warnings.map(w => ({
      phase: w.phase,
      message: w.message
    }));
  }

  // Add error details if failure
  if (status === 'failure' && error) {
    entry.errorMessage = error.message;
    entry.errorPhase = error.phase;
  }

  return entry;
}

/**
 * Write metrics entry to JSONL file
 *
 * @param entry - Metrics log entry
 */
export function writeMetricsToFile(entry: MetricsLogEntry): void {
  if (!TRANSFORMER_CONFIG.metrics.enabled || !TRANSFORMER_CONFIG.metrics.logToFile) {
    return;
  }

  try {
    ensureLogDirectories();
    const logPath = getMetricsLogPath();
    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(logPath, line, 'utf-8');
  } catch (error) {
    console.error('Failed to write metrics:', error);
  }
}

/**
 * Write error to log file
 *
 * @param ctx - Transformation context
 * @param error - Error object
 */
export function writeErrorToFile(ctx: TransformationContext, error: Error): void {
  if (!TRANSFORMER_CONFIG.logging.enabled || !TRANSFORMER_CONFIG.logging.logToFile) {
    return;
  }

  try {
    ensureLogDirectories();
    const logPath = getErrorLogPath();
    const timestamp = new Date().toISOString();
    const contextId = getContextId(ctx);

    let logMessage = `[${timestamp}] [ERROR] ${contextId}\n`;
    logMessage += `  Message: ${error.message}\n`;

    if (TRANSFORMER_CONFIG.logging.includeStackTrace && error.stack) {
      logMessage += `  Stack: ${error.stack}\n`;
    }

    logMessage += '\n';

    fs.appendFileSync(logPath, logMessage, 'utf-8');
  } catch (writeError) {
    console.error('Failed to write error log:', writeError);
  }
}

/**
 * Log metrics to console
 *
 * @param ctx - Transformation context
 * @param status - Success or failure
 */
export function logMetricsToConsole(ctx: TransformationContext, status: 'success' | 'failure'): void {
  if (!TRANSFORMER_CONFIG.metrics.enabled || !TRANSFORMER_CONFIG.metrics.logToConsole) {
    return;
  }

  const contextId = getContextId(ctx);
  const totalTime = getTotalTime(ctx);
  const statusIcon = status === 'success' ? '✅' : '❌';

  console.log(`   ${statusIcon} ${contextId} - ${totalTime}ms`);

  // Log warnings if present and logging level is 'warn' or lower
  if (ctx.warnings.length > 0 && shouldLogWarnings()) {
    console.log(`      ⚠️  ${ctx.warnings.length} warning(s):`);
    ctx.warnings.forEach(w => {
      console.log(`         [${w.phase}] ${w.message}`);
    });
  }
}

/**
 * Log error to console
 *
 * @param ctx - Transformation context
 * @param error - Error object
 */
export function logErrorToConsole(ctx: TransformationContext, error: Error): void {
  if (!TRANSFORMER_CONFIG.logging.enabled || !TRANSFORMER_CONFIG.logging.logToConsole) {
    return;
  }

  const contextId = getContextId(ctx);
  console.error(`   ❌ ${contextId} - FAILED`);
  console.error(`      Error: ${error.message}`);

  if (TRANSFORMER_CONFIG.logging.includeStackTrace && error.stack) {
    console.error(`      Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
  }
}

/**
 * Log transformation success
 *
 * @param ctx - Transformation context
 */
export function logSuccess(ctx: TransformationContext): void {
  const entry = createMetricsEntry(ctx, 'success');

  writeMetricsToFile(entry);
  logMetricsToConsole(ctx, 'success');
}

/**
 * Log transformation failure
 *
 * @param ctx - Transformation context
 * @param error - Error that caused failure
 */
export function logFailure(ctx: TransformationContext, error: Error & { phase?: string }): void {
  const entry = createMetricsEntry(ctx, 'failure', error);

  writeMetricsToFile(entry);
  writeErrorToFile(ctx, error);
  logMetricsToConsole(ctx, 'failure');
  logErrorToConsole(ctx, error);
}

/**
 * Format warnings for display
 *
 * @param warnings - Array of warnings
 * @returns Formatted warning string
 */
export function formatWarnings(warnings: TransformationWarning[]): string {
  if (warnings.length === 0) {
    return 'No warnings';
  }

  return warnings
    .map(w => `[${w.phase}] ${w.message}`)
    .join('\n');
}

/**
 * Format metrics summary for display
 *
 * @param ctx - Transformation context
 * @returns Formatted metrics string
 */
export function formatMetricsSummary(ctx: TransformationContext): string {
  const summary = createSummary(ctx);
  const lines: string[] = [];

  lines.push(`Context: ${summary.contextId}`);
  lines.push(`Total Time: ${summary.totalTimeMs}ms`);

  if (ctx.metrics.analysisTimeMs !== undefined) {
    lines.push(`  Analysis: ${ctx.metrics.analysisTimeMs}ms`);
  }

  if (ctx.metrics.inferenceTimeMs !== undefined) {
    lines.push(`  Inference: ${ctx.metrics.inferenceTimeMs}ms`);
  }

  if (ctx.metrics.generationTimeMs !== undefined) {
    lines.push(`  Generation: ${ctx.metrics.generationTimeMs}ms`);
  }

  if (ctx.metrics.tokenCount !== undefined) {
    lines.push(`Tokens: ${ctx.metrics.tokenCount}`);
  }

  if (ctx.metrics.patternMatches.length > 0) {
    lines.push(`Patterns: ${ctx.metrics.patternMatches.join(', ')}`);
  }

  if (ctx.metrics.confidenceScores) {
    const scores = ctx.metrics.confidenceScores;
    if (scores.section !== undefined) {
      lines.push(`Section Confidence: ${(scores.section * 100).toFixed(1)}%`);
    }
    if (scores.intent !== undefined) {
      lines.push(`Intent Confidence: ${(scores.intent * 100).toFixed(1)}%`);
    }
  }

  lines.push(`Warnings: ${summary.warnings}`);

  return lines.join('\n');
}

/**
 * Check if warnings should be logged based on log level
 *
 * @returns True if warnings should be logged
 */
function shouldLogWarnings(): boolean {
  const level = TRANSFORMER_CONFIG.logging.logLevel;
  return level === 'warn' || level === 'info' || level === 'debug';
}

/**
 * Read all metrics from JSONL file
 *
 * @returns Array of metrics entries
 */
export function readAllMetrics(): MetricsLogEntry[] {
  const logPath = getMetricsLogPath();

  if (!fs.existsSync(logPath)) {
    return [];
  }

  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.length > 0);

  return lines.map(line => JSON.parse(line));
}

/**
 * Get metrics summary statistics
 *
 * @returns Summary statistics
 */
export function getMetricsSummary(): {
  totalTransformations: number;
  successCount: number;
  failureCount: number;
  averageTimeMs: number;
  totalWarnings: number;
  commonPatterns: string[];
} {
  const metrics = readAllMetrics();

  if (metrics.length === 0) {
    return {
      totalTransformations: 0,
      successCount: 0,
      failureCount: 0,
      averageTimeMs: 0,
      totalWarnings: 0,
      commonPatterns: []
    };
  }

  const successCount = metrics.filter(m => m.status === 'success').length;
  const failureCount = metrics.length - successCount;
  const totalTime = metrics.reduce((sum, m) => sum + m.totalTimeMs, 0);
  const totalWarnings = metrics.reduce((sum, m) => sum + m.warningCount, 0);

  // Find most common patterns
  const patternCounts = new Map<string, number>();
  metrics.forEach(m => {
    m.patternMatches.forEach(pattern => {
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
    });
  });

  const commonPatterns = Array.from(patternCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([pattern]) => pattern);

  return {
    totalTransformations: metrics.length,
    successCount,
    failureCount,
    averageTimeMs: Math.round(totalTime / metrics.length),
    totalWarnings,
    commonPatterns
  };
}

/**
 * Clear metrics log file (for testing)
 */
export function clearMetricsLog(): void {
  const logPath = getMetricsLogPath();
  if (fs.existsSync(logPath)) {
    fs.unlinkSync(logPath);
  }
}

/**
 * Clear error log file (for testing)
 */
export function clearErrorLog(): void {
  const logPath = getErrorLogPath();
  if (fs.existsSync(logPath)) {
    fs.unlinkSync(logPath);
  }
}
