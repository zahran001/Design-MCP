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
  smells: string[];
  incomplete: string[];
  renderOk: boolean;
  renderError?: string;
}

export interface ExamplePrompt {
  id: string;
  query: string;
  note: string;
}

async function asError(res: Response): Promise<never> {
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch {
    /* non-JSON error body — keep the status message */
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
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, useContext }),
  });
  if (!res.ok) await asError(res);
  return res.json();
}
