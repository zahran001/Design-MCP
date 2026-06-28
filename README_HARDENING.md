# Pipeline Hardening — Make Generation Trustworthy Before the UI

> **Status:** IN PROGRESS — 2026-06-28. Move 0 (noise quantified) ✅ and **Item 1 variance control**
> (temp + seed knob) ✅ landed; Items 2 (render-check) and 3 (stable failure set + expandability) not yet
> built. This is the self-contained context to harden the generation pipeline so the metrics are
> reproducible and the outputs are proven to actually *render*, **before** building the UI
> ([README_FULLSTACK.md](README_FULLSTACK.md)). Read this end-to-end before starting — it captures the
> decisions already made so you don't re-litigate them.

## Why this phase exists
The A–F correction loop reached **~87% grounded `tsc`-valid** (hinted repair) on the 15 landmine
prompts — measured across 3 runs (2026-06-28): 12/15 reliably pass, 1 reliably fails
(`password-input`), and 2 are genuine coin-flips (`button-icon`, `icon-button`); the **~93%** quoted in
earlier passes was the lucky top of an 80–93% range (see Move 0 below). Held-out non-trap prompts stay
**100%** (n=5; see [GENERATION_EXPERIMENT.md](GENERATION_EXPERIMENT.md)). Two credibility gaps still
block trusting these numbers and block a smooth UI build:

1. **Soft numbers.** Generation is non-deterministic (gpt-4o, temp 0.2). Single-shot grounded `tsc`
   swung **47→60%** across runs; `button-icon` flipped ok↔ERR between Passes D/E/F on nothing but
   temperature. A single run's pass/fail is noise — so "is X the only failure?" and "did my fix help?"
   are currently unanswerable with confidence.
2. **Never rendered.** `tsc` proves *types*, not *runtime*. **No generated component has ever been
   mounted.** A component can be `tsc`-ok + smell-free + composition-complete and still throw on mount
   or render blank. This is the single biggest blind spot, and it's the same capability the UI's live
   preview needs.

**Out of scope for this phase (deliberately deferred):** the UI / serving layer, corpus expansion
(~50 more components in `artifacts/raw-json-phase3-extra/`), the 3 remaining low-ROI chunk types, and
the MCP server. Goal here = a **stable, trustworthy, expandable** pipeline first.

---

## Tackle order (decided) — and why
**1 → 2 → 3.** Each is a prerequisite for trusting the next.

1. **Variance control** (temp 0 + seed in the harness). Cheapest (~½ day) and it's the *measurement
   substrate* — without it you can't read any signal from items 2 or 3.
2. **Headless render-check** (the runtime correctness oracle). Biggest gap; build it **before** the UI
   because it's a validation gate (not a UI feature) and it de-risks the UI's live preview (same
   mechanism, proven headless first).
3. **Re-measure the stable failure set + Pass G + expandability.** Only meaningful once 1 (stable
   measure) and 2 (runtime oracle) exist.

> Verification-first is the explicit goal: locking 1 and 2 makes item 3 precise instead of guesswork.

---

## Item 1 — Variance control (temp 0 + seed) ✅ DONE (2026-06-28)
**Principle: separate MEASUREMENT from PRODUCT — they want opposite things.**

> **Shipped.** `GenerationService` constructor now takes `{ temperature?, seed? }` (defaults from
> `GEN_TEMP` / `GEN_SEED`, product default temp **0.2**); both are threaded into the generate **and**
> repair `chat.completions.create` calls (`seed` omitted entirely when unset). `repair()` stays temp 0.
> The two **measurement** harnesses (`run-ab.ts`, `run-heldout.ts`) construct with `{ temperature: 0,
> seed: 42 }` (`MEASUREMENT_SEED`); the product CLI and the manual-inspection scripts (`run-spike`,
> `reserved-slot-check`) keep the 0.2 default. `npx tsc --noEmit` clean. Config helpers
> `getGenerationTemperature()` / `getGenerationSeed()` added to `vectorConfig.ts`; `.env.example`
> documents `GEN_TEMP` / `GEN_SEED`.
>
> **Verify ✅ (2026-06-28).** Ran the seeded `run-ab.ts` **twice** (temp 0 + seed 42; reports
> `gen-ab-2026-06-28T05-52` & `T06-00`): **0/90 cells flipped** — bit-identical, including the two
> coin-flip cells. Headline reproduced exactly (grounded hinted 0.867 / 0.867, single-shot 0.667 /
> 0.667). So the seed delivers run-to-run determinism here (no `system_fingerprint` drift observed this
> session). **Important nuance — reproducible ≠ representative:** seed 42 happens to pin `button-icon`→
> FAIL and `icon-button`→PASS, so the seeded headline is **13/15 (86.7%)**; a *different* seed could pin
> `button-icon`→PASS → 14/15 (93%). The seeded number is a stable *regression* signal, **not** the true
> reliability of the two bimodal cells — that still needs `--samples k`.
>
> **Still open from Item 1:** the optional `--samples k` mode — Move 0 + this Verify *confirm* it's
> needed (seed pins coin-flips to one arbitrary side), but it's a milestone-only headline tool, not yet
> built.

- **Measurement harness** (`run-ab.ts`, `run-heldout.ts`): generate at **temperature 0 + a fixed
  `seed`** so one run is a stable signal. (OpenAI's `seed` + `system_fingerprint` is best-effort, not
  a hard guarantee, but it materially cuts noise.)
- **Headline reliability number:** temp 0 = reproducible but a *single* sample. For an honest "~X%
  reliable" claim, run an occasional **k-sample pass-rate** (k=3–5 generations/prompt, report % that
  pass). Expensive (3–5× the ~7-min run) → milestones only, not every iteration.
- **Product (future UI):** keep **temp ~0.2 + a Regenerate button** — variety is a feature there.

**What to change**
- `src/steps/4-generate/generator.ts` — `GenerationService` currently hardcodes `temperature: 0.2` in
  `generate()` (the `chat.completions.create` call) and `temperature: 0` in `repair()`. Add a
  `temperature` + `seed` knob (constructor option and/or `GEN_TEMP` / `GEN_SEED` env), thread `seed`
  into the `chat.completions.create` calls. **Default product temp stays 0.2.**
- `src/steps/4-generate/eval/run-ab.ts` and `test-generation/run-heldout.ts` — construct the
  `GenerationService` with **temp 0 + a fixed seed** (e.g. `new GenerationService({ temperature: 0,
  seed: 42 })`).
- (Optional) a small `--samples k` mode in `run-ab.ts` that generates k times per (prompt, arm) and
  reports per-cell pass-rate for the headline number.

**Move 0 — noise quantified ✅ (2026-06-28, 3× pre-change `run-ab.ts`, reports
`artifacts/gen-eval/gen-ab-2026-06-28T05-{15,21,27}-*.json`).** Tracked tsc pass/fail across 90 cells
(15 prompts × {grounded, nocontext} × {single, raw-repair, hinted-repair}):
- **5/90 cells flip (5.6%)** — under the 8% bar, so **temp 0 stabilizes the measurement** (Item 1 done).
- **All noise is in the grounded arm** — `nocontext` is 0/45 (it reliably re-emits the same v2 output).
- **Two genuinely bimodal cells:** `button-icon` and `icon-button` are ~50/50 *generation* outcomes, not
  measurement jitter. temp 0 + seed freezes each to ONE arbitrary outcome → it would report 100%/0% for
  something truly ~50%. **This is exactly why the `--samples k` headline mode is still worth keeping**
  (milestones only). `input-addon` also flipped single-shot once.
- **`password-input` = STABLE-FAIL** (ERR all 3 runs) → a real coverage gap, not noise → Item 3 / Pass G.
- **Headline swing:** grounded hinted 0.933 / 0.867 / 0.867 (so honest ~**87%**, range 80–93%, not the
  93% single-run high); grounded single-shot 0.667 / 0.600 / 0.733 (13pt spread — confirms the noted
  47–60% swing is real). Analysis script: `scratchpad/flip_analysis.py` (throwaway).

**Verify:** run `run-ab.ts` twice with temp 0 + seed → identical (or near-identical) per-cell results.

---

## Item 2 — Headless render-check (gap #7, the runtime oracle)
**Goal:** a 4th objective gate — "does the generated component actually mount and render?" — that runs
headless (no UI), catches what `tsc` misses, and becomes the proven foundation the UI's live preview
reuses.

**Why before the UI:** (a) it's a *validator*, valuable with or without a UI; (b) live preview and
this check are the *same mechanism* (Chakra component + provider, rendered) — solve it headless first,
then the UI's Sandpack/react-live preview is reusing a solved problem; (c) it will likely surface
new failures, and you want that list before staring at a blank preview pane.

**Recommended approach — real browser (Playwright is already a dependency, used by the crawler):**
1. Wrap the generated component's default export in a tiny mount harness with the **Chakra v3
   provider** (verify the exact API against the pinned `@chakra-ui/react@3.27.1` — v3 uses
   `ChakraProvider` with a system value, e.g. `import { ChakraProvider, defaultSystem }` →
   `<ChakraProvider value={defaultSystem}>`; confirm, don't assume).
2. Bundle harness + component (component imports `@chakra-ui/react` + `react`) with **esbuild** (small
   dep) into one JS file.
3. Load it in **Playwright Chromium**, render, and assert: **no uncaught error/console.error on
   mount**, and the root produced **non-empty DOM**. Optionally screenshot to `artifacts/` for eyeball
   QA.

**Why a real browser, not jsdom:** Chakra v3 components use browser APIs (ResizeObserver,
`matchMedia`, portals) that jsdom lacks — complex ones (ColorPicker, Dialog) would false-fail under
jsdom. Chromium has them.

**Alternative (aligns with the UI):** render via the same in-browser bundler the UI will use
(Sandpack / `react-live` + esbuild-wasm) driven by Playwright. Heavier, but zero divergence from the
eventual preview. Recommended only if you want one renderer for both; otherwise esbuild+Playwright is
leaner for a CI gate.

**Wire-up**
- New `src/steps/4-generate/validators/renderValidator.ts` → `renderValidate(componentCode):
  Promise<{ ok: boolean; error?: string }>` mirroring `tscValidator.ts`'s shape (always resolves;
  failure is data, not an exception).
- Add it to `pipeline.ts` (`runGenerationPipeline`) as a reported signal, and to `run-ab.ts` /
  `run-heldout.ts` as a column. **Expect render-pass rate ≤ tsc-pass rate** — that gap is the point.
- Perf note: a browser render is slower than `tsc` (~seconds). Reuse a single Playwright
  browser/context across the run; only render the *final* (post-heal) component, not every repair iter.

**Reference (existing pattern to mirror):** `src/steps/4-generate/validators/tscValidator.ts` writes
to `gen-sandbox/generated.tsx` and shells `npx tsc -p gen-sandbox/tsconfig.json`; the new validator
follows the same "write → run tool → parse result → resolve" shape.

---

## Item 3 — Stable failure set + Pass G + expandability
Do this **after** 1 and 2 (stable measure + runtime oracle).

**Re-measure the failure set.** With temp 0 + seed, re-run `run-ab.ts` and record the *stable*
grounded-hinted failures. In the last (noisy) Pass F run it was **only `password-input`** (14/15) — but
**don't trust that single sample.** Expectation: `password-input` is a *reliable* failure; one or two
others (e.g. `button-icon`) are *flaky*. **Treat them differently:** flaky = a variance problem (Item
1 already addresses it); reliably-failing = a coverage problem (below). Also re-check every cell under
the **render** gate — some `tsc`-ok components may fail to render.

**Tactical fix for `password-input` (Pass G).** It fails as TS2746: the model nests `<Input>` +
`<IconButton>` as `InputGroup` children instead of using the `endElement` prop. A structural repair
heuristic (same shape as Pass E's, in `src/steps/4-generate/validators/repairHints.ts`): detect
`InputGroup` with multiple children / `InputRightElement`/`InputLeftElement` → hint "InputGroup takes a
single `Input` child; trailing controls go in the `endElement` prop." `tsc` already names the error,
so it's gate-able.

**The strategic decision (the real ask — "make the pipeline expandable"):** don't hand-patch one
prompt at a time — that's the per-component-template treadmill (gap #3). Two paths:
- **(a) Hand-curate** the next exemplar/rule/heuristic per component. Fast now, doesn't scale to the
  next 50 components.
- **(b) Corpus-derive** them. We already embed `component-overview`, `capability-reference`, and
  `code-example` chunks (897 points, 4/7 types — verified via Qdrant `points/count`). The canonical
  `code-example` chunk **IS** the exemplar; composition rules can be derived from overview/code chunks.
  This converts "few-shot is per-component curation" from a dead-end into a pipeline that scales with
  the corpus. **Recommended:** prototype the corpus-derived exemplar for `password-input` instead of
  hand-writing Pass G — kill two birds (fix the case + establish the expandable mechanism).
- Whichever path: define a **single "add component coverage" unit** (exemplar + composition rule + any
  heuristic, added together, documented once) so onboarding component #51 is a recipe, not archaeology.

**Files:** `src/steps/4-generate/generator.ts` (`FEWSHOT_EXEMPLARS`),
`validators/repairHints.ts`, `validators/compositionLint.ts` (`COMPOSITION_RULES`),
`validators/v2SmellDetector.ts` (`V2_SMELLS`) — these four curated maps are the "structural knowledge"
surface that needs to become expandable / corpus-derived.

---

## Reference

### Current numbers (3-run measurement, 2026-06-28 — supersedes the Pass F single run)
- Grounded `tsc`-pass **hinted: ~87%** (range 80–93% across 3 runs; the Pass F **93%/14-15** was the
  top of that range, not the central estimate). Single-shot grounded ~60–73% (13pt spread). No-context
  hinted ~47%. Reports: `artifacts/gen-eval/gen-ab-2026-06-28T05-{15,21,27}-*.json`.
- Stable failure set (grounded hinted): **1 reliable fail** `password-input` (TS2746, structural) +
  **2 coin-flips** `button-icon`, `icon-button`; the other 12/15 reliably pass.
- Held-out (n=5): **100%** single-shot and post-heal (Pass F, `artifacts/heldout-passF.log`); not yet
  re-measured under temp 0 + seed.
- Prior single-run figure (kept for provenance): Pass F report
  `artifacts/gen-eval/gen-ab-2026-06-25T22-47-22-592Z.json` (single-shot 60% / raw 67% / hinted 93%).

### Key files
| Purpose | Path |
|---|---|
| Generation service (temp/seed knob goes here) | `src/steps/4-generate/generator.ts` |
| Shippable pipeline (generate→heal→validate) | `src/steps/4-generate/pipeline.ts` |
| Objective validators (mirror for renderValidator) | `src/steps/4-generate/validators/` (`tscValidator`, `v2SmellDetector`, `compositionLint`, `repairHints`) |
| A/B harness (2×2) | `src/steps/4-generate/eval/run-ab.ts` |
| Held-out runner | `src/steps/4-generate/test-generation/run-heldout.ts` |
| Prompt sets | `test-generation/landmine-prompts.ts` (15), `heldout-prompts.ts` (5) |
| tsc sandbox (pinned `@chakra-ui/react@3.27.1`) | `gen-sandbox/tsconfig.json`, `gen-sandbox/generated.tsx` (gitignored) |
| CLI entry | `src/index.ts` (`4-generate` command) |

### Commands
```bash
# prereqs: Qdrant up (collection chakra-ui-docs, 897 pts); OPENAI_API_KEY set; DEBUG=false in .env
npx tsx src/steps/4-generate/eval/run-ab.ts                       # 2×2 A/B (~7 min)
npx tsx src/steps/4-generate/test-generation/run-heldout.ts       # held-out (~2 min)
npm run cli -- 4-generate "a green submit button"                 # product CLI (smoke)
npx tsc --noEmit                                                  # type-check the repo
```

### Models / env
- Gen: `gpt-4o` (`GEN_MODEL`); judge: `gpt-4o-mini` (`EVAL_JUDGE_MODEL`) — **not trusted on v3**,
  objective signals are the spine. Embeddings: `text-embedding-3-small` (1536d).
- `OPENAI_API_KEY`, `QDRANT_URL` (default `http://localhost:6333`), `DEBUG=false` (else OpenAI SDK
  floods stdout). Playwright already installed (crawler) — reuse it for the render-check.

### Honest caveats to carry forward
- OpenAI `seed`/temp 0 reduces but doesn't fully eliminate nondeterminism (`system_fingerprint` can
  change). Don't claim bit-exact reproducibility.
- Render-pass rate will be **≤** tsc-pass rate; treat the drop as newly-found real failures, not a
  regression.
- Few-shot/heuristics/lints are curated finite lists — they only catch what's enumerated; the
  corpus-derived path (Item 3b) is how that stops being a ceiling.
- ~87% (range 80–93%) is on *adversarial* landmines; held-out non-trap prompts are ~100%. Real-world
  reliability sits between — the `--samples k` mode is how you actually pin the two coin-flip cells.
