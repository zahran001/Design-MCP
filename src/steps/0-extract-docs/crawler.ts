// =============================================================================
// Skeleton implementation 
// =============================================================================

// import { Browser, Page, chromium } from 'playwright';
// import { config } from 'dotenv';
// import path from 'path';
// import fs from 'fs/promises';

// // Load environment variables
// config();

// export class ChakraDocsSpider {
//   private browser: Browser | null = null;
//   private page: Page | null = null;

//   constructor(
//     private startUrl: string = process.env.START_URL || 'https://chakra-ui.com/docs/components/concepts/overview',
//     private maxPages: number = Number(process.env.MAX_PAGES) || 100
//   ) {}

//   async init() {
//     this.browser = await chromium.launch({
//       headless: true
//     });
//     this.page = await this.browser.newPage();
//   }

//   async crawl() {
//     if (!this.page) {
//       throw new Error('Browser not initialized. Call init() first.');
//     }

//     console.log(`Starting crawl from ${this.startUrl}`);
//     await this.page.goto(this.startUrl);

//     // TODO: Implement crawling logic
//     // This is a placeholder for the actual crawling implementation
//     const pageData = await this.extractPageData();
    
//     // Save the data
//     await this.saveData(pageData);
//   }

//   private async extractPageData() {
//     if (!this.page) throw new Error('Page not initialized');
    
//     // TODO: Implement actual data extraction
//     return {
//       timestamp: new Date().toISOString(),
//       url: this.page.url(),
//       title: await this.page.title(),
//       data: {} // Placeholder for extracted data
//     };
//   }

//   private async saveData(data: any) {
//     const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
//     const outputPath = path.join(process.cwd(), 'artifacts', 'raw-json', `crawl-${timestamp}.json`);
    
//     await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
//     console.log(`Data saved to ${outputPath}`);
//   }

//   async close() {
//     if (this.browser) {
//       await this.browser.close();
//       this.browser = null;
//       this.page = null;
//     }
//   }
// }



// =============================================================================
// actual implementation 1 - simple crawler to get component links
// =============================================================================

// import { Browser, Page, chromium } from 'playwright';

// export async function runCrawl({ startUrl, maxPages }: { startUrl: string; maxPages: number }) {
//   const browser = await chromium.launch();
//   const context = await browser.newContext();
//   const page = await context.newPage();

//   await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 45000 });

//   const hrefs: string[] = await page.locator("a[href]").evaluateAll((as: HTMLAnchorElement[]) =>
//     as.map(a => a.href).filter(Boolean)
//   );

//   const componentLinks = Array.from(
//     new Set(
//       hrefs
//         .filter(h => /^https?:\/\/(www\.)?chakra-ui\.com\/docs\/components\//.test(h))
//         .map(h => h.split("#")[0])
//     )
//   );

//   console.log(`found ${componentLinks.length} component links`);
//   console.log(componentLinks.slice(0, 20).map((x, i) => `${i + 1}. ${x}`).join("\n"));

//   await browser.close();
//   return componentLinks;
// }

// =============================================================================
// actual implementation 2 - more advanced crawler with queue and delay
// =============================================================================
import { chromium } from "playwright";
import { ComponentDocSchema, type ComponentDoc } from '../../schemas/RAGResultSchema.js';
import { extractComponent } from "./extractors.js";
import { mkdir, writeFile, appendFile } from "fs/promises";
import { dirname } from "path";


type CrawlOpts = { startUrl: string; maxPages: number };

export async function runCrawl({ startUrl, maxPages }: CrawlOpts): Promise<string[]> {
  const browser = await chromium.launch(); // headless by default
  const context = await browser.newContext();
  const page = await context.newPage();

  const delayMs = Number(process.env.CRAWL_DELAY ?? 0);

  // --- output sink (JSONL) ---
  const outPath = process.env.OUT_JSONL ?? "./out/docs.jsonl";
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, ""); // truncate/create

  // --- BFS state ---
  const queue: string[] = [startUrl];
  const visited = new Set<string>();
  let processed = 0;

  while (queue.length && processed < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;

    // Only allow component-docs subtree, except the start hub itself
    if (url !== startUrl && !/\/docs\/components\//.test(url)) continue;

    visited.add(url);

    try {
      console.log(`Visiting (${processed + 1}/${maxPages}): ${url}`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.locator("main").first().waitFor({ state: "attached", timeout: 5000 }).catch(() => {});

      // show the title so we can confirm navigation worked
      const title = await page.title();
      console.log(`→ ${title}`);

      // ---- EXTRACTION WIRING ----
      const doc = (await extractComponent(page, url)) as ComponentDoc | null;
      if (doc) {
        const parsed = ComponentDocSchema.safeParse(doc);
        if (!parsed.success) {
    const issues = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    console.warn(`   ! validation failed → ${issues}`);
        } else {
          await appendFile(outPath, JSON.stringify(parsed.data) + "\n", "utf8");
          console.log(`   ✓ extracted: ${parsed.data.componentName}`);
        }
      } else {
        console.log(`   · skipped (no component/description)`);
      }

      // discover next-layer links (BFS enqueue)
      const hrefs: string[] = await page
        .locator("a[href]")
        .evaluateAll((as: HTMLAnchorElement[]) => as.map(a => a.href).filter(Boolean));

      for (const h of hrefs) {
        if (/^https?:\/\/(www\.)?chakra-ui\.com\/docs\/components\//.test(h)) {
          const clean = h.split("#")[0]; // strip hash fragments
          if (!visited.has(clean)) queue.push(clean);
        }
      }

      processed++;

      // optional politeness delay
      if (delayMs > 0) await page.waitForTimeout(delayMs);
    } catch (err) {
      console.warn(`! Error on ${url}: ${(err as Error).message}`);
    }
  }

  await browser.close();
  console.log(
    `Done. processed=${processed} visited=${visited.size} queued_left=${queue.length}`
  );

  return Array.from(visited);
}
