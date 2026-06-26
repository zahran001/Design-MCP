# Full-Stack Plan — Ship Generation Behind a UI

> **Status:** PLAN — 2026-06-25 (not yet built). This documents the next phase: wrap the tested generation
> pipeline in a web UI so users can type a request and **see** the Chakra v3 component. Backend
> reuses the existing, validated `runGenerationPipeline()` — the UI is a thin layer, not a rewrite.

## Why
The pipeline (`extract → normalize → embed → retrieve → generate`) is built and the A–F correction
loop reached **~93% grounded tsc-valid** (see [GENERATION_EXPERIMENT.md](GENERATION_EXPERIMENT.md)),
exercised today only via the CLI (`npm run cli -- 4-generate "<request>"`). This is an
**accessibility project**: the value is letting a user *see* the generated component rendered, not
just read code — so **live preview is core to the MVP, not optional**.

## What already exists (reuse, don't rebuild)
- **`src/steps/4-generate/pipeline.ts` → `runGenerationPipeline(gen, query, { outPath: null })`** —
  grounded generate → bounded `tsc` self-heal (smell + heuristic + few-shot lever) → returns
  `{ component, tscOk, tscOkSingleShot, repairIters, smells, incomplete, topContextComponent }`.
  Passing `outPath: null` returns the report without writing a file — exactly what an API wants.
- **`GenerationService`** (`generator.ts`) — `generate()` carries `context` (the retrieved chunks:
  `componentName` / `chunkType` / `score` / rendered text) for a "Grounded in" transparency panel.
- **Objective validators** — `tscValidator`, `v2SmellDetector`, `compositionLint`, `repairHints`.
- **Held-out example prompts** — `src/steps/4-generate/test-generation/heldout-prompts.ts` (5 prompts)
  to seed the UI's one-click examples.

## Stack (decided)
**Express API + Vite React SPA.** A long-lived Node process is required (generation needs the OpenAI
key + Qdrant client + a `child_process` `tsc` sandbox) — **not** serverless-friendly. The frontend is
built in **Chakra UI v3** to dogfood the target system.

```
[ Vite + React + Chakra v3 SPA ]  --HTTP-->  [ Express API ]  -->  runGenerationPipeline()
   prompt box, live preview,                  POST /api/generate        (retrieve + generate
   code view, report badges,                                              + tsc self-heal)
   "Grounded in" panel                                                  -->  Qdrant + OpenAI
```

## MVP scope (live preview is mandatory)

### Backend — `src/server/server.ts` (new)
- `POST /api/generate { query: string, useContext?: boolean }` → `runGenerationPipeline(gen, query,
  { outPath: null })` → respond with the component source + the three-tier report.
- **Extend `PipelineReport`** (in `pipeline.ts`) to include the retrieved `context` chunks (already on
  `GenerationResult.context`) so the UI can render the "Grounded in" panel. Keep `outPath` writing as
  the CLI path; the API just sets `outPath: null`.
- One shared `GenerationService` instance (warm Qdrant/OpenAI clients). Add `npm run serve` and/or a
  `4-serve` Commander command in `src/index.ts` mirroring the existing command pattern.
- Guardrails: input length cap, basic error JSON, a short in-memory rate limit (the pipeline spends
  OpenAI + `tsc` time per call).

### Frontend — `web/` (new, Vite + React + Chakra v3)
- **Prompt box + Generate** button; the 5 held-out prompts as one-click examples.
- **Live preview (mandatory):** render the generated component in-browser via **Sandpack**
  (`@codesandbox/sandpack-react`) or **`react-live`**, with `@chakra-ui/react` + a `ChakraProvider`
  in the sandbox. This is the headline accessibility feature. Show a graceful fallback if the
  component fails to render (it shouldn't, when `tscOk` — but handle it).
- **Code view:** syntax-highlighted TSX + copy-to-clipboard.
- **Report badges:** tsc ✓/✗ (+ `repairIters`), v2-smell count, composition complete — straight from
  the API report. Surface `tscOkSingleShot` vs final so users see "generated clean" vs "self-healed".
- **"Grounded in" panel:** collapsible list of retrieved chunks (component / chunkType / score) — the
  RAG transparency that showcases the whole pipeline.

### MVP acceptance
- Type a held-out prompt → component renders live + code + green report badges within one request.
- Type a landmine prompt (e.g. "a green submit button") → renders; badges reflect the server report.
- `--no-context` style toggle (optional in UI) visibly degrades output (demonstrates grounding's value).

## Later / things to wire after MVP (in rough priority)
- **Pass G** — close the last grounded holdout: a structural repair heuristic for `InputGroup` with
  multiple children / `InputRightElement` → "single `Input` child; trailing controls go in
  `endElement`" (the one case Pass F's exemplar didn't reliably fix).
- **Streaming** generation (token stream + progressive code render) and a **request history** panel.
- **Corpus expansion** to ~100 components: normalize + embed the 50 in `artifacts/raw-json-phase3-extra/`
  (unlocks Menu/Dialog/Select/Tabs prompts); then **re-run the retrieval eval** (extend the golden set
  for the new components) so quality stays proven.
- **Auth + rate-limit + persistence** (save/share generations); deploy (the Node server + Qdrant).
- **MCP server** — expose `generate a v3 component` as an MCP tool so other agents/tools can call it
  (makes the repo name "Design-MCP" literal). Shares the same `runGenerationPipeline` core.
- **Remaining 3 chunk types** (`prop-group`, `composition-pattern`, `api-reference`) — low ROI per
  `docs/CHUNK_TYPE_STRATEGY.md`; only if eval shows a gap they'd fill.

## Honest constraints to keep in mind
- **Generation is non-deterministic** (gpt-4o, temp 0.2) — the same prompt varies run to run; the UI
  should set that expectation (a "Regenerate" button is natural).
- **~93% is on adversarial landmines; held-out non-trap prompts are ~100%** — real-world UX is closer
  to the held-out end, but show the report so users always see the objective truth, not a promise.
- **Corpus is ~50 components** — out-of-corpus requests (e.g. a chart) won't have grounding; consider
  surfacing "no strong match" when the top retrieval scores are low.
