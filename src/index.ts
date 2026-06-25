#!/usr/bin/env node

import path from "path";
import { program } from "commander";
import { ChakraDocsSpider } from "./steps/0-extract-docs/crawler.js";
import {
  normalizeCodeExamples,
  normalizePropReferences,
  normalizeComponentOverviews,
  normalizeCapabilities,
} from "./steps/1-normalize/normalizer.js";
import { runEmbedder } from "./steps/2-embed/embedder.js";
import { runSearchCli } from "./steps/3-search/retriever.js";
import { GenerationService } from "./steps/4-generate/generator.js";
import { runGenerationPipeline, formatReport } from "./steps/4-generate/pipeline.js";

function parsePositiveIntegerOption(value: string | undefined, optionName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${optionName} must be a positive integer`);
  }

  return parsed;
}

program
  .version("0.1.0")
  .description("CLI tool for extracting Chakra UI documentation");

program
  .command("0-extract-docs")
  .description("Crawl and extract Chakra UI documentation")
  .option("-s, --start-url <url>", "Starting URL for crawling")
  .option("-m, --max-pages <number>", "Maximum number of pages to crawl")
  .action(async (options: { startUrl?: string; maxPages?: string }) => {
    const startUrl =
      options.startUrl ||
      process.env.START_URL ||
      "https://chakra-ui.com/docs/components/overview";

    const maxPages = options.maxPages ? parseInt(options.maxPages, 10)
      : process.env.MAX_PAGES ? parseInt(process.env.MAX_PAGES, 10)
      : 100;

    console.log(`Configuration: - Start URL: ${startUrl} - Max Pages: ${maxPages}`);

    const spider = new ChakraDocsSpider(startUrl, maxPages);

    try {
      await spider.init();
      await spider.crawl();
      console.log("âœ… Documentation extraction completed successfully!");
    } catch (error) {
      console.error("âŒ Error during documentation extraction:", error);
      process.exit(1);
    } finally {
      await spider.close();
    }
  });

program
  .command("1-normalize [component]")
  .description("Normalize code examples and prop references for one or all components")
  .action(async (component?: string) => {
    console.log();
    try {
      await normalizeCodeExamples(component);
      console.log();
      await normalizePropReferences(component);
      console.log();
      await normalizeComponentOverviews(component);
      console.log();
      await normalizeCapabilities(component);
      console.log();
      console.log("âœ… Normalization completed successfully!");
    } catch (error) {
      console.error();
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("âŒ Error during normalization:", errorMessage);
      process.exit(1);
    }
  });

program
  .command("2-embed")
  .description("Generate embeddings for normalized chunks and upsert them to Qdrant")
  .option("-l, --limit <number>", "Maximum number of chunks to embed")
  .option("-b, --batch-size <number>", "Upsert batch size")
  .action(async (options: { limit?: string; batchSize?: string }) => {
    try {
      const limit = parsePositiveIntegerOption(options.limit, 'limit');
      const batchSize = parsePositiveIntegerOption(options.batchSize, 'batch-size');

      await runEmbedder({ limit, batchSize });
      console.log("âœ… Embedding completed successfully!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("âŒ Error during embedding:", errorMessage);
      process.exit(1);
    }
  });

program
  .command("3-search <query>")
  .description("Search embedded chunks in Qdrant")
  .option("-l, --limit <number>", "Maximum number of search results to return")
  .action(async (query: string, options: { limit?: string }) => {
    try {
      const limit = parsePositiveIntegerOption(options.limit, 'limit');
      await runSearchCli(query, { limit });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("âŒ Error during search:", errorMessage);
      process.exit(1);
    }
  });

program
  .command("4-generate <query>")
  .description("Generate a Chakra v3 TSX component from a natural-language request (grounded retrieval + self-healing repair), write it to a file, and print a tsc/v2-smell/composition report")
  .option("-o, --out <file>", "Output .tsx path (default: artifacts/generated/<slug>.tsx)")
  .option("-k, --k <number>", "Number of retrieved chunks to ground in")
  .option("--no-context", "Disable retrieval grounding (ablation: rely on model memory)")
  .action(async (query: string, options: { out?: string; k?: string; context?: boolean }) => {
    try {
      const k = parsePositiveIntegerOption(options.k, 'k');
      const gen = new GenerationService();
      console.log(`Generating (model: ${gen.modelName}, grounded: ${options.context !== false})…`);
      const report = await runGenerationPipeline(gen, query, {
        k,
        useContext: options.context !== false,
        outPath: options.out,
      });
      console.log(`\n${formatReport(report)}`);
      if (report.outPath) {
        console.log(`💾 ${path.relative(process.cwd(), report.outPath)}`);
      }
      if (!report.tscOk) process.exitCode = 2; // surface a non-compiling artifact
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Error during generation:", errorMessage);
      process.exit(1);
    }
  });

await program.parseAsync();
