/**
 * Comprehensive logging utility for search operations
 * Captures every step of the retrieval pipeline for transparency
 */

export interface SearchLogEntry {
  timestamp: string;
  stage: string;
  data: Record<string, unknown>;
}

function normalizeInlineText(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.substring(0, maxLength).trimEnd()}...`;
}

export function getPayloadSummary(
  payload: Record<string, unknown>,
  maxLength: number = 150
): string {
  const explanation = normalizeInlineText(payload.explanation);
  if (explanation) {
    return truncateText(explanation, maxLength);
  }

  const propName = normalizeInlineText(payload.propName);
  const propDescription = normalizeInlineText(payload.propDescription);
  const propType = normalizeInlineText(payload.propType);
  const propSummary = [
    propName ? `Prop: ${propName}.` : '',
    propDescription,
    propType
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  if (propSummary) {
    return truncateText(propSummary, maxLength);
  }

  const code = normalizeInlineText(payload.code);
  if (code) {
    return truncateText(code, maxLength);
  }

  return '(none)';
}

export class SearchLogger {
  private logs: SearchLogEntry[] = [];
  private startTime: number = Date.now();

  /**
   * Log user question/query
   */
  logQuery(query: string): void {
    this.logs.push({
      timestamp: new Date().toISOString(),
      stage: 'USER_QUERY',
      data: {
        query,
        length: query.length,
        words: query.split(/\s+/).length,
      },
    });
    this.printStage('USER_QUERY', { query });
  }

  /**
   * Log query embedding details
   */
  logQueryEmbedding(vector: number[], model: string = 'text-embedding-3-small'): void {
    this.logs.push({
      timestamp: new Date().toISOString(),
      stage: 'EMBEDDING_QUERY',
      data: {
        vectorLength: vector.length,
        vectorDimension: vector.length,
        vectorSample: vector.slice(0, 5),
        model,
        vectorMagnitude: Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)),
      },
    });
    this.printStage('EMBEDDING_QUERY', {
      vectorLength: vector.length,
      vectorDimension: `${vector.length}-dimensional`,
      vectorSample: `[${vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}, ...]`,
      model,
      vectorMagnitude: Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)).toFixed(4),
    });
  }

  /**
   * Log search execution details
   */
  logSearchExecution(
    collectionName: string,
    limit: number,
    timeTaken: number
  ): void {
    this.logs.push({
      timestamp: new Date().toISOString(),
      stage: 'SEARCH_EXECUTION',
      data: {
        collection: collectionName,
        limit,
        timeTaken,
      },
    });
    this.printStage('SEARCH_EXECUTION', {
      collection: collectionName,
      limit,
      timeTaken: `${timeTaken.toFixed(2)}ms`,
    });
  }

  /**
   * Log top-k results
   */
  logResults(
    results: Array<{
      id: string | number;
      score: number;
      payload: Record<string, unknown>;
    }>
  ): void {
    const resultsSummary = results.map((r, idx) => ({
      rank: idx + 1,
      id: r.id,
      score: r.score.toFixed(3),
      chunkType: (r.payload?.chunkType as string) || 'unknown',
      componentName: (r.payload?.componentName as string) || 'unknown',
    }));

    this.logs.push({
      timestamp: new Date().toISOString(),
      stage: 'TOP_K_RESULTS',
      data: {
        totalResults: results.length,
        results: resultsSummary,
      },
    });

    console.log('\n' + '═'.repeat(70));
    console.log('📊 TOP-K RESULTS (5 Most Similar Chunks)');
    console.log('═'.repeat(70));
    for (const r of resultsSummary) {
      console.log(`  [${r.rank}] Score: ${r.score} │ ${r.componentName} │ ${r.id}`);
    }
    console.log('═'.repeat(70) + '\n');
  }

  /**
   * Log retrieved payload for each result
   */
  logRetrievedPayload(
    rank: number,
    id: string | number,
    payload: Record<string, unknown>
  ): void {
    const explanation = getPayloadSummary(payload, 150);
    const codePreview = truncateText(normalizeInlineText(payload.code), 100) || '(none)';

    this.logs.push({
      timestamp: new Date().toISOString(),
      stage: `PAYLOAD_RANK_${rank}`,
      data: {
        id,
        chunkId: payload.chunkId,
        componentName: payload.componentName,
        sourceUrl: payload.sourceUrl,
        explanationPreview: explanation,
        codePreview,
      },
    });

    console.log('\n' + '─'.repeat(70));
    console.log(`📄 RESULT [${rank}]: ${id}`);
    console.log('─'.repeat(70));
    console.log(`Component: ${payload.componentName}`);
    console.log(`Source: ${payload.sourceUrl}`);
    console.log(`\nExplanation:\n${explanation}...`);
    console.log(`\nCode:\n${codePreview}...`);
  }

  /**
   * Log final answer (after LLM processing, if applicable)
   */
  logFinalAnswer(answer: string, source: 'qdrant' | 'llm' = 'qdrant'): void {
    this.logs.push({
      timestamp: new Date().toISOString(),
      stage: 'FINAL_ANSWER',
      data: {
        source,
        answerLength: answer.length,
        answerPreview: answer.substring(0, 200),
      },
    });

    console.log('\n' + '═'.repeat(70));
    console.log(`✅ FINAL ANSWER (from ${source.toUpperCase()})`);
    console.log('═'.repeat(70));
    console.log(answer);
    console.log('═'.repeat(70));
  }

  /**
   * Print a single stage for console output
   */
  private printStage(stage: string, data: Record<string, unknown>): void {
    console.log(`\n📍 ${stage}`);
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        console.log(`   ${key}: (empty)`);
      } else {
        console.log(`   ${key}: ${JSON.stringify(value)}`);
      }
    }
  }

  /**
   * Get summary of all logs
   */
  getSummary(): {
    totalTime: number;
    stageCount: number;
    stages: string[];
    logs: SearchLogEntry[];
  } {
    const totalTime = Date.now() - this.startTime;
    const stages = [...new Set(this.logs.map(l => l.stage))];

    return {
      totalTime,
      stageCount: stages.length,
      stages,
      logs: this.logs,
    };
  }

  /**
   * Print final summary
   */
  printSummary(): void {
    const summary = this.getSummary();
    console.log('\n' + '═'.repeat(70));
    console.log('📋 EXECUTION SUMMARY');
    console.log('═'.repeat(70));
    console.log(`Total Time: ${summary.totalTime.toFixed(0)}ms`);
    console.log(`Stages Executed: ${summary.stageCount}`);
    console.log(`Stages: ${summary.stages.join(' → ')}`);
    console.log('═'.repeat(70));
  }

  /**
   * Export logs as JSON for debugging
   */
  exportJSON(): string {
    return JSON.stringify(
      {
        summary: this.getSummary(),
        logs: this.logs,
      },
      null,
      2
    );
  }
}
