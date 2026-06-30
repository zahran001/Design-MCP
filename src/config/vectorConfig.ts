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

// Component generator (Step 4). Strong model on purpose — Chakra v3's breaking
// changes are exactly where a capable model still hallucinates the old API, so
// the value of grounding it in retrieved real v3 docs is most visible here.
const DEFAULT_GENERATION_MODEL = 'gpt-4o';

export function getGenerationModel(): string {
  return process.env.GEN_MODEL?.trim() || DEFAULT_GENERATION_MODEL;
}

// Generation provider routing (deploy). DeepSeek is OpenAI-API compatible, so we
// reuse the OpenAI SDK and just point the GENERATION client at a different base
// URL + key. EMBEDDINGS stay on OpenAI regardless (the corpus is
// text-embedding-3-small / 1536-dim — the query embedding must match the stored
// vectors), so only generation/repair is rerouted. Unset GEN_BASE_URL => OpenAI
// default (the gpt-4o path, kept intact for the A/B harness).
export function getGenerationBaseUrl(): string | undefined {
  return process.env.GEN_BASE_URL?.trim() || undefined;
}

// Use the DeepSeek key when a DeepSeek base URL is configured, else the OpenAI key.
export function getGenerationApiKey(): string | undefined {
  return getGenerationBaseUrl() ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY;
}

// DeepSeek "thinking mode" toggles — independent for generate vs repair so the
// objective harness can pick each by the numbers, not a guessed default. Both
// default OFF. No-op on the OpenAI path (the param is only emitted when enabled).
export function getGenerateThinking(): boolean {
  return process.env.GEN_THINKING === 'true';
}

export function getRepairThinking(): boolean {
  return process.env.REPAIR_THINKING === 'true';
}

// Generation sampling knobs (Step 4 hardening, Item 1). PRODUCT default is 0.2
// (variety is a feature in the CLI/UI). The MEASUREMENT harness overrides to
// temp 0 + a fixed seed so a single A/B run is a stable signal — Move 0 found
// ~5.6% of tsc cells flip run-to-run, all in the grounded arm. `seed` cuts
// (not eliminates) the residual noise; OpenAI's seed is best-effort.
const DEFAULT_GENERATION_TEMPERATURE = 0.2;

// Float parser that ALLOWS 0 (the harness uses temp 0). parsePositiveInteger
// rejects 0, so it can't be reused here.
function parseTemperature(value: string | undefined, fallback: number): number {
  if (!value || value.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getGenerationTemperature(): number {
  return parseTemperature(process.env.GEN_TEMP, DEFAULT_GENERATION_TEMPERATURE);
}

// Returns undefined when unset so we OMIT `seed` from the OpenAI call (rather
// than sending a NaN). Any integer is valid, including 0 and negatives.
export function getGenerationSeed(): number | undefined {
  const value = process.env.GEN_SEED;
  if (!value || value.trim() === '') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
