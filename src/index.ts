#!/usr/bin/env node

import { program } from "commander";
import { ChakraDocsSpider } from "./steps/0-extract-docs/crawler.js";

program
  .version("0.1.0")
  .description("CLI tool for extracting Chakra UI documentation");

program
  .command("0-extract-docs")
  .description("Crawl and extract Chakra UI documentation")
  .option("-s, --start-url <url>", "Starting URL for crawling")
  .option("-m, --max-pages <number>", "Maximum number of pages to crawl")
  .action(async (options: { startUrl?: string; maxPages?: string }) => {
    // Implement the desired control flow: CLI > ENV > Default
    const startUrl =
      options.startUrl ||
      process.env.START_URL ||
      "https://chakra-ui.com/docs/components/overview";

    // base-10 integer parsing with fallback
    const maxPages = options.maxPages ? parseInt(options.maxPages, 10)
      : process.env.MAX_PAGES ? parseInt(process.env.MAX_PAGES, 10)
      : 100;

    console.log(`Configuration: - Start URL: ${startUrl} - Max Pages: ${maxPages}`);

    const spider = new ChakraDocsSpider(startUrl, maxPages);

    try {
      await spider.init();
      await spider.crawl();
      console.log("✅ Documentation extraction completed successfully!");
    } catch (error) {
      console.error("❌ Error during documentation extraction:", error);
      process.exit(1);
    } finally {
      await spider.close();
    }
  });

program.parse();
