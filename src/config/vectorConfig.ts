import 'dotenv/config';

const DEFAULT_COLLECTION_NAME = 'chakra-ui-docs';
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
// LLM-as-judge for the retrieval eval. Cheap default for iteration; override to
// `gpt-4o` via EVAL_JUDGE_MODEL for the committed, maximally-defensible baseline.
const DEFAULT_JUDGE_MODEL = 'gpt-4o-mini';

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getCollectionName(): string {
  return process.env.QDRANT_COLLECTION_NAME?.trim() || DEFAULT_COLLECTION_NAME;
}

export function getEmbeddingModel(): string {
  return process.env.EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL;
}

export function getEmbeddingDimensions(): number {
  return parsePositiveInteger(process.env.EMBEDDING_DIMENSIONS, DEFAULT_EMBEDDING_DIMENSIONS);
}

export function getJudgeModel(): string {
  return process.env.EVAL_JUDGE_MODEL?.trim() || DEFAULT_JUDGE_MODEL;
}
