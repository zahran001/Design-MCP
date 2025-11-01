// =============================================================================
// Normalization Pipeline - Main Orchestrator
// =============================================================================
// Created: 2025-10-23
// Purpose: Read raw JSON files, transform code examples, save normalized chunks
//
// This is the main integration layer that:
// - Loads raw extracted JSON files
// - Calls transformers for each code example
// - Aggregates all chunks into a single output file
// - Reports statistics and metrics
//
// =============================================================================

import fs from 'fs';
import path from 'path';
import { transformCodeExample, type RawCodeExample } from './transformers/codeExampleTransformer.js';
import type { CodeExampleChunk } from '../../schemas/NormalizedChunkSchema.js';

/**
 * Raw extracted data structure (from artifacts/raw-json/*.json)
 */
interface RawExtractedData {
  componentName: string;
  sourceUrl: string;
  description?: string;
  codeExamples: RawCodeExample[];
  props?: any[];
  relatedComponents?: string[];
}

/**
 * Normalize code examples from raw extracted JSON
 *
 * Main orchestrator function that:
 * 1. Loads raw JSON files (one component or all)
 * 2. Transforms each code example using the transformer
 * 3. Saves chunks to separate files per component
 * 4. Reports statistics (intents, tokens, quality metrics)
 *
 * Output: artifacts/normalized/{ComponentName}.json (one file per component)
 *
 * @param componentName - Optional component name (e.g., "Button"). If not provided, processes all components.
 *
 * @example
 * // Normalize just Button → creates Button.json
 * await normalizeCodeExamples("Button");
 *
 * @example
 * // Normalize all components → creates one .json per component
 * await normalizeCodeExamples();
 */
export async function normalizeCodeExamples(componentName?: string): Promise<void> {
  console.log('='.repeat(80));
  console.log('Code Example Normalization Pipeline');
  console.log('='.repeat(80));
  console.log();

  // ==========================================================================
  // Step 1: Find and Load JSON Files
  // ==========================================================================

  const rawJsonDir = path.join(process.cwd(), 'artifacts', 'raw-json');
  const outputDir = path.join(process.cwd(), 'artifacts', 'normalized');

  // Check if raw-json directory exists
  if (!fs.existsSync(rawJsonDir)) {
    throw new Error(`Raw JSON directory not found: ${rawJsonDir}`);
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}`);
  }

  // Find files to process
  let filesToProcess: string[];
  if (componentName) {
    // Process single component
    const file = findComponentFile(componentName, rawJsonDir);
    if (!file) {
      throw new Error(`Component not found: ${componentName}\n\nAvailable components:\n${listAvailableComponents(rawJsonDir)}`);
    }
    filesToProcess = [file];
    console.log(`📂 Processing single component: ${componentName}`);
  } else {
    // Process all components
    filesToProcess = fs.readdirSync(rawJsonDir).filter(f => f.endsWith('.json'));
    console.log(`📂 Processing all components (${filesToProcess.length} files)`);
  }

  console.log();

  // ==========================================================================
  // Step 2: Transform All Code Examples
  // ==========================================================================

  const allChunks: CodeExampleChunk[] = [];
  const componentStats = new Map<string, number>(); // Track examples per component
  const savedFiles: string[] = []; // Track saved output files
  let totalExamples = 0;
  let totalErrors = 0;

  for (const file of filesToProcess) {
    const filePath = path.join(rawJsonDir, file);
    let rawData: RawExtractedData;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      rawData = JSON.parse(content);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to load ${file}: ${errorMessage}`);
      totalErrors++;
      continue;
    }

    const exampleCount = rawData.codeExamples?.length || 0;
    console.log(`Processing: ${rawData.componentName} (${exampleCount} examples)`);

    if (!rawData.codeExamples || exampleCount === 0) {
      console.log(`   ⚠️  No code examples found, skipping`);
      continue;
    }

    // Transform each code example for this component
    const componentChunks: CodeExampleChunk[] = [];
    let successCount = 0;
    for (let i = 0; i < rawData.codeExamples.length; i++) {
      const example = rawData.codeExamples[i];

      // Transform with context (index + total for metrics tracking)
      // Note: Transformer now handles all errors internally with fallback generation
      const chunk = transformCodeExample(
        example,
        rawData.componentName,
        rawData.sourceUrl,
        i + 1,                          // Example index (1-based)
        rawData.codeExamples.length     // Total examples for this component
      );

      componentChunks.push(chunk);
      successCount++;
      totalExamples++;
    }

    // Save this component's chunks to a separate file
    if (componentChunks.length > 0) {
      const outputFile = path.join(outputDir, `${rawData.componentName}.json`);
      fs.writeFileSync(outputFile, JSON.stringify(componentChunks, null, 2), 'utf-8');
      savedFiles.push(outputFile);
      console.log(`   💾 Saved ${componentChunks.length} chunks to ${rawData.componentName}.json`);

      // Also accumulate for statistics
      allChunks.push(...componentChunks);
    }

    componentStats.set(rawData.componentName, successCount);
    console.log(`   ✅ Transformed ${successCount}/${exampleCount} examples`);
  }

  console.log();

  // ==========================================================================
  // Step 3: Summary
  // ==========================================================================

  console.log(`✅ Saved ${savedFiles.length} component file(s) to: ${outputDir}`);
  console.log();

  // ==========================================================================
  // Step 4: Report Statistics
  // ==========================================================================

  console.log('='.repeat(80));
  console.log('✅ Normalization Complete!');
  console.log('='.repeat(80));
  console.log();

  // Basic statistics
  console.log('📊 Summary:');
  console.log(`   - Components processed: ${componentStats.size}`);
  console.log(`   - Code examples transformed: ${totalExamples}`);
  console.log(`   - Chunks created: ${allChunks.length}`);
  if (totalErrors > 0) {
    console.log(`   - Errors encountered: ${totalErrors}`);
  }
  console.log();

  // Note: Token statistics computed during transformation and logged if outside optimal range
  // See transformer output for warnings about sub-optimal token counts

  // Intent distribution
  if (allChunks.length > 0) {
    const intents = new Map<string, number>();
    allChunks.forEach(c => {
      intents.set(c.example.intent, (intents.get(c.example.intent) || 0) + 1);
    });

    console.log('🎯 Intent Distribution:');
    Array.from(intents.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([intent, count]) => {
        const pct = ((count / totalExamples) * 100).toFixed(1);
        console.log(`   - ${intent}: ${count} (${pct}%)`);
      });
    console.log();
  }

  // Category distribution
  if (allChunks.length > 0) {
    const categories = new Map<string, number>();
    allChunks.forEach(c => {
      categories.set(c.metadata.category, (categories.get(c.metadata.category) || 0) + 1);
    });

    console.log('📂 Category Distribution:');
    Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        const pct = ((count / totalExamples) * 100).toFixed(1);
        console.log(`   - ${category}: ${count} (${pct}%)`);
      });
    console.log();
  }

  // Quality metrics
  if (allChunks.length > 0) {
    const semanticSections = allChunks.filter(c =>
      c.example.title !== 'Usage Example'
    ).length;
    const semanticPct = ((semanticSections / allChunks.length) * 100).toFixed(1);

    const specificIntents = allChunks.filter(c =>
      c.example.intent !== 'generic'
    ).length;
    const specificPct = ((specificIntents / allChunks.length) * 100).toFixed(1);

    console.log('🎯 Quality Metrics:');
    console.log(`   - Semantic sections: ${semanticSections}/${allChunks.length} (${semanticPct}%)`);
    console.log(`   - Specific intents: ${specificIntents}/${allChunks.length} (${specificPct}%)`);
    console.log();
  }

  console.log('='.repeat(80));
  console.log(`📄 Output Directory: ${outputDir}`);
  console.log(`📄 Files Created: ${savedFiles.length}`);
  if (savedFiles.length > 0 && savedFiles.length <= 10) {
    // Show individual files if count is reasonable
    savedFiles.forEach(f => console.log(`   - ${path.basename(f)}`));
  }
  console.log('='.repeat(80));
}

/**
 * Find JSON file for a specific component
 *
 * @param componentName - Component name (case-insensitive)
 * @param dir - Directory to search
 * @returns Filename if found, null otherwise
 */
function findComponentFile(componentName: string, dir: string): string | null {
  const files = fs.readdirSync(dir);
  const match = files.find(f =>
    f.toLowerCase().startsWith(componentName.toLowerCase()) &&
    f.endsWith('.json')
  );
  return match || null;
}

/**
 * List all available components in the raw JSON directory
 *
 * @param dir - Directory to search
 * @returns Formatted list of component names
 */
function listAvailableComponents(dir: string): string {
  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.split('-')[0])
    .sort();

  return files.map(name => `  - ${name}`).join('\n');
}
