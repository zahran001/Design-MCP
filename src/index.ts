#!/usr/bin/env node

// =============================================================================
// Skeleton implementation
// =============================================================================

// Commander.js

// import { program } from 'commander';
// import { ChakraDocsSpider } from './steps/0-extract-docs/crawler.js';

// program
//   .version('0.1.0')
//   .description('CLI tool for extracting Chakra UI documentation');

// program
//   .command('0-extract-docs')
//   .description('Crawl and extract Chakra UI documentation')
//   .option('-s, --start-url <url>', 'Starting URL for crawling')
//   .option('-m, --max-pages <number>', 'Maximum number of pages to crawl')
//   .action(async (options) => {
//     try {
//       const spider = new ChakraDocsSpider(
//         options.startUrl,
//         options.maxPages ? parseInt(options.maxPages) : undefined
//       );

//       await spider.init();
//       await spider.crawl();
//       await spider.close();
      
//       console.log('Documentation extraction completed successfully!');
//     } catch (error) {
//       console.error('Error during documentation extraction:', error);
//       process.exit(1);
//     }
//   });

// program.parse(process.argv);


// =============================================================================
// actual implementation
// =============================================================================

import { Command } from "commander";
import "dotenv/config";
import { runCrawl } from "./steps/0-extract-docs/crawler.js";

const program = new Command();

program
  .name("spec-driven-generator")
  .description("CLI for crawling Chakra UI docs");

program
  .command("0-extract-docs")
  .option("-s, --start <url>", "start URL")
  .option("-m, --max <n>", "max pages")
  .action(async (opts) => { 
    // command handler
    console.log("=== Environment Variables ===");
    console.log("START_URL:", process.env.START_URL);
    console.log("MAX_PAGES:", process.env.MAX_PAGES);
    console.log("CRAWL_DELAY:", process.env.CRAWL_DELAY);
    console.log("\n=== CLI Options ===");
    console.log({ start: opts.start, max: opts.max });

    const links = await runCrawl({ startUrl: opts.start, maxPages: opts.max });
    console.log(`ok: collected ${links.length} links`);
    process.exit(0);
  });

program.parse();
