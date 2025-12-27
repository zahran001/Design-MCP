import { EmbeddingService } from './EmbeddingService.js';
import { VectorStoreService } from './VectorStoreService.js';

const COLLECTION_NAME = 'chakra-ui-docs';

export interface SearchResult {
  rank: number;
  score: number;
  id: string | number;
  payload: Record<string, unknown>;
}

export interface DetailedSearchResult {
  query: string;
  queryVector: number[];
  searchTimeMs: number;
  results: SearchResult[];
}

export class RetrievalService {
  private embedding: EmbeddingService;
  private vectorStore: VectorStoreService;

  constructor() {
    this.embedding = new EmbeddingService();
    this.vectorStore = new VectorStoreService();
  }

  /**
   * High-level search (backward compatible)
   */
  async search(query: string, limit: number = 5) {
    const { results } = await this.searchDetailed(query, limit);
    return results.map(r => ({
      rank: r.rank,
      score: r.score,
      ...r.payload,
    }));
  }

  /**
   * Detailed search with full pipeline transparency
   * Returns: query, embedding vector, search time, and full results
   */
  async searchDetailed(query: string, limit: number = 5): Promise<DetailedSearchResult> {
    // Step 1: Embed the query
    const embeddingStart = Date.now();
    const queryVector = await this.embedding.embedText(query);
    const embeddingTimeMs = Date.now() - embeddingStart;

    // Step 2: Search Qdrant
    const searchStart = Date.now();
    const vectorStoreResults = await this.vectorStore.search(COLLECTION_NAME, queryVector, limit);
    const searchTimeMs = Date.now() - searchStart;

    // Step 3: Format results with full payload
    const results: SearchResult[] = vectorStoreResults.map((result, index) => ({
      rank: index + 1,
      score: result.score,
      id: result.id,
      payload: result.payload,
    }));

    return {
      query,
      queryVector,
      searchTimeMs: embeddingTimeMs + searchTimeMs,
      results,
    };
  }
}
