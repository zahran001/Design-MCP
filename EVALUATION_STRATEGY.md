# Evaluation Strategy & Retrieval-Quality Roadmap

> **Status:** active plan. Branch `week2_eval_harness`.
> **Phases 1–3: DONE — 2026-06-22.** Verdict reached: **authentic prose beats templates**
> (Phase 3 result table in §4). Instrument built (Phase 1), gpt-4o baseline locked (Phase 2),
> scraper rewritten + re-embedded + measured (Phase 3).
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

### Phase 1 — Build the trustworthy evaluation (DO THIS FIRST) — ✅ DONE
**Do not touch the scraper yet.** Build the sensitive measuring tool:
- **LLM-as-judge graded relevance.** For each `(query, retrieved-chunk)` pair, an LLM grades
  relevance (0 = irrelevant, 1 = partial, 2 = directly answers). Implemented in
  [judge.ts](src/steps/3-search/eval/judge.ts) (OpenAI, env `EVAL_JUDGE_MODEL`, default
  `gpt-4o-mini`; content-addressed disk cache; `EVAL_JUDGE_DELAY_MS` / `EVAL_JUDGE_MAX_RETRIES`
  for low-TPM accounts). Pure scoring (nDCG, graded precision, aggregation) lives in
  [metrics.ts](src/steps/3-search/eval/metrics.ts).
- **Paraphrased developer query set.** Committed, held-out, developer-phrased paraphrases of every
  golden query in [golden-set-paraphrased.ts](src/steps/3-search/eval/golden-set-paraphrased.ts)
  (derived from `GOLDEN_SET` so they can't drift; `gen-paraphrases.ts` regenerates via LLM).
- Run it: `npm run quality:eval:judge` (= `--judge --paraphrased`).

**Headline-metric correction (evidence-driven, supersedes the original "nDCG is the headline"):**
A gpt-4o-mini *and* gpt-4o run both reported **nDCG ≈ 0.94** — high, and nearly identical across
judges. The cause is structural: **nDCG only ranks the chunks that were retrieved**, so it is blind
to better chunks that never surfaced and saturates whenever *anything* relevant is in the top-k.
It is therefore a *diagnostic*, not the headline. The honest headline is **graded precision@k
(`gP@k`, fraction of top-k the judge rated ≥ partially relevant) + the no-relevant-query count**.
These *do* move: under the stricter gpt-4o judge, `gP@k` falls from mini's inflated 0.916 to 0.852
(golden) and the paraphrase gap triples (Δ −0.058 → −0.168). nDCG remains a labeled secondary
(`nDCG*`) in the output.

### Phase 2 — Lock in the baseline
Run the **current, template-generated data** (unchanged) through the new strict harness. This
yields a true, unvarnished baseline — expected to be **meaningfully lower than the superficial
100%** component-hit number. Commit this as the reference (alongside the existing
`artifacts/eval/baseline.json`).

### Phase 3 — Fix the scraper (Experiment #1) — ✅ DONE, real prose WINS
Rewrite the DOM-traversal so it captures, per example: (a) its **real section heading** and (b) the
**introductory prose block** beneath it, then re-crawl → re-normalize → re-embed → re-eval.

**What the live DOM actually revealed (bigger than the original premise):** each Chakra v3 demo is
a Preview/Code/Stackblitz **tab widget whose code `<pre>` is unmounted until the "Code" tab is
clicked** — on the Button page only 10 of 27 code blocks exist on load. So the old crawler wasn't
just mislabeling headings; most demo code wasn't in the DOM at all. The fix (in
[extractors.ts](src/steps/0-extract-docs/extractors.ts)) is two parts:
1. `revealCodeTabs(page)` — click every `main [role="tab"]` named "Code" to mount the demo `<pre>`.
2. `computeSectionContexts(page)` — one **document-order** `TreeWalker` pass over `<main>` that
   attributes each `<pre>` its nearest heading + buffered intro `<p>` prose, skipping
   `[role="tabpanel"]` preview noise (color-swatch labels etc.). Replaces the old fragile
   sibling/parent walk.

Capture on Button went **1/16 headings + 0 prose → 22/22 + 22/22** (Checkbox 21/20, Stack 6/6). New
fields `sectionId`/`sectionDescription` flow through `CodeExampleSchema` → `RawCodeExampleSchema`
(must be declared there — zod strips unknown keys) → `codeExampleTransformer`, where real prose
becomes the embedded `explanation` and the real heading the `Title:` anchor; the template is demoted
to a fallback (`sectionDescription` < 12 chars or absent).

**Result — gpt-4o judge, k=5, identical 50-component corpus** (Phase-3 report
`artifacts/eval/baseline-judged-gpt4o-phase3.json`; baseline `…gpt4o.json`):

| metric | Phase 2 (template) | Phase 3 (real prose) | Δ |
|---|---|---|---|
| golden gP@k | 0.852 | **0.884** | +0.032 |
| paraphrased gP@k | 0.684 | **0.748** | **+0.064** |
| paraphrased no-rel queries | **3** | **0** | **−3** |
| paraphrased component hit@5 | 84% | 90% | +6% |
| leakage Δ gP@k (golden→para) | −0.168 | −0.135 | narrower (more robust) |

**Verdict: authentic prose beats templates.** The gain is *larger on the held-out paraphrased
(non-circular) queries* than on the golden set — real prose generalizes to developer phrasing where
template-vocabulary overlap could not — and it eliminated the 3 catastrophic zero-relevant cases.
Templates are retired to a fallback. (Corpus held to the baseline's 50 components so the delta
isolates prose; the re-crawl also discovered ~50 new components, set aside in
`artifacts/raw-json-phase3-extra/` for a future coverage expansion.)

---

## 5. Success criteria

- **Phase 1 done ✅:** `quality:eval:judge` reports LLM-judged graded relevance — headline
  `gP@k` + no-relevant count, with `nDCG*` as a diagnostic — per query and per category, for both
  the golden set and a held-out paraphrased set (with a leakage Δ), written to `artifacts/eval/`.
- **Phase 2 done:** a committed baseline of the current template approach under the new metric.
  The **gpt-4o** run is the reference (`artifacts/eval/baseline-judged-gpt4o.json`; numbers below).
- **Phase 3 done ✅:** real-prose re-extraction + re-embed (784 chunks, same 50 components) and a
  documented gpt-4o delta (golden gP@k +0.032, paraphrased +0.064, paraphrased no-rel 3→0). Verdict:
  authentic prose wins; templates demoted to fallback. See §4 table.

---

## 6. Handoff: context for the next coding agent

### Current state
- **Branch:** `week2_eval_harness` (cut from `week2_vectorDB_POC`; it is a strict superset of it).
- **Tests:** eval suite 33 passing; `tsc -p tsconfig.json --noEmit` clean. (Note: 2 tests in
  `transformationMetrics.test.ts` fail only under the *full parallel* run — a pre-existing
  shared-log-file race; they pass 41/41 in isolation. Unrelated to the eval work.)
- **Component-level baseline (structural sanity), `artifacts/eval/baseline.json`:**
  747 points = 747 chunks (no drift). `hit@5 = 100%`, `MRR = 0.938`, `P@5 = 0.703`,
  expected-chunk-type hit `48% (10/21)`.
- **Phase-1/2 honest baseline — gpt-4o judge, k=5** (committed report
  `artifacts/eval/baseline-judged-gpt4o.json`):
  | set | gP@k (headline) | no-rel | nDCG* (diag) |
  |---|---|---|---|
  | golden (31q) | **0.852** | 0 | 0.941 |
  | paraphrased (31q) | **0.684** | **3** | 0.880 |
  Leakage Δ: component hit@5 100%→84%, **gP@k −0.168**, expected-chunk-type 48%→24%. The 3
  no-relevant paraphrased queries (2 `layout`, 1 `how-to`) and the gP@k collapse are the strongest
  evidence so far that retrieval leans on template-vocabulary overlap — the hypothesis Phase 3 tests.
  (A gpt-4o-mini run exists too but grades leniently — `gP@k` inflated by 6–17 pts; use gpt-4o for
  the reference.)

### Stack & where things live
- **Embeddings:** OpenAI `text-embedding-3-small` (1536 dims). **Vector DB:** Qdrant at
  `http://localhost:6333` (dashboard at `/dashboard`), collection `chakra-ui-docs`.
- **Pipeline (CLI):** `0-extract-docs` → `1-normalize` → `2-embed` → `3-search`. Entry:
  [src/index.ts](src/index.ts).
- **Eval harness:** [src/steps/3-search/eval/](src/steps/3-search/eval/) —
  `metrics.ts` (pure scoring: component metrics + nDCG/gP@k graded relevance),
  `judge.ts` (LLM-as-judge + chunk renderer + disk cache),
  `golden-set.ts` (31 queries), `golden-set-paraphrased.ts` (held-out paraphrases),
  `gen-paraphrases.ts` (LLM regenerator), `run-eval.ts` (runner; provenance + stale-DB warning +
  leakage report), `__tests__/{metrics,judge}.test.ts`.
  Scripts: `npm run quality:eval` (cheap component metrics), `npm run quality:eval:judge`
  (`--judge --paraphrased`; the headline run), `npm run quality:paraphrase:gen`.
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
