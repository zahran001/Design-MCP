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
import { transformProp } from './transformers/propReferenceTransformer.js';
import type { CodeExampleChunk, PropReferenceChunk, PropCategory } from '../../schemas/NormalizedChunkSchema.js';
import { PropReferenceChunkSchema, getChunkTokenCount } from '../../schemas/NormalizedChunkSchema.js';
import type { Prop } from '../../schemas/RAGResultSchema.js';

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

      // Transform with new options-based API (Stage 4)
      // Note: Transformer handles all errors internally with fallback generation
      const result = transformCodeExample({
        rawExample: example,
        componentName: rawData.componentName,
        sourceUrl: rawData.sourceUrl,
        context: {
          exampleIndex: i + 1,                      // 1-based index
          totalExamples: rawData.codeExamples.length
        }
      });

      // Extract chunk from result (success or fallback)
      const chunk = result.status === 'success' ? result.chunk : result.fallbackChunk!;

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
 * Normalize prop references from raw extracted JSON
 *
 * Main orchestrator function that:
 * 1. Loads raw JSON files (one component or all)
 * 2. Transforms each prop using transformProp()
 * 3. Validates with PropReferenceChunkSchema.safeParse()
 * 4. Saves chunks to separate -props.json files per component
 * 5. Reports statistics (category distribution, token compliance)
 *
 * Output: artifacts/normalized/{ComponentName}-props.json (one file per component)
 *
 * @param componentName - Optional component name (e.g., "Button"). If not provided, processes all components.
 *
 * @example
 * // Normalize just Button props → creates Button-props.json
 * await normalizePropReferences("Button");
 *
 * @example
 * // Normalize all component props → creates one -props.json per component
 * await normalizePropReferences();
 */
export async function normalizePropReferences(componentName?: string): Promise<void> {
  console.log('='.repeat(80));
  console.log('Prop Reference Normalization Pipeline');
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
  // Step 2: Transform All Prop References
  // ==========================================================================

  const allPropChunks: PropReferenceChunk[] = [];
  const categoryStats = new Map<PropCategory, number>();
  const tokenStats: { min: number; max: number; total: number; count: number } = {
    min: Infinity,
    max: 0,
    total: 0,
    count: 0
  };
  let totalPropsProcessed = 0;
  let totalValidationErrors = 0;
  let totalTransformErrors = 0;

  for (const file of filesToProcess) {
    const filePath = path.join(rawJsonDir, file);
    let rawData: RawExtractedData;

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      rawData = JSON.parse(content);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`❌ Failed to load ${file}: ${errorMessage}`);
      totalTransformErrors++;
      continue;
    }

    const propCount = rawData.props?.length || 0;
    console.log(`Processing: ${rawData.componentName} (${propCount} props)`);

    if (!rawData.props || propCount === 0) {
      console.log(`   ⚠️  No props found, skipping`);
      continue;
    }

    // Transform each prop for this component
    const componentPropChunks: PropReferenceChunk[] = [];
    const propErrors: { propName: string; error: string }[] = [];

    for (const prop of rawData.props) {
      try {
        // Transform prop with Phase 1 transformer
        const chunk = transformProp(
          prop,
          rawData.componentName,
          rawData.sourceUrl,
          rawData.props
        );

        // CRITICAL: Validate with schema before saving
        const validation = PropReferenceChunkSchema.safeParse(chunk);
        if (!validation.success) {
          const errors = validation.error.errors
            .map(e => `${e.path.join('.')} - ${e.message}`)
            .join('; ');
          propErrors.push({ propName: prop.name, error: errors });
          totalValidationErrors++;
          console.warn(`   ✗ Validation failed for prop "${prop.name}": ${errors}`);
          continue;
        }

        const validatedChunk = validation.data;
        componentPropChunks.push(validatedChunk);

        // Track token statistics
        const tokens = getChunkTokenCount(validatedChunk);
        tokenStats.total += tokens;
        tokenStats.count++;
        tokenStats.min = Math.min(tokenStats.min, tokens);
        tokenStats.max = Math.max(tokenStats.max, tokens);

        // Track category distribution
        const category = validatedChunk.prop.category;
        categoryStats.set(category, (categoryStats.get(category) || 0) + 1);

        totalPropsProcessed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        propErrors.push({ propName: prop.name, error: errorMessage });
        totalTransformErrors++;
        console.warn(`   ✗ Transform error for prop "${prop.name}": ${errorMessage}`);
      }
    }

    // Save this component's prop chunks to a separate file
    if (componentPropChunks.length > 0) {
      const propsOutputFile = path.join(outputDir, `${rawData.componentName}-props.json`);
      try {
        fs.writeFileSync(propsOutputFile, JSON.stringify(componentPropChunks, null, 2), 'utf-8');
        console.log(`   ✓ Saved ${componentPropChunks.length} prop chunks to ${rawData.componentName}-props.json`);
        allPropChunks.push(...componentPropChunks);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`   ✗ Failed to write ${rawData.componentName}-props.json: ${errorMessage}`);
      }
    }

    // Log error summary for this component
    if (propErrors.length > 0) {
      console.log(`   ⚠️  ${propErrors.length} errors (logged above)`);
    }
  }

  console.log();

  // ==========================================================================
  // Step 3: Summary
  // ==========================================================================

  console.log('='.repeat(80));
  console.log('✅ Prop Reference Normalization Complete!');
  console.log('='.repeat(80));
  console.log();

  // Basic statistics
  console.log('📊 Summary:');
  console.log(`   - Props processed: ${totalPropsProcessed}`);
  console.log(`   - Chunks created: ${allPropChunks.length}`);
  if (totalTransformErrors > 0) {
    console.log(`   - Transform errors: ${totalTransformErrors}`);
  }
  if (totalValidationErrors > 0) {
    console.log(`   - Validation errors: ${totalValidationErrors}`);
  }
  console.log();

  // Category distribution
  if (allPropChunks.length > 0) {
    console.log('📂 Category Distribution:');
    Array.from(categoryStats.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        const pct = ((count / allPropChunks.length) * 100).toFixed(1);
        console.log(`   - ${category}: ${count} (${pct}%)`);
      });
    console.log();
  }

  // Token statistics
  if (tokenStats.count > 0) {
    const avgTokens = (tokenStats.total / tokenStats.count).toFixed(1);
    const optimal = allPropChunks.filter(chunk => {
      const tokens = getChunkTokenCount(chunk);
      return tokens >= 100 && tokens <= 250;
    }).length;
    const optimalPct = ((optimal / tokenStats.count) * 100).toFixed(1);

    console.log('📊 Token Statistics:');
    console.log(`   - Average: ${avgTokens} tokens`);
    console.log(`   - Range: ${tokenStats.min}-${tokenStats.max} tokens`);
    console.log(`   - Optimal range (100-250): ${optimal}/${tokenStats.count} (${optimalPct}%)`);
    if (optimal < tokenStats.count * 0.9) {
      console.log(`   ⚠️  Warning: ${((tokenStats.count - optimal) / tokenStats.count * 100).toFixed(1)}% of chunks outside optimal range`);
    }
    console.log();
  }

  console.log('='.repeat(80));
  console.log(`📄 Output Directory: ${outputDir}`);
  console.log(`📄 Files Created: ${Math.ceil(allPropChunks.length / 10)} component prop files (average 10 props per file)`);
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
