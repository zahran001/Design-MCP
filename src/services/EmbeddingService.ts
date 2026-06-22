import { OpenAI } from 'openai';
import 'dotenv/config';
import { getEmbeddingModel } from '../config/vectorConfig.js';


export class EmbeddingService {
  private client: OpenAI;
  private model: string;

  constructor(model: string = getEmbeddingModel()) {
    this.model = model;
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async embedText(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });
    return response.data.map((item: any) => item.embedding);
  }
}
