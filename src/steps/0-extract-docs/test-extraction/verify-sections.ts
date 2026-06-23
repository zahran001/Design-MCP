// Phase 3 verification: run the REAL extractComponent against a few live pages
// and report how many code examples now carry a heading + intro prose, versus
// the old baseline (Button: 1/16 headings, 0 prose).
//
// Usage: npx tsx src/steps/0-extract-docs/test-extraction/verify-sections.ts
import { chromium } from 'playwright';
import { extractComponent } from '../extractors.js';

const URLS = [
  'https://chakra-ui.com/docs/components/button',
  'https://chakra-ui.com/docs/components/checkbox',
  'https://chakra-ui.com/docs/components/stack',
];

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  for (const url of URLS) {
    await page.goto(url, { waitUntil: 'networkidle' });
    const doc = await extractComponent(page, url);
    const examples = doc?.codeExamples ?? [];
    const withSection = examples.filter((e) => e.section).length;
    const withProse = examples.filter((e) => e.sectionDescription).length;

    console.log(`\n${'='.repeat(70)}\n${doc?.componentName} — ${url}`);
    console.log(`examples: ${examples.length} | with heading: ${withSection} | with prose: ${withProse}`);
    for (const e of examples.slice(0, 8)) {
      const sec = (e.section || '(none)').padEnd(20);
      const prose = e.sectionDescription ? e.sectionDescription.slice(0, 70) : '—';
      console.log(`  [${sec}] ${prose}`);
    }
  }

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
