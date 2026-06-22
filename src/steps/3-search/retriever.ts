import { pathToFileURL } from 'url';
import { RetrievalService } from '../../services/RetrievalService.js';
import { getCollectionName } from '../../config/vectorConfig.js';
import { SearchLogger, getPayloadSummary } from '../../utils/searchLogger.js';

export interface SearchCliOptions {
  limit?: number;
}

export async function runSearchCli(query: string, options: SearchCliOptions = {}) {
  if (!query) {
    console.error('Usage: node retriever.js "<query>"');
    process.exit(1);
  }

  const limit = options.limit || 5;
  const collectionName = getCollectionName();
  const logger = new SearchLogger();

  console.log('\n' + 'â•'.repeat(70));
  console.log('ðŸ” SEARCH REQUEST');
  console.log('â•'.repeat(70));
  logger.logQuery(query);

  const retrieval = new RetrievalService({ collectionName });
  const detailedResults = await retrieval.searchDetailed(query, limit);

  logger.logQueryEmbedding(detailedResults.queryVector);
  logger.logSearchExecution(collectionName, limit, detailedResults.searchTimeMs);

  logger.logResults(
    detailedResults.results.map(r => ({
      id: r.id,
      score: r.score,
      payload: r.payload,
    }))
  );

  console.log('\n' + 'â•'.repeat(70));
  console.log('ðŸ“¦ RETRIEVED PAYLOADS');
  console.log('â•'.repeat(70));
  for (const result of detailedResults.results) {
    logger.logRetrievedPayload(
      result.rank,
      result.id,
      result.payload
    );
  }

  const finalAnswer = detailedResults.results
    .map((r, idx) => {
      const componentName = typeof r.payload.componentName === 'string'
        ? r.payload.componentName
        : 'unknown';
      const summary = getPayloadSummary(r.payload, 100);

      return `[${idx + 1}] Component: ${componentName} (Score: ${r.score.toFixed(3)})
Chunk: ${r.id}
${summary}`;
    })
    .join('\n\n');

  logger.logFinalAnswer(finalAnswer, 'qdrant');
  logger.printSummary();

  console.log('\nðŸ’¾ Full execution logs (JSON):');
  console.log(logger.exportJSON());
}

async function main() {
  const query = process.argv[2];
  const limitArg = process.argv[3];
  const parsedLimit = limitArg ? Number.parseInt(limitArg, 10) : undefined;
  const limit = Number.isFinite(parsedLimit) && parsedLimit && parsedLimit > 0
    ? parsedLimit
    : undefined;

  await runSearchCli(query, { limit });
}

const isDirectExecution = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isDirectExecution) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
