import { EmbeddingService } from './EmbeddingService.js';
import { VectorStoreService } from './VectorStoreService.js';
import { getCollectionName } from '../config/vectorConfig.js';

interface RetrievalServiceOptions {
  collectionName?: string;
}

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
  private collectionName: string;

  constructor(options: RetrievalServiceOptions = {}) {
    this.embedding = new EmbeddingService();
    this.vectorStore = new VectorStoreService();
    this.collectionName = options.collectionName || getCollectionName();
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
   * Search with a pre-computed query vector and an optional Qdrant payload
   * filter. Lets callers reuse one embedding across several filtered fetches
   * (e.g. reserved-slot retrieval: same query vector, different
   * componentName/chunkType filters) without re-embedding each time.
   */
  async searchByVector(
    queryVector: number[],
    limit: number = 5,
    filter?: Record<string, unknown>
  ): Promise<SearchResult[]> {
    const raw = await this.vectorStore.search(this.collectionName, queryVector, limit, filter);
    return raw.map((result, index) => ({
      rank: index + 1,
      score: result.score,
      id: result.id,
      payload: result.payload,
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
    const vectorStoreResults = await this.vectorStore.search(this.collectionName, queryVector, limit);
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
