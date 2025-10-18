// =============================================================================
// Props Extraction Test Suite
// =============================================================================
// Test props extraction on representative Chakra UI components
//
// USAGE: npx tsx src/steps/0-extract-docs/test-props/test-props.ts
//
// PATTERNS TESTED:
//   Pattern 1: No props (Color Swatch)
//   Pattern 2: Simple props table (For)
//   Pattern 3: Composite props with subcomponents (Combobox)
// =============================================================================

import { chromium } from 'playwright';
import { extractComponent } from '../extractors.js';

// Test URLs
const TEST_CASES = [
  {
    name: 'Color Swatch (Pattern 1: No Props)',
    url: 'https://chakra-ui.com/docs/components/color-swatch',
    expectedPattern: 1,
    expectedPropsCount: 0,
  },
  {
    name: 'For (Pattern 2: Simple Props)',
    url: 'https://chakra-ui.com/docs/components/for',
    expectedPattern: 2,
    expectedPropsMin: 1, // Should have at least 1 prop
  },
  {
    name: 'Combobox (Pattern 3: Composite Props)',
    url: 'https://chakra-ui.com/docs/components/combobox',
    expectedPattern: 3,
    expectedPropsMin: 5, // Should have multiple props across subcomponents
  },
];

async function runTests() {
  console.log('🧪 Props Extraction Test Suite\n');
  console.log('='.repeat(80));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    console.log(`\n📋 Test: ${testCase.name}`);
    console.log(`🔗 URL: ${testCase.url}`);
    console.log('-'.repeat(80));

    try {
      const page = await context.newPage();
      await page.goto(testCase.url, { waitUntil: 'domcontentloaded' });

      // Wait for main content to load
      await page.waitForSelector('main', { timeout: 10000 });

      // Extract component
      const doc = await extractComponent(page, testCase.url);

      if (!doc) {
        console.log('❌ FAILED: extractComponent returned null');
        failed++;
        await page.close();
        continue;
      }

      // Check props extraction
      const props = doc.props || [];
      console.log(`\n✅ Component: ${doc.componentName}`);
      console.log(`📊 Props extracted: ${props.length}`);

      // Pattern-specific validation
      if (testCase.expectedPattern === 1) {
        // Pattern 1: No props expected
        if (props.length === 0) {
          console.log('✅ PASSED: No props found (as expected for Pattern 1)');
          passed++;
        } else {
          console.log(`❌ FAILED: Expected 0 props, got ${props.length}`);
          failed++;
        }
      } else if (testCase.expectedPropsMin !== undefined) {
        // Pattern 2 & 3: Should have props
        if (props.length >= testCase.expectedPropsMin) {
          console.log(`✅ PASSED: Found ${props.length} props (>= ${testCase.expectedPropsMin})`);
          passed++;

          // Display sample props
          console.log('\n📝 Sample props:');
          props.slice(0, 5).forEach(prop => {
            console.log(`  - ${prop.name}: ${prop.type}`);
            if (prop.defaultValue) {
              console.log(`    Default: ${prop.defaultValue}`);
            }
          });

          if (props.length > 5) {
            console.log(`  ... and ${props.length - 5} more`);
          }
        } else {
          console.log(`❌ FAILED: Expected >= ${testCase.expectedPropsMin} props, got ${props.length}`);
          failed++;
        }
      }

      await page.close();
    } catch (error) {
      console.log(`❌ FAILED: ${error}`);
      failed++;
    }
  }

  await context.close();
  await browser.close();

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Test Summary');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log('\n⚠️  Some tests failed. Review output above.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
