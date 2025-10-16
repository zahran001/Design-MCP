// =============================================================================
// This file contains the Playwright crawling logic. It navigates to a page,
// invokes the extractor, validates the result, and saves it.
// =============================================================================

import { Browser, Page, chromium } from 'playwright';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { extractComponent } from './extractors.js';
import { ComponentDocSchema } from '../../schemas/RAGResultSchema.js';
// Load environment variables
config();

export class ChakraDocsSpider {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private crawlUrlPattern: string;

  constructor(
    private startUrl: string,
    private maxPages: number
  ) {
    // Require explicit CRAWL_URL_PATTERN from environment
    if (!process.env.CRAWL_URL_PATTERN) {
      throw new Error('CRAWL_URL_PATTERN environment variable is required');
    }
    this.crawlUrlPattern = process.env.CRAWL_URL_PATTERN;
    console.log(`Crawl pattern: ${this.crawlUrlPattern}`);
  }

  async init() {
    this.browser = await chromium.launch({
      headless: true,
    });
    this.page = await this.browser.newPage();
  }

  async crawl() {
    if (!this.page) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    console.log(`Starting crawl from ${this.startUrl}`);
    await this.page.goto(this.startUrl, { waitUntil: 'domcontentloaded' });

    // Discover all unique component links on the starting page
    const hrefs = await this.page.locator('a[href]').evaluateAll((links: HTMLAnchorElement[]) =>
      links.map(a => a.href)
    );

    const componentUrls = Array.from(
      new Set(
        hrefs
          .filter(h => h.startsWith(this.crawlUrlPattern))
          .map(h => h.split('#')[0]) // Remove fragment identifiers
      )
    );

    console.log(`Discovered ${componentUrls.length} unique component URLs.`);

    // Crawl each component link, respecting maxPages
    const pagesToCrawl = this.maxPages > 0 ? componentUrls.slice(0, this.maxPages) : componentUrls;
    console.log(`Crawling up to ${pagesToCrawl.length} pages...`);

    for (const url of pagesToCrawl) {
      try {
        console.log(`\n--- Crawling: ${url} ---`);
        await this.page.goto(url, { waitUntil: 'networkidle' });

        // Use the extractor on the component page
        const extractedDoc = await extractComponent(this.page, url);

        if (extractedDoc) {
          // Validate and save the data
          const validationResult = ComponentDocSchema.safeParse(extractedDoc);

          if (validationResult.success) {
            console.log(`✅ [${extractedDoc.componentName}] Extraction validated successfully.`);
            await this.saveData(validationResult.data);
          } else {
            console.error(`❌ [${extractedDoc.componentName}] Validation failed:`, validationResult.error.flatten());
            await this.saveData(extractedDoc, 'invalid-');
          }
        } else {
          console.log(`No useful content extracted from ${url}.`);
        }
      } catch (error) {
        console.error(`Failed to crawl or process ${url}:`, error);
      }
    }
  }

  private async saveData(data: any, prefix = '') {
    const componentName = data.componentName?.replace(/ /g, '-') || 'unknown-component';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${prefix}${componentName}-${timestamp}.json`;
    const outputPath = path.join(process.cwd(), 'artifacts', 'raw-json', fileName);

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    console.log(`Data saved to ${outputPath}`);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}
