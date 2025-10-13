#!/usr/bin/env node

import { program } from 'commander';
import { ChakraDocsSpider } from './steps/0-extract-docs/crawler.js';

program
  .version('0.1.0')
  .description('CLI tool for extracting Chakra UI documentation');

program
  .command('0-extract-docs')
  .description('Crawl and extract Chakra UI documentation')
  .option('-s, --start-url <url>', 'Starting URL for crawling')
  .option('-m, --max-pages <number>', 'Maximum number of pages to crawl')
  .action(async (options) => {
    try {
      const spider = new ChakraDocsSpider(
        options.startUrl,
        options.maxPages ? parseInt(options.maxPages) : undefined
      );

      await spider.init();
      await spider.crawl();
      await spider.close();
      
      console.log('Documentation extraction completed successfully!');
    } catch (error) {
      console.error('Error during documentation extraction:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);