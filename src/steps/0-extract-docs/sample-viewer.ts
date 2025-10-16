// =============================================================================
// Sample Viewer - Manual review helper for extraction quality
// =============================================================================
// Run: npx tsx src/steps/0-extract-docs/sample-viewer.ts [count]
//
// Purpose: Display random samples for manual quality assessment
// - Pretty-prints extracted component docs
// - Highlights key fields for quick review
// - Supports custom sample count
// =============================================================================

import fs from 'fs/promises';
import path from 'path';
import { ComponentDocSchema, type ComponentDoc } from '../../schemas/RAGResultSchema.js';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function colorize(color: keyof typeof COLORS, text: string): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function formatCodeExample(code: string, maxLines: number = 10): string {
  const lines = code.split('\n');
  const preview = lines.slice(0, maxLines).join('\n');
  const truncated = lines.length > maxLines;

  return truncated ? `${preview}\n${colorize('dim', `... (${lines.length - maxLines} more lines)`)}` : preview;
}

function printComponent(doc: ComponentDoc, index: number, total: number) {
  console.log('='.repeat(70));
  console.log(colorize('bright', `📦 Sample ${index + 1}/${total}: ${doc.componentName}`));
  console.log('='.repeat(70));
  console.log();

  // Source URL
  console.log(colorize('cyan', '🔗 Source:'));
  console.log(`   ${doc.sourceUrl}`);
  console.log();

  // Description
  if (doc.description) {
    console.log(colorize('cyan', '📝 Description:'));
    const descLines = doc.description.match(/.{1,66}/g) || [];
    descLines.forEach(line => console.log(`   ${line}`));
    console.log(`   ${colorize('dim', `(${doc.description.length} chars)`)}`);
  } else {
    console.log(colorize('yellow', '⚠️  No description'));
  }
  console.log();

  // Code Examples
  if (doc.codeExamples && doc.codeExamples.length > 0) {
    console.log(colorize('cyan', `💻 Code Examples (${doc.codeExamples.length}):`));
    doc.codeExamples.slice(0, 3).forEach((example, i) => {
      console.log();
      console.log(colorize('green', `   Example ${i + 1}:`));

      if (example.section) {
        console.log(colorize('dim', `   Section: ${example.section}`));
      }
      if (example.language) {
        console.log(colorize('dim', `   Language: ${example.language}`));
      }

      console.log();
      const formatted = formatCodeExample(example.code, 8);
      formatted.split('\n').forEach(line => console.log(`   ${line}`));
    });

    if (doc.codeExamples.length > 3) {
      console.log();
      console.log(colorize('dim', `   ... and ${doc.codeExamples.length - 3} more examples`));
    }
  } else {
    console.log(colorize('yellow', '⚠️  No code examples'));
  }
  console.log();

  // Related Components
  if (doc.relatedComponents && doc.relatedComponents.length > 0) {
    console.log(colorize('cyan', '🔗 Related Components:'));
    console.log(`   ${doc.relatedComponents.join(', ')}`);
  } else {
    console.log(colorize('dim', '   No related components detected'));
  }
  console.log();

  // Manual review checklist
  console.log(colorize('magenta', '✅ Manual Review Checklist:'));
  console.log('   [ ] Description is clear and self-contained?');
  console.log('   [ ] Code examples are executable (copy-paste ready)?');
  console.log('   [ ] Related components make intuitive sense?');
  console.log('   [ ] Content answers "how do I use this component"?');
  console.log();
}

async function viewSamples(count: number = 3) {
  const artifactsDir = path.join(process.cwd(), 'artifacts', 'raw-json');

  console.log(colorize('bright', '🔍 Sample Viewer - Manual Quality Review'));
  console.log();

  const files = await fs.readdir(artifactsDir);
  const jsonFiles = files.filter(f => f.endsWith('.json') && f !== '.gitkeep');

  if (jsonFiles.length === 0) {
    console.error(colorize('yellow', '⚠️  No JSON files found in artifacts/raw-json/'));
    process.exit(1);
  }

  // Randomly select samples
  const sampleCount = Math.min(count, jsonFiles.length);
  const shuffled = [...jsonFiles].sort(() => Math.random() - 0.5);
  const selectedFiles = shuffled.slice(0, sampleCount);

  console.log(`📊 Found ${jsonFiles.length} files, sampling ${sampleCount} random components`);
  console.log();

  // Load and display samples
  const samples: ComponentDoc[] = [];

  for (const file of selectedFiles) {
    const filePath = path.join(artifactsDir, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    const validation = ComponentDocSchema.safeParse(data);

    if (!validation.success) {
      console.error(colorize('yellow', `⚠️  Skipping invalid file: ${file}`));
      console.error(colorize('dim', validation.error.errors.map(e => `   ${e.path.join('.')}: ${e.message}`).join('\n')));
      continue;
    }

    samples.push(validation.data);
  }

  samples.forEach((doc, i) => printComponent(doc, i, samples.length));

  // Summary
  console.log('='.repeat(70));
  console.log(colorize('bright', '📋 Summary'));
  console.log('='.repeat(70));
  console.log();

  const withDesc = samples.filter(s => s.description).length;
  const withCode = samples.filter(s => s.codeExamples && s.codeExamples.length > 0).length;
  const withRelated = samples.filter(s => s.relatedComponents && s.relatedComponents.length > 0).length;
  const avgCodeExamples = samples.reduce((sum, s) => sum + (s.codeExamples?.length || 0), 0) / samples.length;

  console.log(`   Components with descriptions: ${withDesc}/${samples.length}`);
  console.log(`   Components with code examples: ${withCode}/${samples.length}`);
  console.log(`   Components with related components: ${withRelated}/${samples.length}`);
  console.log(`   Average code examples: ${avgCodeExamples.toFixed(1)}`);
  console.log();

  console.log(colorize('cyan', '💡 Next Steps:'));
  console.log('   1. Review checklist items above for each sample');
  console.log('   2. If 2+ samples pass all checks → Ready for RAG');
  console.log('   3. If major issues found → Adjust extractors.ts and re-run');
  console.log('   4. Run full smoke test: npm run quality:smoke');
  console.log();
}

// Main execution
// Note: import.meta.url comparison doesn't work reliably with tsx on Windows
const isMainModule = process.argv[1]?.includes('sample-viewer');
if (isMainModule) {
  const count = parseInt(process.argv[2] || '3', 10);

  if (isNaN(count) || count < 1) {
    console.error('Usage: npx tsx src/steps/0-extract-docs/sample-viewer.ts [count]');
    console.error('Example: npx tsx src/steps/0-extract-docs/sample-viewer.ts 5');
    process.exit(1);
  }

  viewSamples(count).catch((error) => {
    console.error(colorize('yellow', '❌ Sample viewer failed:'), error);
    process.exit(1);
  });
}

export { viewSamples };
