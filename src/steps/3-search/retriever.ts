import { RetrievalService } from '../../services/RetrievalService.js';
import { SearchLogger } from '../../utils/searchLogger.js';

async function main() {
  const query = process.argv[2];

  if (!query) {
    console.error('Usage: node retriever.js "<query>"');
    process.exit(1);
  }

  const logger = new SearchLogger();

  // ============================================================================
  // Step 1: Log user question
  // ============================================================================
  console.log('\n' + '═'.repeat(70));
  console.log('🔍 SEARCH REQUEST');
  console.log('═'.repeat(70));
  logger.logQuery(query);

  // ============================================================================
  // Step 2: Execute search and log embedding
  // ============================================================================
  const retrieval = new RetrievalService();
  const detailedResults = await retrieval.searchDetailed(query, 5);

  // Log query embedding vector length
  logger.logQueryEmbedding(detailedResults.queryVector);

  // ============================================================================
  // Step 3: Log search execution
  // ============================================================================
  logger.logSearchExecution('chakra-ui-docs', 5, detailedResults.searchTimeMs);

  // ============================================================================
  // Step 4: Log top-k results (IDs + scores)
  // ============================================================================
  logger.logResults(
    detailedResults.results.map(r => ({
      id: r.id,
      score: r.score,
      payload: r.payload,
    }))
  );

  // ============================================================================
  // Step 5: Log retrieved payload for each result
  // ============================================================================
  console.log('\n' + '═'.repeat(70));
  console.log('📦 RETRIEVED PAYLOADS');
  console.log('═'.repeat(70));
  for (const result of detailedResults.results) {
    logger.logRetrievedPayload(
      result.rank,
      result.id,
      result.payload
    );
  }

  // ============================================================================
  // Step 6: Log final answer (in this case, the Qdrant results)
  // ============================================================================
  const finalAnswer = detailedResults.results
    .map((r, idx) => {
      return `[${idx + 1}] Component: ${r.payload.componentName} (Score: ${r.score.toFixed(3)})
Chunk: ${r.id}
${(r.payload.explanation as string).substring(0, 100)}...`;
    })
    .join('\n\n');

  logger.logFinalAnswer(finalAnswer, 'qdrant');

  // ============================================================================
  // Step 7: Print execution summary
  // ============================================================================
  logger.printSummary();

  // ============================================================================
  // Step 8: Export logs for debugging (optional)
  // ============================================================================
  console.log('\n💾 Full execution logs (JSON):');
  console.log(logger.exportJSON());
}

main().catch(console.error);
