// =============================================================================
// Skeleton implementation
// =============================================================================
// import type { Page } from 'playwright';

// export interface ChakraSelector {
//   componentName: string;
//   description: string;
//   props: string;
//   examples: string;
//   accessibility: string;
// }

// // Placeholder selectors for Chakra UI documentation
// export const CHAKRA_SELECTORS: ChakraSelector = {
//   componentName: 'h1.chakra-heading', // Example selector
//   description: '[data-testid="doc-content"] > p:first-of-type', // Example selector
//   props: 'table.chakra-table', // Example selector for props table
//   examples: '.chakra-code', // Example selector for code examples
//   accessibility: '#accessibility', // Example selector for accessibility section
// };

// export async function extractComponentName(page: Page): Promise<string> {
//   // TODO: Implement actual extraction logic
//   const title = await page.title();
//   return title.split('|')[0].trim();
// }

// export async function extractDescription(page: Page): Promise<string> {
//   // TODO: Implement actual extraction logic
//   return 'Placeholder description';
// }

// export async function extractProps(page: Page): Promise<any[]> {
//   // TODO: Implement actual props extraction
//   return [];
// }

// export async function extractCodeExamples(page: Page): Promise<any[]> {
//   // TODO: Implement actual code examples extraction
//   return [];
// }

// export async function extractAccessibilityNotes(page: Page): Promise<string | null> {
//   // TODO: Implement actual accessibility notes extraction
//   return null;
// }


// =============================================================================
// actual implementation
// =============================================================================

// src/steps/0-extract-docs/extractors.ts
import type { Page } from 'playwright';
// import type { ComponentDoc } from "../RAGResultSchemas.js"; // <-- from schema

import type { ComponentDoc } from '../../schemas/RAGResultSchema.js';


/**
 * Minimal extractor: grabs the component name (h1) and the first paragraph description.
 * Returns null for non-component/empty pages so the crawler can skip gracefully.
 */
export async function extractComponent(page: Page, url: string): Promise<ComponentDoc | null> {
  // main content region (Chakra uses <main> for docs)
  const main = page.locator("main");
  if (!(await main.count())) return null;

  // Title (component name)
  const componentName =
    (await main.locator("h1").first().textContent())?.trim() || "";
  if (!componentName) return null;

  // Description: first paragraph after h1; fallback to first non-empty <p> in main
  const firstParaAfterH1 = main.locator("h1 + p");
  let description =
    (await firstParaAfterH1.first().textContent())?.trim() || "";

  if (!description) {
    // fallback: first non-empty paragraph in main
    const paras = main.locator("p");
    const count = await paras.count();
    for (let i = 0; i < count; i++) {
      const t = (await paras.nth(i).textContent())?.trim();
      if (t) {
        description = t;
        break;
      }
    }
  }

  // Build minimal doc; omit empty description
  // We explicitly type 'doc' to allow adding the optional 'description' property.
  const doc: ComponentDoc = {
    componentName,
    sourceUrl: url,
  };
  if (description) {
    doc.description = description;
  }

  // If we only found a title and literally nothing else, treat as non-useful
  const hasUseful = Boolean(doc.description);
  if (!hasUseful) return null;

  return doc;
}