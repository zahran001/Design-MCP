// =============================================================================
// Test Template Generators with Real Extracted Data
// =============================================================================
// Purpose: Validate template generators using real Chakra UI code examples
// Usage: npx tsx scripts/test-with-real-data.ts Button
//
// For POC: Processes Button component only, shows all examples with full code
// =============================================================================

import fs from 'fs';
import path from 'path';
import { analyzeCode } from '../src/steps/1-normalize/inference/codeAnalyzer.js';
import { inferSectionTitle } from '../src/steps/1-normalize/inference/sectionInferrer.js';
import { classifyIntent } from '../src/steps/1-normalize/inference/intentClassifier.js';
import { extractTemplateData, getPrimaryComponent } from '../src/steps/1-normalize/generators/templateDataExtractor.js';
import { generateContent } from '../src/steps/1-normalize/generators/explanationGenerator.js';

// =============================================================================
// Types
// =============================================================================

interface CodeExample {
  code: string;
  score?: number;
  complexity?: string;
  section?: string;
}

interface ExtractedData {
  componentName: string;
  sourceUrl: string;
  description?: string;
  codeExamples: CodeExample[];
}

interface ProcessingResult {
  exampleIndex: number;
  sectionTitle: string;
  sectionConfidence: number;
  sectionMethod: string;
  intent: string;
  intentConfidence: number;
  intentIndicators: string[];
  explanation: string;
  demonstrates: string[];
  keyPoints: string[];
}

// =============================================================================
// Main Function
// =============================================================================

async function main() {
  const componentName = 'Button'; // POC: Hardcoded to Button

  console.log('='.repeat(80));
  console.log(`Testing Template Generators with Real Data: ${componentName}`);
  console.log('='.repeat(80));
  console.log();

  // Find and load JSON file
  const jsonFile = findJsonFile(componentName);
  if (!jsonFile) {
    console.error(`❌ Could not find JSON file for component: ${componentName}`);
    console.log('\nAvailable files:');
    listAvailableComponents();
    process.exit(1);
  }

  console.log(`📂 Loading: ${path.basename(jsonFile)}`);
  const data = loadJsonFile(jsonFile);

  console.log(`📊 Component: ${data.componentName}`);
  console.log(`🔗 Source: ${data.sourceUrl}`);
  console.log(`📝 Description: ${data.description || 'N/A'}`);
  console.log(`🧪 Code Examples: ${data.codeExamples.length}`);
  console.log();

  // Process all examples
  const results: ProcessingResult[] = [];

  for (let i = 0; i < data.codeExamples.length; i++) {
    const example = data.codeExamples[i];
    const result = processExample(example, i, data.componentName);
    results.push(result);
    displayExample(example, result, i + 1, data.codeExamples.length);
  }

  // Display summary
  displaySummary(results, data.codeExamples.length);
}

// =============================================================================
// File Operations
// =============================================================================

function findJsonFile(componentName: string): string | null {
  const artifactsDir = path.join(process.cwd(), 'artifacts', 'raw-json');

  if (!fs.existsSync(artifactsDir)) {
    console.error(`❌ Artifacts directory not found: ${artifactsDir}`);
    return null;
  }

  const files = fs.readdirSync(artifactsDir);

  // Look for file matching component name (case-insensitive)
  const matchingFile = files.find(file =>
    file.toLowerCase().startsWith(componentName.toLowerCase()) &&
    file.endsWith('.json')
  );

  if (!matchingFile) {
    return null;
  }

  return path.join(artifactsDir, matchingFile);
}

function loadJsonFile(filePath: string): ExtractedData {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

function listAvailableComponents() {
  const artifactsDir = path.join(process.cwd(), 'artifacts', 'raw-json');

  if (!fs.existsSync(artifactsDir)) {
    return;
  }

  const files = fs.readdirSync(artifactsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.split('-')[0]);

  files.forEach(comp => console.log(`  - ${comp}`));
}

// =============================================================================
// Processing
// =============================================================================

function processExample(
  example: CodeExample,
  index: number,
  componentName: string
): ProcessingResult {
  // Step 1: Analyze code
  const analysis = analyzeCode(example.code);

  // Step 2: Infer section title
  const section = inferSectionTitle(
    example.code,
    example.section,
    componentName
  );

  // Step 3: Classify intent
  const intent = classifyIntent(example.code, analysis, section.title);

  // Step 4: Extract template data
  const templateData = extractTemplateData(
    intent.intent,
    analysis,
    componentName
  );

  // Step 5: Generate natural language
  const content = generateContent(templateData);

  return {
    exampleIndex: index,
    sectionTitle: section.title,
    sectionConfidence: section.confidence,
    sectionMethod: section.method,
    intent: intent.intent,
    intentConfidence: intent.confidence,
    intentIndicators: intent.indicators,
    explanation: content.explanation,
    demonstrates: content.demonstrates,
    keyPoints: content.keyPoints
  };
}

// =============================================================================
// Display Functions
// =============================================================================

function displayExample(
  example: CodeExample,
  result: ProcessingResult,
  currentNum: number,
  total: number
) {
  console.log('━'.repeat(80));
  console.log(`Example ${currentNum}/${total}`);
  console.log('━'.repeat(80));

  // Show metadata if available
  if (example.section || example.complexity || example.score !== undefined) {
    console.log('📋 Original Metadata:');
    if (example.section) {
      console.log(`   Section: ${example.section}`);
    }
    if (example.complexity) {
      console.log(`   Complexity: ${example.complexity}`);
    }
    if (example.score !== undefined) {
      console.log(`   Score: ${example.score}`);
    }
    console.log();
  }

  // Show full code
  console.log('📝 Code:');
  console.log('─'.repeat(80));
  console.log(example.code);
  console.log('─'.repeat(80));
  console.log();

  // Show inference results
  console.log('🔍 Inference Results:');
  console.log(`   🎯 Section: "${result.sectionTitle}"`);
  console.log(`      - Confidence: ${result.sectionConfidence.toFixed(2)}`);
  console.log(`      - Method: ${result.sectionMethod}`);
  console.log();
  console.log(`   🏷️  Intent: "${result.intent}"`);
  console.log(`      - Confidence: ${result.intentConfidence.toFixed(2)}`);
  console.log(`      - Indicators: ${result.intentIndicators.join(', ')}`);
  console.log();

  // Show generated content
  console.log('✨ Generated Content:');
  console.log();
  console.log('   📄 Explanation:');
  console.log(`      ${result.explanation}`);
  console.log();

  console.log(`   📋 Demonstrates (${result.demonstrates.length} points):`);
  result.demonstrates.forEach((point, idx) => {
    console.log(`      ${idx + 1}. ${point}`);
  });
  console.log();

  console.log(`   💡 Key Points (${result.keyPoints.length} points):`);
  result.keyPoints.forEach((point, idx) => {
    console.log(`      ${idx + 1}. ${point}`);
  });
  console.log();
}

function displaySummary(results: ProcessingResult[], total: number) {
  console.log('='.repeat(80));
  console.log('Summary');
  console.log('='.repeat(80));
  console.log();

  console.log(`✅ Processed: ${results.length}/${total} examples`);
  console.log();

  // Intent distribution
  const intentCounts = new Map<string, number>();
  results.forEach(r => {
    intentCounts.set(r.intent, (intentCounts.get(r.intent) || 0) + 1);
  });

  console.log('📊 Intent Distribution:');
  Array.from(intentCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([intent, count]) => {
      const percentage = ((count / total) * 100).toFixed(1);
      console.log(`   - ${intent}: ${count} examples (${percentage}%)`);
    });
  console.log();

  // Confidence scores
  const avgSectionConfidence =
    results.reduce((sum, r) => sum + r.sectionConfidence, 0) / results.length;
  const avgIntentConfidence =
    results.reduce((sum, r) => sum + r.intentConfidence, 0) / results.length;

  console.log('📈 Average Confidence Scores:');
  console.log(`   - Section Inference: ${avgSectionConfidence.toFixed(2)}`);
  console.log(`   - Intent Classification: ${avgIntentConfidence.toFixed(2)}`);
  console.log();

  // Low confidence warnings
  const lowConfidence = results.filter(r =>
    r.sectionConfidence < 0.7 || r.intentConfidence < 0.7
  );

  if (lowConfidence.length > 0) {
    console.log(`⚠️  Low Confidence Examples (${lowConfidence.length}):`);
    lowConfidence.forEach(r => {
      console.log(`   - Example ${r.exampleIndex + 1}: ${r.sectionTitle} → ${r.intent}`);
      console.log(`     Section: ${r.sectionConfidence.toFixed(2)}, Intent: ${r.intentConfidence.toFixed(2)}`);
    });
    console.log();
  }

  // Generic intent warnings
  const genericExamples = results.filter(r => r.intent === 'generic');
  if (genericExamples.length > 0) {
    console.log(`💡 Generic Intent (${genericExamples.length}):`);
    console.log('   These examples might benefit from better pattern matching:');
    genericExamples.forEach(r => {
      console.log(`   - Example ${r.exampleIndex + 1}: "${r.sectionTitle}"`);
    });
    console.log();
  }

  // Success metrics
  const highConfidence = results.filter(r =>
    r.sectionConfidence >= 0.8 && r.intentConfidence >= 0.8
  );
  const successRate = ((highConfidence.length / total) * 100).toFixed(1);

  console.log('🎯 Quality Metrics:');
  console.log(`   - High Confidence (≥0.8): ${highConfidence.length}/${total} (${successRate}%)`);
  console.log(`   - Specific Intents: ${total - genericExamples.length}/${total} (${((1 - genericExamples.length / total) * 100).toFixed(1)}%)`);
  console.log();

  console.log('='.repeat(80));
  console.log('✅ POC Test Complete!');
  console.log('='.repeat(80));
}

// =============================================================================
// Run
// =============================================================================

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
