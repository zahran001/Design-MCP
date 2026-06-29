// =============================================================================
// HTTP surface for the generation pipeline (the UI's backend)
// =============================================================================
// A thin Express layer over the already-validated `runGenerationPipeline()`. The
// pipeline needs a long-lived Node process (OpenAI key + Qdrant client + a
// child_process `tsc` sandbox), so this is NOT serverless — one warm
// GenerationService is shared across requests. The route just sets outPath:null
// (return the report, write nothing) and hands the three-tier report + retrieved
// context to the SPA. Objective signals stay the spine; this adds no new gates.
// =============================================================================

import express from 'express';
import type { Express, Request, Response, NextFunction } from 'express';
import { GenerationService } from '../steps/4-generate/generator.js';
import { runGenerationPipeline } from '../steps/4-generate/pipeline.js';
import { HELDOUT_PROMPTS } from '../steps/4-generate/test-generation/heldout-prompts.js';

/** Reject pathological prompts before they cost OpenAI + tsc time. */
const MAX_QUERY_LENGTH = 500;

// Naive fixed-window in-memory rate limit. The pipeline spends OpenAI + tsc time
// per call, so this is a cost guardrail, not a security control — a single warm
// process, no distributed state. Keyed by client IP.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const key = req.ip ?? 'unknown';
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ error: `Rate limit exceeded — retry in ${retryAfter}s.` });
    return;
  }
  entry.count++;
  next();
}

/**
 * Build the Express app around one shared GenerationService. Exported (not just
 * started) so tests can drive it without binding a port.
 */
export function createServer(gen: GenerationService): Express {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, model: gen.modelName });
  });

  // Seed the UI's one-click examples from the held-out prompt set.
  app.get('/api/examples', (_req, res) => {
    res.json({
      examples: HELDOUT_PROMPTS.map((p) => ({ id: p.id, query: p.query, note: p.note })),
    });
  });

  app.post('/api/generate', rateLimit, async (req: Request, res: Response) => {
    const { query, useContext } = req.body ?? {};

    if (typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Body must include a non-empty "query" string.' });
    }
    if (query.length > MAX_QUERY_LENGTH) {
      return res
        .status(400)
        .json({ error: `Query too long (max ${MAX_QUERY_LENGTH} characters).` });
    }

    try {
      const report = await runGenerationPipeline(gen, query.trim(), {
        useContext: useContext !== false, // default grounded; explicit false ablates
        outPath: null, // API never writes to disk — return the report only
      });
      return res.json(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('generation failed:', message);
      return res.status(500).json({ error: `Generation failed: ${message}` });
    }
  });

  return app;
}

/** Boot the API on PORT (default 3001). Reuses one warm GenerationService. */
export function startServer(port = Number(process.env.PORT) || 3001): void {
  const gen = new GenerationService();
  const app = createServer(gen);
  app.listen(port, () => {
    console.log(`🚀 generation API listening on http://localhost:${port} (model: ${gen.modelName})`);
  });
}
