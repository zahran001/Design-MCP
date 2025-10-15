// Exploration script to understand Chakra UI code block structure
// Run with: npx tsx scripts/explore-code-blocks.ts
//
// Purpose: Analyze HTML patterns, heading structure, and code block types
// across multiple Chakra UI components to inform extraction strategy

import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

// Mix of heavily used and rarely used components
const COMPONENTS_TO_EXPLORE = [
  // Heavily used (core components)
  { name: 'Button', url: 'https://chakra-ui.com/docs/components/button', category: 'core' },
  { name: 'Input', url: 'https://chakra-ui.com/docs/components/input', category: 'core' },
  { name: 'Box', url: 'https://chakra-ui.com/docs/components/box', category: 'core' },

  // Moderately used
  { name: 'Dialog', url: 'https://chakra-ui.com/docs/components/dialog', category: 'overlay' },
  { name: 'Select', url: 'https://chakra-ui.com/docs/components/select', category: 'form' },

  // Less common
  { name: 'Skeleton', url: 'https://chakra-ui.com/docs/components/skeleton', category: 'feedback' },
  { name: 'Stat', url: 'https://chakra-ui.com/docs/components/stat', category: 'data-display' },
];

interface CodeBlockInfo {
  index: number;
  parentTag: string;
  parentClasses: string;
  parentId: string;
  preClasses: string;
  preDataAttrs: Record<string, string>;
  codeClasses: string;
  codeDataAttrs: Record<string, string>;
  hasCodeElement: boolean;
  precedingHeading: {
    found: boolean;
    method?: string;
    tag?: string;
    text?: string;
    id?: string;
    distance?: number;
    level?: number;
  };
  codeText: string;
  lineCount: number;
  classification: string;
  componentTags: string[];
}

interface HeadingInfo {
  tag: string;
  text: string;
  id: string;
  classes: string;
}

interface ComponentExploration {
  name: string;
  url: string;
  category: string;
  totalCodeBlocks: number;
  codeBlocks: CodeBlockInfo[];
  headings: HeadingInfo[];
  error?: string;
}

let allExplorations: ComponentExploration[] = [];

async function exploreComponent(browser: any, componentName: string, url: string, category: string): Promise<ComponentExploration> {
  const page = await browser.newPage();

  console.log(`\n📦 Exploring ${componentName}...`);

  const exploration: ComponentExploration = {
    name: componentName,
    url,
    category,
    totalCodeBlocks: 0,
    codeBlocks: [],
    headings: [],
  };

  try {
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Wait for main content
    await page.waitForSelector('main', { timeout: 10000 });

    // Find all code blocks in main
    const codeBlocks = page.locator('main pre');
    const count = await codeBlocks.count();
    exploration.totalCodeBlocks = count;

    console.log(`  └─ Found ${count} code blocks`);

    // Analyze first 5 code blocks in detail
    for (let i = 0; i < Math.min(5, count); i++) {
      const block = codeBlocks.nth(i);

      // Get detailed structure
      const structure = await block.evaluate((el) => {
        // Parent wrapper info
        const parent = el.parentElement;
        const parentTag = parent?.tagName.toLowerCase() || '';
        const parentClasses = parent?.className || '';
        const parentId = parent?.id || '';

        // Pre element info
        const preClasses = el.className || '';
        const preDataAttrs: Record<string, string> = {};
        Array.from(el.attributes).forEach((attr) => {
          if (attr.name.startsWith('data-')) {
            preDataAttrs[attr.name] = attr.value;
          }
        });

        // Code element info
        const codeEl = el.querySelector('code');
        const codeClasses = codeEl?.className || '';
        const codeDataAttrs: Record<string, string> = {};
        if (codeEl) {
          Array.from(codeEl.attributes).forEach((attr) => {
            if (attr.name.startsWith('data-')) {
              codeDataAttrs[attr.name] = attr.value;
            }
          });
        }

        return {
          parentTag,
          parentClasses,
          parentId,
          preClasses,
          preDataAttrs,
          codeClasses,
          codeDataAttrs,
          hasCodeElement: !!codeEl,
        };
      });

      // Get preceding heading with multiple search strategies
      const precedingInfo = await block.evaluate((el) => {
        // Method 1: Walk backwards through siblings
        let current = el.previousElementSibling;
        let distance = 0;
        while (current && distance < 20) {
          const tag = current.tagName.toLowerCase();
          if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
            return {
              method: 'sibling',
              found: true,
              tag,
              text: current.textContent?.trim() || '',
              id: current.id || '',
              distance,
            };
          }
          current = current.previousElementSibling;
          distance++;
        }

        // Method 2: Walk up parent tree and search backwards
        let parentEl = el.parentElement;
        let level = 0;
        while (parentEl && level < 5) {
          const headings = parentEl.querySelectorAll('h1, h2, h3, h4, h5, h6');
          for (let i = headings.length - 1; i >= 0; i--) {
            const heading = headings[i];
            if (heading.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
              return {
                method: 'parent-search',
                found: true,
                tag: heading.tagName.toLowerCase(),
                text: heading.textContent?.trim() || '',
                id: heading.id || '',
                level,
              };
            }
          }
          parentEl = parentEl.parentElement;
          level++;
        }

        return { found: false };
      });

      // Get code content
      const codeText = (await block.locator('code').first().textContent()) || '';
      const lines = codeText.trim().split('\n');
      const lineCount = lines.length;

      // Classify code type
      const classification = classifyCode(codeText);

      // Extract component tags
      const componentTags = extractComponentTags(codeText);

      const blockInfo: CodeBlockInfo = {
        index: i,
        ...structure,
        precedingHeading: precedingInfo,
        codeText,
        lineCount,
        classification,
        componentTags,
      };

      exploration.codeBlocks.push(blockInfo);
    }

    // Heading structure analysis
    const headings = page.locator('main h1, main h2, main h3');
    const headingCount = await headings.count();

    for (let i = 0; i < Math.min(15, headingCount); i++) {
      const heading = headings.nth(i);
      const info = await heading.evaluate((el) => ({
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim() || '',
        id: el.id || '',
        classes: el.className || '',
      }));

      exploration.headings.push(info);
    }

    console.log(`  ✓ Complete`);

  } catch (error: any) {
    exploration.error = error.message;
    console.log(`  ✗ Error: ${error.message}`);
  } finally {
    await page.close();
  }

  return exploration;
}

function classifyCode(code: string): string {
  const trimmed = code.trim();
  const lines = trimmed.split('\n');
  const lineCount = lines.length;

  // Installation command
  if (/(npm|yarn|pnpm|bun) (install|add|i)/.test(trimmed)) {
    return 'INSTALLATION_COMMAND';
  }

  // Import statement
  if (lineCount <= 3 && /^import\s+.*from\s+['"]/.test(trimmed)) {
    return 'IMPORT_STATEMENT';
  }

  // Package.json snippet
  if (/["']dependencies["']|["']devDependencies["']/.test(trimmed)) {
    return 'PACKAGE_JSON';
  }

  // Config file (tsconfig, etc.)
  if (/["']compilerOptions["']|["']include["']/.test(trimmed)) {
    return 'CONFIG_FILE';
  }

  // Bare JSX (no function wrapper)
  if (/^<[A-Z]/.test(trimmed) && lineCount < 5 && !/^(function|const|export)/.test(trimmed)) {
    return 'BARE_JSX';
  }

  // Component with function
  if (/(function|const)\s+\w+\s*=.*=>|function\s+\w+\s*\(/.test(trimmed)) {
    const hasJSX = /<[A-Z]/.test(trimmed);
    const hasProps = /\w+={/.test(trimmed);
    const hasHooks = /use[A-Z]\w+/.test(trimmed);
    const hasMultipleComponents = (trimmed.match(/<[A-Z]\w+/g) || []).length > 2;
    const hasEventHandler = /on[A-Z]\w+={/.test(trimmed);

    const tags = [];
    if (hasJSX) tags.push('JSX');
    if (hasProps) tags.push('PROPS');
    if (hasHooks) tags.push('HOOKS');
    if (hasMultipleComponents) tags.push('MULTI_COMPONENT');
    if (hasEventHandler) tags.push('EVENTS');

    return `COMPONENT_EXAMPLE${tags.length > 0 ? ' (' + tags.join(', ') + ')' : ''}`;
  }

  // TypeScript types
  if (/^(type|interface)\s+\w+/.test(trimmed)) {
    return 'TYPESCRIPT_TYPE';
  }

  // Shell/bash commands
  if (/^(cd|mkdir|ls|cp|mv|rm|git|curl|wget)\s/.test(trimmed)) {
    return 'SHELL_COMMAND';
  }

  return 'UNKNOWN';
}

function extractComponentTags(code: string): string[] {
  const tagPattern = /<([A-Z][A-Za-z0-9]*)/g;
  const found = new Set<string>();

  const matches = code.matchAll(tagPattern);
  for (const match of matches) {
    found.add(match[1]);
  }

  return Array.from(found).sort();
}

async function generateMarkdownReport(explorations: ComponentExploration[]): Promise<string> {
  const timestamp = new Date().toISOString().split('T')[0];

  let md = `# Chakra UI Code Block Exploration Report\n\n`;
  md += `**Generated:** ${timestamp}\n`;
  md += `**Components Analyzed:** ${explorations.length}\n`;
  md += `**Purpose:** Inform code block extraction and filtering strategy for Week 1\n\n`;
  md += `---\n\n`;

  // Table of Contents
  md += `## Table of Contents\n\n`;
  md += `1. [Executive Summary](#executive-summary)\n`;
  md += `2. [HTML Structure Patterns](#html-structure-patterns)\n`;
  md += `3. [Heading Detection Strategies](#heading-detection-strategies)\n`;
  md += `4. [Code Block Classifications](#code-block-classifications)\n`;
  md += `5. [Component-by-Component Analysis](#component-by-component-analysis)\n`;
  md += `6. [Recommendations](#recommendations)\n\n`;
  md += `---\n\n`;

  // Executive Summary
  md += `## Executive Summary\n\n`;
  const totalBlocks = explorations.reduce((sum, e) => sum + e.totalCodeBlocks, 0);
  const avgBlocks = (totalBlocks / explorations.length).toFixed(1);
  md += `- **Total code blocks found:** ${totalBlocks}\n`;
  md += `- **Average per component:** ${avgBlocks}\n`;
  md += `- **Components with errors:** ${explorations.filter(e => e.error).length}\n\n`;

  // HTML Structure Patterns
  md += `## HTML Structure Patterns\n\n`;
  md += `### Consistent Patterns Found\n\n`;

  const firstExploration = explorations.find(e => e.codeBlocks.length > 0);
  if (firstExploration && firstExploration.codeBlocks.length > 0) {
    const sample = firstExploration.codeBlocks[0];
    md += `**DOM Hierarchy:**\n\`\`\`\n`;
    md += `<${sample.parentTag}>\n`;
    md += `  └─ <pre>\n`;
    md += `      └─ <code>\n`;
    md += `\`\`\`\n\n`;
  }

  md += `### Parent Element Analysis\n\n`;
  const parentTags = explorations.flatMap(e => e.codeBlocks.map(b => b.parentTag));
  const parentTagCounts = countOccurrences(parentTags);
  md += `| Parent Tag | Count | Percentage |\n`;
  md += `|------------|-------|------------|\n`;
  Object.entries(parentTagCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count]) => {
      const pct = ((count / parentTags.length) * 100).toFixed(1);
      md += `| \`<${tag}>\` | ${count} | ${pct}% |\n`;
    });
  md += `\n`;

  md += `### Class and Data Attributes\n\n`;

  // Check for common patterns
  const hasPreClasses = explorations.some(e => e.codeBlocks.some(b => b.preClasses));
  const hasCodeClasses = explorations.some(e => e.codeBlocks.some(b => b.codeClasses));
  const hasDataAttrs = explorations.some(e => e.codeBlocks.some(b =>
    Object.keys(b.preDataAttrs).length > 0 || Object.keys(b.codeDataAttrs).length > 0
  ));

  md += `- **\`<pre>\` classes:** ${hasPreClasses ? 'Present' : 'Not found'}\n`;
  md += `- **\`<code>\` classes:** ${hasCodeClasses ? 'Present' : 'Not found'}\n`;
  md += `- **Data attributes:** ${hasDataAttrs ? 'Present' : 'Not found'}\n\n`;

  if (hasDataAttrs) {
    md += `**Data attributes found:**\n`;
    const allDataAttrs = new Set<string>();
    explorations.forEach(e => {
      e.codeBlocks.forEach(b => {
        Object.keys(b.preDataAttrs).forEach(attr => allDataAttrs.add(`<pre> ${attr}`));
        Object.keys(b.codeDataAttrs).forEach(attr => allDataAttrs.add(`<code> ${attr}`));
      });
    });
    allDataAttrs.forEach(attr => md += `- \`${attr}\`\n`);
    md += `\n`;
  }

  // Heading Detection Strategies
  md += `## Heading Detection Strategies\n\n`;

  const headingMethods = explorations.flatMap(e =>
    e.codeBlocks
      .filter(b => b.precedingHeading.found)
      .map(b => b.precedingHeading.method || 'unknown')
  );
  const methodCounts = countOccurrences(headingMethods);

  md += `### Success Rates\n\n`;
  const totalAttempts = explorations.flatMap(e => e.codeBlocks).length;
  const successfulFinds = headingMethods.length;
  const successRate = ((successfulFinds / totalAttempts) * 100).toFixed(1);

  md += `- **Success rate:** ${successRate}% (${successfulFinds}/${totalAttempts})\n`;
  md += `- **Failed to find heading:** ${totalAttempts - successfulFinds} blocks\n\n`;

  md += `### Detection Methods Used\n\n`;
  md += `| Method | Count | Percentage |\n`;
  md += `|--------|-------|------------|\n`;
  Object.entries(methodCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([method, count]) => {
      const pct = ((count / successfulFinds) * 100).toFixed(1);
      md += `| ${method} | ${count} | ${pct}% |\n`;
    });
  md += `\n`;

  md += `### Common Section Headings\n\n`;
  const sectionHeadings = explorations.flatMap(e =>
    e.codeBlocks
      .filter(b => b.precedingHeading.found && b.precedingHeading.text)
      .map(b => b.precedingHeading.text!)
  );
  const headingCounts = countOccurrences(sectionHeadings);
  const topHeadings = Object.entries(headingCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  md += `| Heading | Occurrences |\n`;
  md += `|---------|-------------|\n`;
  topHeadings.forEach(([heading, count]) => {
    md += `| ${heading} | ${count} |\n`;
  });
  md += `\n`;

  // Code Block Classifications
  md += `## Code Block Classifications\n\n`;

  const classifications = explorations.flatMap(e => e.codeBlocks.map(b => b.classification));
  const classificationCounts = countOccurrences(classifications);

  md += `### Distribution\n\n`;
  md += `| Classification | Count | Percentage |\n`;
  md += `|----------------|-------|------------|\n`;
  Object.entries(classificationCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([classification, count]) => {
      const pct = ((count / classifications.length) * 100).toFixed(1);
      md += `| ${classification} | ${count} | ${pct}% |\n`;
    });
  md += `\n`;

  md += `### Low-Value Code Blocks (Candidates for Filtering)\n\n`;
  const lowValueTypes = ['INSTALLATION_COMMAND', 'IMPORT_STATEMENT', 'PACKAGE_JSON', 'CONFIG_FILE', 'SHELL_COMMAND', 'BARE_JSX'];
  const lowValueCount = classifications.filter(c => lowValueTypes.some(lv => c.includes(lv))).length;
  const lowValuePct = ((lowValueCount / classifications.length) * 100).toFixed(1);

  md += `**Total low-value blocks:** ${lowValueCount} (${lowValuePct}%)\n\n`;
  md += `These should be filtered out:\n`;
  lowValueTypes.forEach(type => {
    const count = classificationCounts[type] || 0;
    if (count > 0) {
      md += `- **${type}:** ${count} occurrences\n`;
    }
  });
  md += `\n`;

  md += `### High-Value Code Blocks (Keep These)\n\n`;
  const highValueCount = classifications.filter(c => c.startsWith('COMPONENT_EXAMPLE')).length;
  const highValuePct = ((highValueCount / classifications.length) * 100).toFixed(1);

  md += `**Total high-value blocks:** ${highValueCount} (${highValuePct}%)\n\n`;

  // Break down component examples
  const componentExamples = classifications.filter(c => c.startsWith('COMPONENT_EXAMPLE'));
  const withProps = componentExamples.filter(c => c.includes('PROPS')).length;
  const withHooks = componentExamples.filter(c => c.includes('HOOKS')).length;
  const withMulti = componentExamples.filter(c => c.includes('MULTI_COMPONENT')).length;
  const withEvents = componentExamples.filter(c => c.includes('EVENTS')).length;

  md += `Component example breakdown:\n`;
  md += `- With props: ${withProps}\n`;
  md += `- With hooks: ${withHooks}\n`;
  md += `- Multiple components: ${withMulti}\n`;
  md += `- With event handlers: ${withEvents}\n\n`;

  // Component-by-Component Analysis
  md += `## Component-by-Component Analysis\n\n`;

  explorations.forEach(exploration => {
    md += `### ${exploration.name}\n\n`;
    md += `- **Category:** ${exploration.category}\n`;
    md += `- **URL:** ${exploration.url}\n`;
    md += `- **Total code blocks:** ${exploration.totalCodeBlocks}\n`;
    md += `- **Analyzed blocks:** ${exploration.codeBlocks.length}\n`;

    if (exploration.error) {
      md += `- **⚠️ Error:** ${exploration.error}\n\n`;
      return;
    }

    md += `\n**Section headings (top 10):**\n`;
    exploration.headings.slice(0, 10).forEach(h => {
      const indent = '  '.repeat(parseInt(h.tag.charAt(1)) - 1);
      md += `${indent}- **${h.tag}:** ${h.text}${h.id ? ` (id="${h.id}")` : ''}\n`;
    });
    md += `\n`;

    md += `**Sample code blocks:**\n\n`;
    exploration.codeBlocks.slice(0, 3).forEach((block, idx) => {
      md += `**Block ${idx + 1}:** ${block.classification}\n`;
      if (block.precedingHeading.found) {
        md += `- Section: "${block.precedingHeading.text}"\n`;
      }
      md += `- Lines: ${block.lineCount}\n`;
      if (block.componentTags.length > 0) {
        md += `- Components used: ${block.componentTags.join(', ')}\n`;
      }
      md += `\n\`\`\`\n${block.codeText.split('\n').slice(0, 5).join('\n')}`;
      if (block.lineCount > 5) {
        md += `\n... (${block.lineCount - 5} more lines)`;
      }
      md += `\n\`\`\`\n\n`;
    });

    md += `---\n\n`;
  });

  // Recommendations
  md += `## Recommendations\n\n`;
  md += `Based on the exploration findings, here are the recommended strategies:\n\n`;

  md += `### 1. HTML Selectors\n\n`;
  md += `\`\`\`typescript\n`;
  md += `// Reliable selector for code blocks\n`;
  md += `const codeBlocks = page.locator('main pre code');\n\n`;
  md += `// Parent wrapper (if needed)\n`;
  const mostCommonParent = Object.entries(parentTagCounts).sort((a, b) => b[1] - a[1])[0];
  if (mostCommonParent) {
    md += `// Most common parent: <${mostCommonParent[0]}>\n`;
  }
  md += `\`\`\`\n\n`;

  md += `### 2. Heading Detection Strategy\n\n`;
  const primaryMethod = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0];
  md += `**Primary method:** ${primaryMethod ? primaryMethod[0] : 'sibling'} (${primaryMethod ? ((primaryMethod[1] / successfulFinds) * 100).toFixed(1) : '0'}% success)\n\n`;
  md += `\`\`\`typescript\n`;
  md += `// Recommended approach: Try sibling walk first, fallback to parent search\n`;
  md += `async function findPrecedingHeading(codeBlock: Locator) {\n`;
  md += `  // Method 1: Walk backwards through siblings (up to 20 elements)\n`;
  md += `  // Method 2: Walk up parent tree and search backwards\n`;
  md += `  // Return null if not found\n`;
  md += `}\n`;
  md += `\`\`\`\n\n`;

  md += `### 3. Section-Based Filtering\n\n`;
  md += `**Sections to skip (low-value code):**\n`;
  const skipSections = ['Installation', 'Import', 'Setup', 'Getting Started', 'Prerequisites'];
  skipSections.forEach(section => {
    const found = sectionHeadings.filter(h => h.toLowerCase().includes(section.toLowerCase())).length;
    md += `- "${section}" (found ${found} times)\n`;
  });
  md += `\n`;

  md += `### 4. Content Heuristics\n\n`;
  md += `**Filter out:**\n`;
  md += `- Installation commands (${classificationCounts['INSTALLATION_COMMAND'] || 0} found)\n`;
  md += `- Import statements < 3 lines (${classificationCounts['IMPORT_STATEMENT'] || 0} found)\n`;
  md += `- Package.json snippets (${classificationCounts['PACKAGE_JSON'] || 0} found)\n`;
  md += `- Config files (${classificationCounts['CONFIG_FILE'] || 0} found)\n\n`;

  md += `**Keep:**\n`;
  md += `- Component examples with props (${withProps} found)\n`;
  md += `- Examples with hooks (${withHooks} found)\n`;
  md += `- Multi-component compositions (${withMulti} found)\n`;
  md += `- Examples with event handlers (${withEvents} found)\n\n`;

  md += `### 5. Expected Filtering Impact\n\n`;
  const expectedKept = highValueCount;
  const expectedFiltered = lowValueCount;
  const reductionPct = ((expectedFiltered / classifications.length) * 100).toFixed(1);

  md += `**Before filtering:** ${classifications.length} code blocks\n`;
  md += `**After filtering:** ~${expectedKept} code blocks (${reductionPct}% reduction)\n\n`;
  md += `This aligns with the Week 1 goal: **8-15 high-quality examples per component**\n\n`;

  md += `---\n\n`;
  md += `## Next Steps\n\n`;
  md += `1. Implement \`extractCodeExamples()\` function using findings\n`;
  md += `2. Implement section-based filtering\n`;
  md += `3. Implement content heuristics\n`;
  md += `4. Implement composition scoring (threshold ≥5)\n`;
  md += `5. Test on 5-10 pages and validate output quality\n`;

  return md;
}

function countOccurrences<T>(arr: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  arr.forEach(item => {
    const key = String(item);
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

async function main() {
  console.log('🔍 CHAKRA UI CODE BLOCK EXPLORATION');
  console.log('='.repeat(80));
  console.log(`\nExploring ${COMPONENTS_TO_EXPLORE.length} components...\n`);

  const browser = await chromium.launch({ headless: true });

  for (const component of COMPONENTS_TO_EXPLORE) {
    const exploration = await exploreComponent(
      browser,
      component.name,
      component.url,
      component.category
    );
    allExplorations.push(exploration);
  }

  await browser.close();

  console.log('\n' + '='.repeat(80));
  console.log('📝 Generating comprehensive report...');

  const report = await generateMarkdownReport(allExplorations);
  const reportPath = path.join(process.cwd(), 'docs', 'CODE_BLOCK_EXPLORATION.md');

  // Ensure docs directory exists
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, report, 'utf-8');

  console.log(`✅ Report saved to: ${reportPath}`);
  console.log('='.repeat(80));
  console.log('\nExploration complete! Check the report for detailed findings.\n');
}

main().catch(console.error);
