import { QdrantClient } from '@qdrant/js-client-rest';

// Define the structure of a "Point" (a single record) in our vector DB
export interface VectorPoint {
  id: number | string;            // Unique ID for the record (can be int or UUID string)
  vector: number[];               // The actual embedding (array of 1536 floats from OpenAI)
  payload: Record<string, unknown>; // Metadata (the actual code, component name, etc.)
}

export class VectorStoreService {
  private client: QdrantClient;

  constructor() {
    const url = process.env.QDRANT_URL || 'http://localhost:6333';
    this.client = new QdrantClient({ url });
  }

  async createCollection(name: string, vectorSize: number): Promise<void> {
    try {
      // Try to create the collection
      await this.client.createCollection(name, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      });
      console.log(`✅ Collection "${name}" created`);
    } catch (error: any) {
      // If it already exists (409 Conflict), that's fine
      if (error?.status === 409 && error?.data?.status?.error?.includes('already exists')) {
        console.log(`✅ Collection "${name}" already exists`);
        return;
      }
      // Otherwise, it's a real error
      console.error('Collection creation failed:', error);
      throw error;
    }
  }

  // Ingestion Method (Used by embedder.ts)
  // "Upsert" = Update if ID exists, Insert if it doesn't
  async upsertPoints(collectionName: string, points: VectorPoint[]): Promise<void> {
    await this.client.upsert(collectionName, {
      points: points.map(p => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload, // This stores your JSON content right inside Qdrant
      })),
    });
  }

  // Search Method (Used by retriever.ts CLI)
  // `filter` is an optional Qdrant payload filter (e.g.
  // `{ must: [{ key: 'componentName', match: { value: 'Number Input' } }] }`)
  // used by reserved-slot retrieval to fetch a specific component + chunk type.
  async search(
    collectionName: string,
    queryVector: number[], // The embedding of the USER'S query
    limit: number = 5,
    filter?: Record<string, unknown>
  ): Promise<Array<{ id: string | number; score: number; payload: Record<string, unknown> }>> {
    // Ask Qdrant for the nearest neighbors to our query vector
    const results = await this.client.search(collectionName, {
      vector: queryVector,
      limit,
      ...(filter ? { filter } : {}),
    });
    // Map the raw Qdrant result back to a clean object
    return results.map((r: any) => ({
      id: r.id,
      score: r.score, // 0.0 to 1.0 (higher is better match)
      payload: r.payload, // The original code snippet/metadata
    }));
  }

  // Returns the number of points stored in a collection.
  // Used for drift detection (comparing live DB size to on-disk chunk count).
  // Returns null if the collection does not exist or the count cannot be read.
  async getPointCount(collectionName: string): Promise<number | null> {
    try {
      const result = await this.client.count(collectionName, { exact: true });
      return result.count;
    } catch {
      return null;
    }
  }
}