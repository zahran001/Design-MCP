# Pipeline Hardening — Make Generation Trustworthy Before the UI

> **Status:** PLAN / work-order — 2026-06-26 (not yet built). This is the self-contained context to harden the
> generation pipeline so the metrics are reproducible and the outputs are proven to actually *render*,
> **before** building the UI ([README_FULLSTACK.md](README_FULLSTACK.md)). Read this end-to-end before
> starting — it captures the decisions already made so you don't re-litigate them.

## Why this phase exists
The A–F correction loop reached **~93% grounded `tsc`-valid** on the 15 landmine prompts and **100%**
on 5 held-out prompts (see [GENERATION_EXPERIMENT.md](GENERATION_EXPERIMENT.md)). But two credibility
gaps block trusting that and block a smooth UI build:

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

## Item 1 — Variance control (temp 0 + seed)
**Principle: separate MEASUREMENT from PRODUCT — they want opposite things.**

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

**Measure-first step 0 (~30 min, do this first):** run the *current* harness 3× as-is to quantify how
noisy it actually is. If cells rarely flip, temp 0 alone suffices; if they flip a lot, you know you
need k-sampling for the headline. Don't guess the noise — measure it.

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

### Current numbers (Pass F, 2026-06-25 — single run, hence Item 1)
- Grounded `tsc`-pass: single-shot **60%**, raw-repair 67%, **hinted 93% (14/15)**. No-context hinted
  47%. Report: `artifacts/gen-eval/gen-ab-2026-06-25T22-47-22-592Z.json`.
- Held-out (n=5): **100%** single-shot and post-heal. Log: `artifacts/heldout-passF.log`.
- Lone grounded failure: `password-input` (TS2746, structural).

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
- ~93% is on *adversarial* landmines; held-out non-trap prompts are ~100%. Real-world reliability sits
  between — Item 1's k-sampling is how you actually pin it.
