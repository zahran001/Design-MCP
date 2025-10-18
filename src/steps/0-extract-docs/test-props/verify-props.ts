// =============================================================================
// Props Verification Script
// =============================================================================
// Analyze all extracted JSON files and report props statistics
//
// USAGE: npx tsx src/steps/0-extract-docs/test-props/verify-props.ts
// =============================================================================

import fs from 'fs';
import path from 'path';
import { ComponentDocSchema } from '../../../schemas/RAGResultSchema.js';

const ARTIFACTS_DIR = path.join(process.cwd(), 'artifacts', 'raw-json');

interface Stats {
  totalFiles: number;
  withProps: number;
  withoutProps: number;
  totalProps: number;
  propsByComponent: Array<{ component: string; propsCount: number; sampleProps: string[] }>;
}

async function analyzeArtifacts() {
  console.log('🔍 Props Verification Report\n');
  console.log('='.repeat(80));

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    console.log(`❌ Artifacts directory not found: ${ARTIFACTS_DIR}`);
    console.log('Run extraction first: npm run cli -- 0-extract-docs');
    process.exit(1);
  }

  const files = fs.readdirSync(ARTIFACTS_DIR).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('❌ No JSON files found in artifacts directory');
    process.exit(1);
  }

  console.log(`📁 Found ${files.length} JSON files\n`);

  const stats: Stats = {
    totalFiles: files.length,
    withProps: 0,
    withoutProps: 0,
    totalProps: 0,
    propsByComponent: [],
  };

  for (const file of files) {
    const filePath = path.join(ARTIFACTS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    try {
      const json = JSON.parse(content);
      const result = ComponentDocSchema.safeParse(json);

      if (!result.success) {
        console.log(`⚠️  ${file}: Schema validation failed`);
        continue;
      }

      const doc = result.data;
      const propsCount = doc.props?.length || 0;

      if (propsCount > 0) {
        stats.withProps++;
        stats.totalProps += propsCount;

        // Sample first 3 prop names
        const sampleProps = doc.props!.slice(0, 3).map(p => p.name);

        stats.propsByComponent.push({
          component: doc.componentName,
          propsCount,
          sampleProps,
        });
      } else {
        stats.withoutProps++;
      }
    } catch (error) {
      console.log(`❌ ${file}: Failed to parse JSON`);
    }
  }

  // Sort by props count (descending)
  stats.propsByComponent.sort((a, b) => b.propsCount - a.propsCount);

  // Print summary
  console.log('📊 Summary\n');
  console.log(`Total components: ${stats.totalFiles}`);
  console.log(`✅ With props: ${stats.withProps} (${((stats.withProps / stats.totalFiles) * 100).toFixed(1)}%)`);
  console.log(`⚪ Without props: ${stats.withoutProps} (${((stats.withoutProps / stats.totalFiles) * 100).toFixed(1)}%)`);
  console.log(`📋 Total props extracted: ${stats.totalProps}`);
  console.log(`📈 Average props per component: ${(stats.totalProps / stats.withProps).toFixed(1)}`);

  // Top 10 components by props count
  console.log('\n' + '='.repeat(80));
  console.log('\n🏆 Top 10 Components by Props Count\n');

  stats.propsByComponent.slice(0, 10).forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.component}: ${item.propsCount} props`);
    console.log(`   Sample: ${item.sampleProps.join(', ')}`);
  });

  // Components without props
  if (stats.withoutProps > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('\n📝 Components Without Props\n');
    console.log('(These may be presentation-only components or pages without props tables)\n');

    const componentsWithoutProps = files
      .map(file => {
        const content = fs.readFileSync(path.join(ARTIFACTS_DIR, file), 'utf-8');
        const json = JSON.parse(content);
        return json.componentName && (!json.props || json.props.length === 0) ? json.componentName : null;
      })
      .filter(Boolean);

    componentsWithoutProps.forEach(name => console.log(`  - ${name}`));
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Verification complete!');
}

analyzeArtifacts().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
