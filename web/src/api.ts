// Client mirror of the server contract. Kept in sync with PipelineReport in
// src/steps/4-generate/pipeline.ts and ContextChunk in generator.ts — the API
// returns the report verbatim.

export interface ContextChunk {
  rank: number;
  score: number;
  componentName: string;
  chunkType: string;
  rendered: string;
}

export interface PipelineReport {
  query: string;
  model: string;
  grounded: boolean;
  outPath: string | null;
  component: string;
  cleanCodeBlock: boolean;
  topContextComponent: string;
  context: ContextChunk[];
  tscOkSingleShot: boolean;
  tscOk: boolean;
  tscErrors: number;
  repairIters: number;
  smellRepairIters: number;
  smells: string[];
  incomplete: string[];
  renderChecked: boolean;
  renderOk: boolean;
  renderError?: string;
}

export interface ExamplePrompt {
  id: string;
  query: string;
  note: string;
}

// The `npm run serve` hint is for developers, not end users — in production an
// unreachable backend is an ops problem the user can't fix, and we shouldn't leak
// dev tooling into the UI. Only append it during local dev.
const DEV_HINT = import.meta.env.DEV ? ' Start the API with `npm run serve`.' : '';

async function asError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch {
    // Non-JSON error body. A 5xx with no JSON is typically the dev proxy failing
    // to reach the API (e.g. the backend is down) — say so usefully.
    if (res.status >= 500) {
      message = `Backend unreachable or errored (HTTP ${res.status}).${DEV_HINT}`;
    }
  }
  throw new Error(message);
}

export async function fetchExamples(): Promise<ExamplePrompt[]> {
  const res = await fetch('/api/examples');
  if (!res.ok) await asError(res);
  const body = await res.json();
  return body.examples ?? [];
}

export async function generate(query: string, useContext: boolean): Promise<PipelineReport> {
  let res: Response;
  try {
    res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, useContext }),
    });
  } catch {
    // fetch rejects (TypeError "Failed to fetch") when the connection is refused
    // / reset — i.e. the client can't reach the API at all.
    throw new Error(`Backend unreachable — the server may be down or restarting.${DEV_HINT}`);
  }
  if (!res.ok) await asError(res);
  return res.json();
}
