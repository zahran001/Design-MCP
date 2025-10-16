// =============================================================================
// Smoke Test - Quick validation of extraction quality
// =============================================================================
// Run: npx tsx src/steps/0-extract-docs/smoke-test.ts
//
// Purpose: Fast pass/fail check for RAG readiness
// - Validates JSON structure
// - Checks completeness thresholds
// - Reports basic statistics

// =============================================================================
// How it helps is by providing a quick feedback loop after extraction:
// Automated pass/fail validation
// Checks schema validation, description coverage, code examples coverage
// Takes ~5 seconds to run
// =============================================================================

import fs from 'fs/promises';
import path from 'path';
import { ComponentDocSchema } from '../../schemas/RAGResultSchema.js';

interface SmokeTestResults {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  withDescription: number;
  withCodeExamples: number;
  withRelatedComponents: number;
  totalCodeExamples: number;
  avgCodeExamplesPerComponent: number;
  avgDescriptionLength: number;
  errors: Array<{ file: string; error: string }>;
}

async function runSmokeTest(): Promise<SmokeTestResults> {
  const artifactsDir = path.join(process.cwd(), 'artifacts', 'raw-json');

  console.log('🔍 Starting smoke test...');
  console.log(`📁 Reading from: ${artifactsDir}\n`);

  const files = await fs.readdir(artifactsDir);
  const jsonFiles = files.filter(f => f.endsWith('.json') && f !== '.gitkeep');

  if (jsonFiles.length === 0) {
    throw new Error('No JSON files found in artifacts/raw-json/');
  }

  const results: SmokeTestResults = {
    totalFiles: jsonFiles.length,
    validFiles: 0,
    invalidFiles: 0,
    withDescription: 0,
    withCodeExamples: 0,
    withRelatedComponents: 0,
    totalCodeExamples: 0,
    avgCodeExamplesPerComponent: 0,
    avgDescriptionLength: 0,
    errors: [],
  };

  let totalDescriptionLength = 0;

  for (const file of jsonFiles) {
    const filePath = path.join(artifactsDir, file);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Validate against schema
      const validation = ComponentDocSchema.safeParse(data);

      if (!validation.success) {
        results.invalidFiles++;
        results.errors.push({
          file,
          error: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
        });
        continue;
      }

      results.validFiles++;

      // Check completeness
      if (validation.data.description) {
        results.withDescription++;
        totalDescriptionLength += validation.data.description.length;
      }

      if (validation.data.codeExamples && validation.data.codeExamples.length > 0) {
        results.withCodeExamples++;
        results.totalCodeExamples += validation.data.codeExamples.length;
      }

      if (validation.data.relatedComponents && validation.data.relatedComponents.length > 0) {
        results.withRelatedComponents++;
      }

    } catch (error) {
      results.invalidFiles++;
      results.errors.push({
        file,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Calculate averages
  if (results.validFiles > 0) {
    results.avgCodeExamplesPerComponent = results.totalCodeExamples / results.validFiles;
    results.avgDescriptionLength = totalDescriptionLength / results.withDescription || 0;
  }

  return results;
}

function printResults(results: SmokeTestResults) {
  console.log('='.repeat(70));
  console.log('📊 SMOKE TEST RESULTS');
  console.log('='.repeat(70));
  console.log();

  // Overall health
  console.log('📈 Overall Health:');
  console.log(`   Total files: ${results.totalFiles}`);
  console.log(`   ✅ Valid: ${results.validFiles} (${((results.validFiles / results.totalFiles) * 100).toFixed(1)}%)`);
  console.log(`   ❌ Invalid: ${results.invalidFiles}`);
  console.log();

  // Completeness thresholds
  const descriptionPct = (results.withDescription / results.validFiles) * 100;
  const codeExamplesPct = (results.withCodeExamples / results.validFiles) * 100;
  const relatedPct = (results.withRelatedComponents / results.validFiles) * 100;

  console.log('📋 Completeness:');
  console.log(`   Components with descriptions: ${results.withDescription}/${results.validFiles} (${descriptionPct.toFixed(1)}%)`);
  console.log(`   Components with code examples: ${results.withCodeExamples}/${results.validFiles} (${codeExamplesPct.toFixed(1)}%)`);
  console.log(`   Components with related components: ${results.withRelatedComponents}/${results.validFiles} (${relatedPct.toFixed(1)}%)`);
  console.log();

  console.log('📊 Content Metrics:');
  console.log(`   Total code examples: ${results.totalCodeExamples}`);
  console.log(`   Avg code examples per component: ${results.avgCodeExamplesPerComponent.toFixed(1)}`);
  console.log(`   Avg description length: ${Math.round(results.avgDescriptionLength)} chars`);
  console.log();

  // Pass/Fail criteria
  const THRESHOLDS = {
    descriptionMin: 80,  // ≥80% should have descriptions
    codeExamplesMin: 70, // ≥70% should have code examples (some pages are concept/overview)
    validMin: 95,        // ≥95% should pass schema validation
  };

  console.log('='.repeat(70));
  console.log('🎯 PASS/FAIL CRITERIA:');
  console.log('='.repeat(70));

  const checks = [
    {
      name: 'Schema validation',
      value: (results.validFiles / results.totalFiles) * 100,
      threshold: THRESHOLDS.validMin,
      unit: '%',
    },
    {
      name: 'Description coverage',
      value: descriptionPct,
      threshold: THRESHOLDS.descriptionMin,
      unit: '%',
    },
    {
      name: 'Code examples coverage',
      value: codeExamplesPct,
      threshold: THRESHOLDS.codeExamplesMin,
      unit: '%',
    },
  ];

  let allPassed = true;
  for (const check of checks) {
    const passed = check.value >= check.threshold;
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${check.name}: ${check.value.toFixed(1)}${check.unit} (threshold: ${check.threshold}${check.unit})`);
    if (!passed) allPassed = false;
  }

  console.log();

  // Errors
  if (results.errors.length > 0) {
    console.log('⚠️  Errors found:');
    for (const error of results.errors.slice(0, 5)) {
      console.log(`   ${error.file}:`);
      console.log(`      ${error.error}`);
    }
    if (results.errors.length > 5) {
      console.log(`   ... and ${results.errors.length - 5} more`);
    }
    console.log();
  }

  // Final verdict
  console.log('='.repeat(70));
  if (allPassed) {
    console.log('🎉 PASS - Extraction quality is ready for RAG/embeddings');
  } else {
    console.log('⚠️  FAIL - Some thresholds not met. Review extraction logic.');
  }
  console.log('='.repeat(70));
  console.log();

  // Next steps
  console.log('📝 Next Steps:');
  if (allPassed) {
    console.log('   1. Run sample viewer to manually review: npm run quality:samples');
    console.log('   2. Proceed to embedding generation (Week 2)');
  } else {
    console.log('   1. Review failed checks above');
    console.log('   2. Adjust extractors.ts filters/thresholds');
    console.log('   3. Re-run extraction and smoke test');
  }
  console.log();
}

// Main execution
// Note: import.meta.url comparison doesn't work reliably with tsx on Windows
// Using a simple workaround: run if not imported as module
const isMainModule = process.argv[1]?.includes('smoke-test');
if (isMainModule) {
  runSmokeTest()
    .then(printResults)
    .catch((error) => {
      console.error('❌ Smoke test failed:', error);
      process.exit(1);
    });
}

export { runSmokeTest, type SmokeTestResults };
