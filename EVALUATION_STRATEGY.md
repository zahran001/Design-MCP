# Evaluation Strategy & Retrieval-Quality Roadmap

> **Status:** active plan. Branch `week2_eval_harness` (3 commits, pushed).
> **Audience:** the next coding agent / contributor picking this up in a fresh session.
> **One-line goal:** build a *trustworthy* retrieval evaluation, then use it to prove whether
> **authentic documentation prose beats our synthesized template prose** as embedding input.

---

## 1. The goal

Design-MCP is a spec-driven component generator: crawl design-system docs → normalize into
semantic chunks → embed → retrieve → (later) generate component code from a natural-language
query. The quality of everything downstream is bounded by **retrieval quality**, and retrieval
quality is currently **unmeasured in any realistic way**.

The immediate goal is therefore *not* to add features. It is to:
1. Build a measuring instrument sensitive enough to tell good retrieval from bad.
2. Establish an honest baseline of the current system with it.
3. Use it to settle one fundamental question with data, not opinion:
   **is embedding synthesized template text a viable tactic, or must we embed the real prose
   that exists on the docs pages?**

---

## 2. The fundamental problem

Two problems are tangled together, and they must be solved in order:

**Problem A — the evaluation is not realistic.**
The current harness grades *"did the right component appear in top-5."* It reports **100%**,
which is misleading: it's too coarse (any of a component's ~30 chunks counts as a hit) and it may
be **circular** — the same author wrote both the test queries *and* the template prose they're
matched against, so we risk measuring "does our query resemble our template" instead of "does
this chunk answer a real developer."

**Problem B — we embed synthesized prose, not real prose.**
The text we actually embed for code examples is generated from hard-coded English templates
(see [explanationGenerator.ts](src/steps/1-normalize/generators/explanationGenerator.ts), a file
literally titled *"Hardcoded Templates"*). This produces homogeneous, low-distinctiveness vectors.

**You cannot answer B until you fix A** — any "templates vs real prose" experiment is meaningless
if the eval can't distinguish good retrieval from bad. Hence the phased plan in §4.

---

## 3. The proof (why we chose this path)

This plan is evidence-driven. Each decision traces to a concrete finding:

| # | Finding (evidence) | Decision it drove |
|---|---|---|
| 1 | **The eval instrument already caught a real bug.** A stale-DB/drift check exposed that 747 chunks were collapsing to 554 Qdrant points — **26% silently lost** to duplicate `chunkId`s (e.g. 14 Checkbox examples → 1 point). Fixed in commit `Fix chunkId collisions…`. | "Measure first" works → keep investing in the instrument before features. |
| 2 | **The 100% component-hit score is a mirage.** Component-level grading can't see whether the *right chunk* surfaced. | Upgrade to **chunk-level, LLM-as-judge graded relevance** (Phase 1). |
| 3 | **Circularity risk.** We authored the 31 queries *and* the template prose. Good scores may not generalize. | Add an **LLM-paraphrased, developer-phrased query set** to test robustness (Phase 1). |
| 4 | **Upstream extraction gap (the big one).** On the live Button page there are **~21 real section headings** (Sizes, Variants, Loading, With Icons…) and most carry a one-sentence description, e.g. *"Use the `size` prop to change the size of the button."* The raw JSON captured the heading for **1 of 16** examples and **zero** of the section prose. **We synthesize template prose to replace real prose we are throwing away.** | Fix the scraper as **Experiment #1** (Phase 3); real prose is the hypothesized substrate. It is also non-circular (not authored by us). |
| 5 | **Hardcoded-content audit.** Embedded code-example text is 100% template-generated; `version: '3.27.1'` is hardcoded in 4 places; `language: 'tsx'` and prop `complexity: 'simple'` are constants; `relatedChunks` is always `[]`; prop `usageGuidance` is mostly empty. Prop `description` is the one field using real crawled text. | Reinforces the "real prose > templates" hypothesis and lists cleanup targets for later repolish. |

---

## 4. The plan (3 phases)

### Phase 1 — Build the trustworthy evaluation (DO THIS FIRST)
**Do not touch the scraper yet.** Build the sensitive measuring tool:
- **LLM-as-judge graded relevance.** For each `(query, retrieved-chunk)` pair, an LLM grades
  relevance (e.g. 0 = irrelevant, 1 = partial, 2 = directly answers). Aggregate with
  **nDCG / graded precision** — not component match.
- **Paraphrased developer query set.** Generate diverse, real-developer-phrased paraphrases of
  the golden queries (held-out phrasing that does *not* reuse template vocabulary). This is the
  leakage/circularity test: scores that survive paraphrasing are real; scores that collapse prove
  the templates only match themselves.
- Keep the existing component-level metrics as a cheap sanity layer, but make the LLM-judged
  graded score the headline.

### Phase 2 — Lock in the baseline
Run the **current, template-generated data** (unchanged) through the new strict harness. This
yields a true, unvarnished baseline — expected to be **meaningfully lower than the superficial
100%** component-hit number. Commit this as the reference (alongside the existing
`artifacts/eval/baseline.json`).

### Phase 3 — Fix the scraper (Experiment #1)
Rewrite the DOM-traversal in the crawler so it correctly captures, per example: (a) its **real
section heading** and (b) the **introductory prose block** beneath it. Then:
1. Re-crawl (`0-extract-docs`).
2. Re-normalize so the embedded text is the **authentic heading + prose + code** (demote the
   template generator to a *fallback* for genuinely prose-less sections).
3. Re-embed (`2-embed`) and re-run the eval.

**The mathematical delta between this run and the Phase-2 baseline conclusively proves whether
human-written prose outperforms templates** (and resolves the vector-homogeneity / low-
distinctiveness issue). If real prose wins, templates retire. If it surprisingly doesn't, we've
avoided a large re-crawl on a hunch.

---

## 5. Success criteria

- **Phase 1 done:** `quality:eval` reports an LLM-judged graded score (nDCG) per query and
  per category, plus a paraphrased-query variant, with results written to `artifacts/eval/`.
- **Phase 2 done:** a committed baseline of the current template approach under the new metric.
- **Phase 3 done:** a second eval run on re-extracted real-prose data, and a documented delta vs
  baseline that makes the templates-vs-prose verdict unambiguous.

---

## 6. Handoff: context for the next coding agent

### Current state
- **Branch:** `week2_eval_harness` (cut from `week2_vectorDB_POC`; it is a strict superset of it).
  3 commits, pushed to origin. The user may merge it into `main`.
- **Tests:** 588 passing (`npm test`). `tsc -p tsconfig.json --noEmit` is clean.
- **Clean baseline (current template approach), `artifacts/eval/baseline.json`:**
  747 points = 747 chunks (no drift). `hit@5 = 100%`, `MRR = 0.938`, `P@5 = 0.703`,
  expected-chunk-type hit `48% (10/21)`, mean score generic `0.509` vs specific `0.552`.
  *These are the numbers the new LLM-judge metric will replace with something honest.*

### Stack & where things live
- **Embeddings:** OpenAI `text-embedding-3-small` (1536 dims). **Vector DB:** Qdrant at
  `http://localhost:6333` (dashboard at `/dashboard`), collection `chakra-ui-docs`.
- **Pipeline (CLI):** `0-extract-docs` → `1-normalize` → `2-embed` → `3-search`. Entry:
  [src/index.ts](src/index.ts).
- **Eval harness:** [src/steps/3-search/eval/](src/steps/3-search/eval/) —
  `metrics.ts` (pure scoring; this is where Phase-1 nDCG/LLM-judge functions should live),
  `golden-set.ts` (31 queries; add the paraphrased set here or alongside),
  `run-eval.ts` (runner; provenance header + stale-DB warning),
  `__tests__/metrics.test.ts`. Script: `npm run quality:eval`.
- **Services:** [src/services/](src/services/) — `EmbeddingService` (OpenAI),
  `VectorStoreService` (Qdrant; has `getPointCount` for drift detection), `RetrievalService`
  (`searchDetailed(query, k)` returns `{rank, score, id, payload}` — reuse this; do NOT build a
  parallel retrieval path).
- **Qdrant payload fields** (set in [embedder.ts](src/steps/2-embed/embedder.ts)):
  `chunkType, chunkId, componentName, category, tags, sourceUrl, version, complexity,
  explanation, code, demonstrates, propName, propCategory, propDescription, propType, fullChunk`
  (`fullChunk` is the entire chunk JSON-stringified — handy for the LLM judge).

### Gotchas (read before running)
- **`.env` has `DEBUG=true` → the OpenAI SDK dumps every full request/response** (headers +
  base64 vectors) to stdout. Set `DEBUG=false` before any `2-embed`/`quality:eval` run. `.env` is
  gitignored; it must contain `OPENAI_API_KEY` and `QDRANT_URL`.
- **Drift detection:** the runner warns when Qdrant point count ≠ on-disk normalized chunk count.
  If you change normalize/embed logic you MUST re-run `2-embed` for valid scores.
- **chunkId → point ID is `uuidv5(chunkId)` (idempotent upsert).** If you change chunkIds
  (e.g. via the scraper rewrite), old points become orphans. **Drop the collection before
  re-embedding** (`curl -X DELETE http://localhost:6333/collections/chakra-ui-docs`, or via the
  dashboard) — `createCollection` is idempotent and will NOT clear stale points.
- Qdrant must be running (Docker). The harness exits with a clear message if the collection is
  absent.

### The Phase-3 extraction bug (specifics)
- Mechanism: [`findPrecedingHeading`](src/steps/0-extract-docs/extractors.ts) walks DOM
  siblings/ancestors to label each code block, but Chakra v3 wraps each demo in a tabbed
  Preview/Code component, so the `<pre><code>` is nested away from its H2/H3 and the walk misses
  it. The section's **intro paragraph is never extracted at all** (the function only returns
  heading text).
- Target: capture per example `section` (heading) **and** a new `sectionDescription` (intro
  prose), then thread both into the normalized chunk's embedded text.

### Chunk-type status (for later, not Phase 1–3)
- 2 of 7 chunk types implemented: `code-example` (387) and `prop-reference` (360).
- Missing high-value types per the baseline's low expected-chunk-type score:
  `component-overview` ("what is X") and `capability-reference` ("what can X do"). Schemas already
  exist in [NormalizedChunkSchema.ts](src/schemas/NormalizedChunkSchema.ts).

### Related docs
- [CHUNK_TYPE_STRATEGY.md](CHUNK_TYPE_STRATEGY.md) — ROI analysis of the 7 chunk types.
- [RETRIEVAL_TEST_REPORT.md](RETRIEVAL_TEST_REPORT.md) — the original 5-query manual test the
  golden set was seeded from.
- [CLAUDE.md](CLAUDE.md) — project quick facts & contribution rules.
