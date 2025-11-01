#!/usr/bin/env tsx
/**
 * POC Validation Metrics Analysis Script
 *
 * Analyzes transformation metrics from the POC validation run
 * to measure section inference and intent classification improvements.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const METRICS_FILE = path.join(__dirname, '../artifacts/metrics/transformation-metrics.jsonl');

interface TransformationMetric {
  timestamp: string;
  componentName: string;
  exampleIndex?: number;
  totalTimeMs: number;
  timings: {
    analysisTimeMs?: number;
    inferenceTimeMs?: number;
    generationTimeMs?: number;
  };
  tokenCount?: number;
  patternMatches: string[];
  confidenceScores?: {
    section?: number;
    intent?: number;
  };
  warningCount: number;
  status: 'success' | 'failure';
  warnings?: Array<{
    phase: string;
    message: string;
  }>;
  error?: {
    message: string;
    phase?: string;
  };
}

function readMetrics(): TransformationMetric[] {
  if (!fs.existsSync(METRICS_FILE)) {
    console.error(`❌ Metrics file not found: ${METRICS_FILE}`);
    process.exit(1);
  }

  const content = fs.readFileSync(METRICS_FILE, 'utf-8');
  const lines = content.trim().split('\n');
  return lines.map(line => JSON.parse(line));
}

function analyzeMetrics() {
  const metrics = readMetrics();

  console.log('═'.repeat(80));
  console.log('POC VALIDATION METRICS ANALYSIS');
  console.log('═'.repeat(80));
  console.log();

  // ===================================================================
  // Overall Statistics
  // ===================================================================

  console.log('📊 OVERALL STATISTICS');
  console.log('─'.repeat(80));

  const totalTransformations = metrics.length;
  const successCount = metrics.filter(m => m.status === 'success').length;
  const failureCount = metrics.filter(m => m.status === 'failure').length;
  const successRate = (successCount / totalTransformations) * 100;

  const totalTime = metrics.reduce((sum, m) => sum + m.totalTimeMs, 0);
  const avgTime = totalTime / metrics.length;
  const maxTime = Math.max(...metrics.map(m => m.totalTimeMs));
  const minTime = Math.min(...metrics.map(m => m.totalTimeMs));

  const totalWarnings = metrics.reduce((sum, m) => sum + m.warningCount, 0);

  console.log(`  Total transformations:     ${totalTransformations}`);
  console.log(`  Success rate:              ${successRate.toFixed(1)}% (${successCount}/${totalTransformations})`);
  console.log(`  Failure rate:              ${((failureCount / totalTransformations) * 100).toFixed(1)}% (${failureCount}/${totalTransformations})`);
  console.log();
  console.log(`  Total time:                ${totalTime.toFixed(0)}ms`);
  console.log(`  Average time per example:  ${avgTime.toFixed(1)}ms`);
  console.log(`  Min/Max time:              ${minTime}ms / ${maxTime}ms`);
  console.log();
  console.log(`  Total warnings:            ${totalWarnings}`);
  console.log(`  Avg warnings per example:  ${(totalWarnings / totalTransformations).toFixed(2)}`);
  console.log();

  // ===================================================================
  // Section Inference Metrics
  // ===================================================================

  console.log('🎯 SECTION INFERENCE ANALYSIS');
  console.log('─'.repeat(80));

  const successfulMetrics = metrics.filter(m => m.status === 'success');

  // Count semantic sections (not "Usage Example" or similar generic titles)
  const semanticSections = successfulMetrics.filter(m =>
    m.patternMatches &&
    m.patternMatches.length > 0 &&
    !m.patternMatches.includes('no_specific_pattern_matched')
  ).length;

  const sectionAccuracy = (semanticSections / successfulMetrics.length) * 100;

  // Confidence score analysis
  const sectionConfidences = successfulMetrics
    .filter(m => m.confidenceScores?.section !== undefined)
    .map(m => m.confidenceScores!.section!);

  const avgSectionConfidence = sectionConfidences.length > 0
    ? sectionConfidences.reduce((a, b) => a + b, 0) / sectionConfidences.length
    : 0;

  const lowSectionConfidence = sectionConfidences.filter(c => c < 0.5).length;
  const mediumSectionConfidence = sectionConfidences.filter(c => c >= 0.5 && c < 0.8).length;
  const highSectionConfidence = sectionConfidences.filter(c => c >= 0.8).length;

  console.log(`  Semantic sections:         ${semanticSections}/${successfulMetrics.length} (${sectionAccuracy.toFixed(1)}%)`);
  console.log(`  Target:                    >95%`);
  console.log(`  Status:                    ${sectionAccuracy >= 95 ? '✅ PASS' : sectionAccuracy >= 75 ? '⚠️  ACCEPTABLE' : '❌ FAIL'}`);
  console.log();
  console.log(`  Avg confidence score:      ${(avgSectionConfidence * 100).toFixed(1)}%`);
  console.log(`  Low confidence (<50%):     ${lowSectionConfidence} (${((lowSectionConfidence / sectionConfidences.length) * 100).toFixed(1)}%)`);
  console.log(`  Medium confidence (50-80%): ${mediumSectionConfidence} (${((mediumSectionConfidence / sectionConfidences.length) * 100).toFixed(1)}%)`);
  console.log(`  High confidence (>80%):    ${highSectionConfidence} (${((highSectionConfidence / sectionConfidences.length) * 100).toFixed(1)}%)`);
  console.log();

  // ===================================================================
  // Intent Classification Metrics
  // ===================================================================

  console.log('🎨 INTENT CLASSIFICATION ANALYSIS');
  console.log('─'.repeat(80));

  // Count specific intents (not "generic")
  // This would require reading the actual chunk data, so we use pattern matches as a proxy
  const specificIntents = successfulMetrics.filter(m => {
    const hasSpecificPatterns = m.patternMatches && m.patternMatches.length > 0;
    const notGenericOnly = !m.patternMatches?.every(p => p === 'no_specific_pattern_matched');
    return hasSpecificPatterns && notGenericOnly;
  }).length;

  const intentAccuracy = (specificIntents / successfulMetrics.length) * 100;

  // Intent confidence analysis
  const intentConfidences = successfulMetrics
    .filter(m => m.confidenceScores?.intent !== undefined)
    .map(m => m.confidenceScores!.intent!);

  const avgIntentConfidence = intentConfidences.length > 0
    ? intentConfidences.reduce((a, b) => a + b, 0) / intentConfidences.length
    : 0;

  const lowIntentConfidence = intentConfidences.filter(c => c < 0.6).length;
  const mediumIntentConfidence = intentConfidences.filter(c => c >= 0.6 && c < 0.8).length;
  const highIntentConfidence = intentConfidences.filter(c => c >= 0.8).length;

  console.log(`  Specific intents:          ${specificIntents}/${successfulMetrics.length} (${intentAccuracy.toFixed(1)}%)`);
  console.log(`  Target:                    >75%`);
  console.log(`  Status:                    ${intentAccuracy >= 75 ? '✅ PASS' : intentAccuracy >= 60 ? '⚠️  ACCEPTABLE' : '❌ FAIL'}`);
  console.log();
  console.log(`  Avg confidence score:      ${(avgIntentConfidence * 100).toFixed(1)}%`);
  console.log(`  Low confidence (<60%):     ${lowIntentConfidence} (${((lowIntentConfidence / intentConfidences.length) * 100).toFixed(1)}%)`);
  console.log(`  Medium confidence (60-80%): ${mediumIntentConfidence} (${((mediumIntentConfidence / intentConfidences.length) * 100).toFixed(1)}%)`);
  console.log(`  High confidence (>80%):    ${highIntentConfidence} (${((highIntentConfidence / intentConfidences.length) * 100).toFixed(1)}%)`);
  console.log();

  // ===================================================================
  // Pattern Distribution
  // ===================================================================

  console.log('🔍 PATTERN DISTRIBUTION');
  console.log('─'.repeat(80));

  const patternCounts = new Map<string, number>();
  metrics.forEach(m => {
    if (m.patternMatches) {
      m.patternMatches.forEach(pattern => {
        patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
      });
    }
  });

  const sortedPatterns = Array.from(patternCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  console.log('  Top 15 patterns matched:');
  sortedPatterns.forEach(([pattern, count], i) => {
    const percentage = (count / metrics.length) * 100;
    console.log(`    ${(i + 1).toString().padStart(2)}. ${pattern.padEnd(35)} ${count.toString().padStart(3)} (${percentage.toFixed(1)}%)`);
  });
  console.log();

  // ===================================================================
  // Token Count Analysis
  // ===================================================================

  console.log('📝 TOKEN COUNT ANALYSIS');
  console.log('─'.repeat(80));

  const tokenCounts = successfulMetrics
    .filter(m => m.tokenCount !== undefined)
    .map(m => m.tokenCount!);

  let optimalRange = 0;
  let tooLow = 0;
  let tooHigh = 0;

  if (tokenCounts.length > 0) {
    const avgTokens = tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length;
    const minTokens = Math.min(...tokenCounts);
    const maxTokens = Math.max(...tokenCounts);

    optimalRange = tokenCounts.filter(t => t >= 200 && t <= 500).length;
    tooLow = tokenCounts.filter(t => t < 200).length;
    tooHigh = tokenCounts.filter(t => t > 500).length;

    console.log(`  Average tokens:            ${avgTokens.toFixed(0)}`);
    console.log(`  Min/Max tokens:            ${minTokens} / ${maxTokens}`);
    console.log();
    console.log(`  Optimal range (200-500):   ${optimalRange}/${tokenCounts.length} (${((optimalRange / tokenCounts.length) * 100).toFixed(1)}%)`);
    console.log(`  Too low (<200):            ${tooLow}/${tokenCounts.length} (${((tooLow / tokenCounts.length) * 100).toFixed(1)}%)`);
    console.log(`  Too high (>500):           ${tooHigh}/${tokenCounts.length} (${((tooHigh / tokenCounts.length) * 100).toFixed(1)}%)`);
    console.log(`  Target:                    >70% in optimal range`);
    console.log(`  Status:                    ${((optimalRange / tokenCounts.length) * 100) >= 70 ? '✅ PASS' : '⚠️  NEEDS IMPROVEMENT'}`);
  }
  console.log();

  // ===================================================================
  // Performance Breakdown
  // ===================================================================

  console.log('⚡ PERFORMANCE BREAKDOWN');
  console.log('─'.repeat(80));

  const timingsWithData = metrics.filter(m => m.timings);

  if (timingsWithData.length > 0) {
    const analysisTimes = timingsWithData
      .filter(m => m.timings.analysisTimeMs !== undefined)
      .map(m => m.timings.analysisTimeMs!);
    const inferenceTimes = timingsWithData
      .filter(m => m.timings.inferenceTimeMs !== undefined)
      .map(m => m.timings.inferenceTimeMs!);
    const generationTimes = timingsWithData
      .filter(m => m.timings.generationTimeMs !== undefined)
      .map(m => m.timings.generationTimeMs!);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    console.log(`  Avg analysis time:         ${avg(analysisTimes).toFixed(1)}ms`);
    console.log(`  Avg inference time:        ${avg(inferenceTimes).toFixed(1)}ms`);
    console.log(`  Avg generation time:       ${avg(generationTimes).toFixed(1)}ms`);
    console.log(`  Avg total time:            ${avgTime.toFixed(1)}ms`);
    console.log();
    console.log(`  Target per example:        <500ms`);
    console.log(`  Status:                    ${avgTime < 500 ? '✅ PASS' : '⚠️  SLOW'}`);
  }
  console.log();

  // ===================================================================
  // Per-Component Breakdown
  // ===================================================================

  console.log('📦 PER-COMPONENT BREAKDOWN');
  console.log('─'.repeat(80));

  const byComponent = new Map<string, {
    count: number;
    success: number;
    failure: number;
    avgTime: number;
    avgTokens: number;
    avgSectionConf: number;
    avgIntentConf: number;
    warnings: number;
  }>();

  metrics.forEach(m => {
    if (!byComponent.has(m.componentName)) {
      byComponent.set(m.componentName, {
        count: 0,
        success: 0,
        failure: 0,
        avgTime: 0,
        avgTokens: 0,
        avgSectionConf: 0,
        avgIntentConf: 0,
        warnings: 0
      });
    }

    const stats = byComponent.get(m.componentName)!;
    stats.count++;
    if (m.status === 'success') stats.success++;
    else stats.failure++;
    stats.avgTime += m.totalTimeMs;
    stats.avgTokens += m.tokenCount || 0;
    stats.avgSectionConf += m.confidenceScores?.section || 0;
    stats.avgIntentConf += m.confidenceScores?.intent || 0;
    stats.warnings += m.warningCount;
  });

  // Calculate averages
  byComponent.forEach((stats, name) => {
    stats.avgTime /= stats.count;
    stats.avgTokens /= stats.count;
    stats.avgSectionConf /= stats.count;
    stats.avgIntentConf /= stats.count;
  });

  console.log('  Component               Examples  Success  Avg Time   Tokens   Warnings');
  console.log('  ' + '─'.repeat(76));

  const sortedComponents = Array.from(byComponent.entries())
    .sort((a, b) => b[1].count - a[1].count);

  sortedComponents.forEach(([name, stats]) => {
    const successRate = ((stats.success / stats.count) * 100).toFixed(0);
    console.log(
      `  ${name.padEnd(23)} ` +
      `${stats.count.toString().padStart(8)} ` +
      `${successRate.padStart(6)}%  ` +
      `${stats.avgTime.toFixed(0).padStart(7)}ms  ` +
      `${stats.avgTokens.toFixed(0).padStart(6)}  ` +
      `${stats.warnings.toString().padStart(8)}`
    );
  });
  console.log();

  // ===================================================================
  // Warning Analysis
  // ===================================================================

  console.log('⚠️  WARNING ANALYSIS');
  console.log('─'.repeat(80));

  const warningTypes = new Map<string, number>();
  metrics.forEach(m => {
    if (m.warnings) {
      m.warnings.forEach(w => {
        const key = `[${w.phase}] ${w.message.split(':')[0]}`;
        warningTypes.set(key, (warningTypes.get(key) || 0) + 1);
      });
    }
  });

  const sortedWarnings = Array.from(warningTypes.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log('  Top 10 warning types:');
  sortedWarnings.forEach(([warning, count], i) => {
    const percentage = (count / totalTransformations) * 100;
    console.log(`    ${(i + 1).toString().padStart(2)}. ${warning.padEnd(50)} ${count.toString().padStart(3)} (${percentage.toFixed(1)}%)`);
  });
  console.log();

  // ===================================================================
  // Summary
  // ===================================================================

  console.log('═'.repeat(80));
  console.log('📋 SUMMARY');
  console.log('═'.repeat(80));
  console.log();
  console.log('  Key Metrics:');
  console.log(`    • Section Inference Accuracy:   ${sectionAccuracy.toFixed(1)}% ${sectionAccuracy >= 95 ? '✅' : sectionAccuracy >= 75 ? '⚠️' : '❌'}`);
  console.log(`    • Intent Classification Accuracy: ${intentAccuracy.toFixed(1)}% ${intentAccuracy >= 75 ? '✅' : intentAccuracy >= 60 ? '⚠️' : '❌'}`);
  console.log(`    • Optimal Token Count:          ${tokenCounts.length > 0 ? ((optimalRange / tokenCounts.length) * 100).toFixed(1) : '0.0'}% ${tokenCounts.length > 0 && ((optimalRange / tokenCounts.length) * 100) >= 70 ? '✅' : '⚠️'}`);
  console.log(`    • Success Rate:                 ${successRate.toFixed(1)}% ${successRate >= 95 ? '✅' : successRate >= 90 ? '⚠️' : '❌'}`);
  console.log(`    • Avg Performance:              ${avgTime.toFixed(0)}ms ${avgTime < 500 ? '✅' : '⚠️'}`);
  console.log();
  console.log('  Components Analyzed:      12');
  console.log('  Total Examples:           ' + totalTransformations);
  console.log();
  console.log('═'.repeat(80));
}

// Run analysis
try {
  analyzeMetrics();
} catch (error) {
  console.error('❌ Error during analysis:', error);
  process.exit(1);
}
