# CLAUDE.md

> **Status:** 2026-06-26 — current to steps 0–4. Canonical agent guide; orientation only, no volatile
> metrics (those live in `README.md` / `GENERATION_EXPERIMENT.md`).

## 1) Project quick facts

* **Name:** `spec-driven-generator`
* **Goal:** A RAG → generation pipeline for Chakra UI **v3**. Crawl the docs, normalize them into
  typed chunks, embed them into Qdrant, retrieve on a natural-language request, and **generate one
  grounded, self-contained TSX component** that uses the current v3 API. Retrieval quality matters
  only insofar as it makes generation correct.
* **Pipeline (5 steps, each a CLI command):**

  ```
  0-extract-docs → 1-normalize → 2-embed → 3-search → 4-generate
  (crawl)          (chunk)        (Qdrant)  (retrieve)  (LLM → TSX)
  ```

* **Primary commands:**

  ```bash
  npm run cli -- 0-extract-docs [-s <START_URL>] [-m <MAX_PAGES>]
  npm run cli -- 1-normalize [component]
  npm run cli -- 2-embed [-l <limit>] [-b <batch-size>]
  npm run cli -- 3-search "<query>" [-l <limit>]
  npm run cli -- 4-generate "<request>" [-o <file>] [-k <n>] [--no-context]
  ```

* **Key tech:** TypeScript (NodeNext, ES2022, strict), Playwright (crawler), Commander (CLI), Zod
  (schemas), Qdrant (vector store), OpenAI (embeddings + generation + judge), Jest, Docker.

```
src/
  index.ts                          # CLI entrypoint (all 5 commands)
  steps/
    0-extract-docs/                 # Playwright BFS crawler + Chakra extractors
    1-normalize/                    # raw JSON → typed chunks (transformers/, inference/, config/)
    2-embed/                        # embed chunks → Qdrant (embedder.ts, utils/extractEmbeddingText.ts)
    3-search/                       # retrieval CLI + LLM-as-judge eval harness (eval/)
    4-generate/                     # generation: generator.ts, pipeline.ts, validators/, eval/, test-generation/
  services/                         # RetrievalService, VectorStoreService, EmbeddingService
  schemas/                          # NormalizedChunkSchema (7 chunk types), RAGResultSchema
  config/                           # vectorConfig (model/collection names)
artifacts/                          # raw-json/, normalized/, gen-eval/, generated/ (gitignored)
gen-sandbox/                        # tsconfig + temp file the tsc validator type-checks against
```

## 2) Where things stand (orientation only)

All five steps are built. **Steps 0–3 (extract → normalize → embed → search) are mature**; the
embedded corpus is the `chakra-ui-docs` Qdrant collection. **Step 4 (generate) is the active surface**:
grounded generation + bounded `tsc` self-heal, gated on objective signals (the A–F correction loop).
Not all 7 chunk types are implemented, and a small set of generation prompts still fail — both move
over time.

> **Live status, metrics, point/chunk counts, and the open failure list are NOT kept here** — they
> drift. Read them from `README.md` (per-step status) and `GENERATION_EXPERIMENT.md` (Step-4 numbers).
> Before relying on any figure, verify it at the source (Qdrant `points/count`, a harness run).

## 3) How to run locally

```bash
# one-time
npm install
npx playwright install chromium      # step 0 only
cp .env.example .env                 # set keys / crawl config

# run the pipeline
npm run cli -- 0-extract-docs -m 5   # crawl a few pages
npm run cli -- 1-normalize           # chunk all components
npm run cli -- 2-embed               # embed → Qdrant (needs Qdrant up + OPENAI_API_KEY)
npm run cli -- 3-search "a checkbox with a label"
npm run cli -- 4-generate "a green submit button"

# generation eval harnesses (run via tsx)
npx tsx src/steps/4-generate/eval/run-ab.ts                 # grounded-vs-no-context 2×2 (~7 min)
npx tsx src/steps/4-generate/test-generation/run-heldout.ts # held-out generalization (~2 min)

# tests / quality
npm test                             # Jest
npm run quality:smoke                # step-0 extraction sanity
```

**ENV:**

* **Crawl (step 0):** `START_URL` (default Chakra components overview), `MAX_PAGES` (default 20),
  `CRAWL_URL_PATTERN` (required — only URLs starting with this are followed).
* **Vector / generation:** `OPENAI_API_KEY` (required), `QDRANT_URL` (default `http://localhost:6333`),
  `GEN_MODEL` (default `gpt-4o`), `EVAL_JUDGE_MODEL` (default `gpt-4o-mini`).
* **`DEBUG`** — set **`false`** before any embed/search/generate run, else the OpenAI SDK floods stdout.

## 4) Style & code conventions

* **Module system:** ESM, `"module"/"moduleResolution": "NodeNext"`, target ES2022, `strict: true`.
* **Imports:** named imports; include the `.js` extension in relative specifiers (NodeNext).
* **Naming:** `kebab-case.ts` modules, `PascalCase` types/components.
* **Errors:** throw with actionable messages; log compact context (`url`, `selector`, `componentName`,
  `chunkId`, `query`). A validation/`tsc` failure is **data, not an exception** — resolve, don't throw.
* **Readable explicitness over clever one-liners.** Match the density/idiom of surrounding code.

## 5) Contribution rules for Claude

* **Flag CLAUDE.md drift on sight.** This file is loaded every session as the source of truth. If it
  contradicts the actual code, file paths, conventions, status, or a decision made in-session (scope
  crept, a "planned" item shipped, a number or path changed), **stop and surface it** — propose the
  specific fix and get it updated. Do **not** silently work around a stale instruction. (It was once
  frozen at Week 1; that caused real confusion.)
* **Never invent** commands, file paths, or public APIs. For Chakra **v3** specifically: do not emit an
  API from memory — verify it against the retrieved corpus or the `gen-sandbox` `tsc` check (v3 was a
  major breaking change from v2). If unsure, ask.
* **Objective signals are the spine.** `tsc`-validity + the `v2-smell` lint + the composition lint are
  the trusted gates. The LLM judge is **not** trusted on v3 (it inverts) — it is a secondary signal
  only. When you claim an improvement, back it with the objective numbers.
* **Small, surgical diffs.** Focused changes, rationale in the message. Re-runs must stay idempotent
  (don't duplicate artifacts; point IDs are `uuidv5(chunkId)`).
* **Guardrails (crawl):** only follow URLs matching `CRAWL_URL_PATTERN`; strip hash fragments when
  enqueueing; be resilient to selector drift (semantic queries, optional chaining).
* **Guardrails (generate):** the generation/repair prompts import **only** from `@chakra-ui/react` and
  `react` (no `@/components/ui/*`, no icon libs). Keep the A/B isolation: knowledge that should come
  from retrieval (e.g. v2→v3 renames, exemplars) must **not** leak into the shared prompt — grounded-
  arm-only, keyed on retrieval.
* **Security:** never commit secrets; `.env` is gitignored; reference `.env.example` only.
* **Doc freshness.** Every root doc carries a `> Status: <YYYY-MM-DD> — <condition>` header; bump the
  date only on a **substantive** update (not typo fixes). Date volatile *claims* inline with how they
  were verified (e.g. "Qdrant counts as of <date>"). Don't hand-maintain a raw "last modified" line —
  `git log -1 --format=%cs -- <file>` is the source of truth. When you create a new root doc, add the
  Status header.

## 6) Test / verify flow

```bash
# generation: a change is "good" only if the objective 2×2 says so
npx tsx src/steps/4-generate/eval/run-ab.ts            # grounded hinted tsc-pass + v2-smell + composition
npx tsx src/steps/4-generate/test-generation/run-heldout.ts
npx tsc --noEmit                                       # repo type-check

# extraction smoke
npm run cli -- 0-extract-docs -m 5
npm run quality:smoke
```

**Generation success criteria:** grounded `tsc`-pass (hinted) holds/improves, `v2-smell` rate does not
rise, composition stays complete, held-out stays ~100%. Judge **per target prompt cell**, not the
headline rate — generation is non-deterministic (gpt-4o), so single-run flips are often noise.

## 7) Key files by step

* **Generation core:** `src/steps/4-generate/generator.ts` (`GenerationService.generate` /
  `.repair`; reserved-slot retrieval; `FEWSHOT_EXEMPLARS`), `pipeline.ts` (`runGenerationPipeline` —
  generate → self-heal → validate → optional write; the shippable path the future UI/API reuses).
* **Validators (objective gates):** `validators/tscValidator.ts` (runs `npx tsc -p
  gen-sandbox/tsconfig.json`, pinned `@chakra-ui/react@3.27.1`), `v2SmellDetector.ts` (`V2_SMELLS`
  rename map), `compositionLint.ts` (`COMPOSITION_RULES`), `repairHints.ts` (smell + heuristic repair
  hints).
* **Generation eval:** `eval/run-ab.ts` (2×2 harness), `eval/generationJudge.ts`,
  `test-generation/landmine-prompts.ts` (15 v2-trap prompts), `heldout-prompts.ts` (5),
  `run-heldout.ts`, `run-spike.ts`, `validator-selftest.ts`.
* **Retrieval / store:** `src/services/RetrievalService.ts`, `VectorStoreService.ts`,
  `EmbeddingService.ts`; retrieval eval in `src/steps/3-search/eval/`.
* **Schemas:** `src/schemas/NormalizedChunkSchema.ts` (7 chunk types), `RAGResultSchema.ts`.

## 8) Response format

When asked for code changes: a 1–3 bullet summary of why/what, then the diffs (or full contents for new
files), then run/test steps, and note any flaky/uncertain spots. Report outcomes honestly — if a run
failed or a target didn't flip, say so with the numbers. Keep it tight; skip narration of options you
won't take.

## 9) Docker (step 0, reproducible crawl)

```bash
docker build -t component-generator .
docker run --rm -e START_URL="https://chakra-ui.com/docs/components/concepts/overview" \
  -e MAX_PAGES=20 component-generator
```

Node 20 base; install Playwright deps via `npx playwright install --with-deps`; multi-stage, keep the
image small.

## 10) Known gotchas (read before coding)

* **Chakra v3 ≠ v2.** A v2-trained model emits `colorScheme`/`isLoading`/`leftIcon`/`FormControl`/
  monolithic components unless grounded. The retrieved context (and the curated lints) are the defense.
* **Some docs' v3 snippets import `@/components/ui/*`** (copy-in compositions, not real packages) —
  forbidden in output; rebuild from `@chakra-ui/react` primitives.
* **Before embed/search/generate:** Qdrant must be up, `DEBUG=false`, `OPENAI_API_KEY` set. Drop the
  `chakra-ui-docs` collection before re-embedding if `chunkId`s changed (stale points orphan).
* **`tsc` validates types, not runtime** — a component can compile and still render wrong; nothing
  renders generated output yet (see `README_HARDENING.md`).
* **Generation is non-deterministic** (temp 0.2). Treat single-run metric flips as noise until variance
  is controlled.
* **Crawl:** Chakra markup drifts across versions — prefer semantic selectors; strip hash fragments;
  missing props tables / code samples are OK, don't fail the run.

## 11) Non-goals (for now)

* The UI / serving layer, corpus expansion, the remaining 3 chunk types, and an MCP server are
  **planned, not in scope yet** — see `README_FULLSTACK.md` and `README_HARDENING.md`.
* Parallel browser contexts, screenshotting, persisted crawl checkpointing.

## 12) Related docs

* `README.md` — top-level overview + per-step status.
* `GENERATION_EXPERIMENT.md` — the Step-4 A–F correction loop (method, 2×2 results, every pass's notes).
* `EVALUATION_STRATEGY.md` — the retrieval-eval roadmap and authentic-prose verdict.
* `README_HARDENING.md` — the next phase: reproducibility (temp 0 + seed) + a headless render-check,
  before the UI.
* `README_FULLSTACK.md` — the UI/serving plan (Express API + Vite/Chakra-v3 SPA, live preview).
* `docs/CHUNK_TYPE_STRATEGY.md` — ROI analysis of the 7 chunk types.

---

### TL;DR for Claude

* It's a full RAG→generation pipeline now (steps 0–4), not just a crawler.
* Trust **objective signals** (`tsc` + `v2-smell` + composition), not the LLM judge, on v3.
* **Never invent v3 APIs** — verify against the corpus or the `tsc` sandbox.
* Keep diffs small, prove claims with the harness numbers, and keep the A/B isolation intact.
