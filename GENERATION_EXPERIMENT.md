# Step 4 — Spec-Driven Generation: Experiment & Correction Loop

> **Status:** Phase 4a (thin slice) ✅ verified. Phase 4b A/B harness ✅ built and run — produced a
> sensational baseline (below). Now executing a two-pass correction loop: **Pass A** (fix the eval
> confounders / metric inversion) in the current session, **Pass B** (retrieval mixing to fix
> under-composition) in a **new session** — this doc is the handoff for it.
> **Branch:** `week2_generation` (off `week2_chunk_types`).

---

## 1. Goal

Close the pipeline loop: natural-language query → retrieve real Chakra v3 doc chunks → ground an LLM
in that context → emit one self-contained TSX component. The product is **spec-driven generation**;
retrieval quality only matters insofar as it makes generation correct. The experiment tests one
claim:

> **When the compiler is blind to API drift, the retrieval context is the only line of defense
> ensuring design-system compliance.**

This is sharp for Chakra because **v3 was a major breaking change from v2** (`colorScheme` →
`colorPalette`, `isLoading` → `loading`, monolithic `<Checkbox>` → composed `Checkbox.Root/.Control/
.Label`, `FormControl` → `Field.Root`, `NumberInputField` → `NumberInput.Input`, `spacing` → `gap`,
`leftIcon` → icon-as-child, …). A v2-trained model emits the old API unless grounded in v3 docs.

---

## 2. The A/B experiment

Same model (`gpt-4o`), same 15 v3-"landmine" prompts, **the only difference is the retrieved
context**:
- **grounded:** retrieve top-8 chunks and put them in the prompt.
- **no-context:** identical prompt minus the docs → relies on the model's own (v2-heavy) memory.

The system prompt is deliberately **generic** ("target Chakra v3") and does **not** reveal the
specific renames — otherwise we'd hand the ungrounded arm the answers. So the A/B isolates
retrieval's contribution.

**Metric hierarchy (this is the key design — objective diagnostics backstop the headline):**
- **Headline (semantic):** LLM-judge satisfaction, 0/1/2 ("does it satisfy the request with correct,
  current v3 API"). ⚠️ See §4 — this metric **inverted** and is currently untrustworthy.
- **Diagnostic (objective):** `tsc`-validity against real Chakra v3 types, and a **v2-smell** lint
  (prop-level v2 drift the permissive v3 types let `tsc` swallow).

---

## 3. BASELINE RESULTS — metrics tracker

> **This table is the source of truth for comparing improvements. Update the "After Pass A" and
> "After Pass B" rows as each pass completes.** (Baseline report:
> `artifacts/gen-eval/gen-ab-2026-06-23T18-43-04-438Z.json`, gen=gpt-4o, judge=gpt-4o-mini, n=15.)

| Run | judge satisfaction | tsc-pass | **v2-smell rate** | notes |
|---|---|---|---|---|
| **Baseline — no-context** | 47% | 13% | **87%** (24 total) | model's memory; v2-riddled |
| **Baseline — grounded** | 20% ⚠️ | 47% | **33%** (8 total) | grounded in retrieved v3 docs |
| **Baseline Δ (grounded − no-ctx)** | **−27%** ⚠️ | **+33 pts** | **−53 pts** | objective metrics confirm thesis; judge inverted |
| After Pass A — no-context | _tbd_ | _tbd_ | _tbd_ | + import-rule, completeness lint, grounded judge |
| After Pass A — grounded | _tbd_ | _tbd_ | _tbd_ | |
| After Pass B — grounded | _tbd_ | _tbd_ | _tbd_ | + retrieval mixing |

Headline takeaway: **grounding cut deprecated-API usage by 53 points and tripled type-validity.**
Add a **composition-completeness** column in Pass A.

---

## 4. The three issues exposed (what Pass A/B fix)

### Issue 1 — Judge inversion (eval is lying) → fixed in Pass A
`gpt-4o-mini` as judge is **systematically inverted on Chakra v3**: its v2-dominant training makes it
believe the correct v3 composition is "outdated v2." Evidence (it rated *correct v3* lower):
- **field-email (grounded):** correct `Field.Root/.Label/.HelperText`, tsc-pass, 0 smells → judge
  **1**, reason *"uses outdated v2 API components like Field.Root, Field.Label…"*.
- **checkbox-disabled (grounded):** complete `Checkbox.Root/.HiddenInput/.Control/.Label`, tsc-pass,
  0 smells → judge **1** ("outdated v2"); the v2 monolithic + `isDisabled` version → judge **2**
  ("correct Chakra v3 API"). Fully backwards.
- **number-input:** `NumberInput.Root` (v3) → **1** "outdated"; `NumberInputField` (v2) → **2** "current".

**Meta-finding (the deeper result):** you cannot evaluate API-drift compliance with a model that
shares the drift bias. Objective ground-truth (compiler + curated spec lints) is the only reliable
eval — the thesis applied recursively to evaluation. The objective diagnostics *caught the headline
lying*, which is exactly why the metric hierarchy was designed this way.

### Issue 2 — Under-composition (hollow `.Root`) → fixed in Pass B
Grounded generation uses the right v3 composition shells but sometimes doesn't fully assemble them
(e.g. `NumberInput.Root` missing its required `.Input`/`.Control` → tsc-fail; a thin `Checkbox.Root`).
Root cause: top-8 retrieval is dominated by **prop-reference** chunks (flat attribute lists) — the
model learns valid props but gets **no structural blueprint** for how subcomponents nest. The
**code-example** chunks ARE the blueprints; they need a guaranteed slot in the context window.

### Issue 3 — Sandbox/prompt confounders (smaller than feared) → partly fixed in Pass A
Investigated empirically: of 8 grounded tsc-failures, **none import `react-icons`** (so installing it
would not help). The real confounders:
- **2 cases** import a docs-internal helper path `@/components/ui/password-input` (copied from a
  retrieved snippet; not a real package) → fixed by a **generation prompt import-rule**.
- **6 cases** are **genuine** quality errors (incomplete composition, an icon referenced but never
  imported) → these are real, and Pass B (retrieval mixing) is their actual fix.
So the +33pt tsc win is **more legitimate than feared** — the cap is mostly real quality, not env.

---

## 5. The fix — two passes

### Pass A — clean baseline (CURRENT session)
Make the metrics trustworthy *before* tuning generation. One re-run of the A/B.
1. **Generation import-rule.** In `generator.ts` `SYSTEM_PROMPT`: "Import only from `@chakra-ui/react`
   and `react`. Never import local/docs helpers (`@/components/ui/*`, `compositions/*`, etc.)." Kills
   the only real tsc env-confounder.
2. **Composition-completeness lint (the headline upgrade — objective, on-thesis).** New
   `src/steps/4-generate/validators/compositionLint.ts`: a curated map of composed components → their
   required parts, e.g. `Checkbox.Root → [Control, Label]`, `NumberInput.Root → [Input, Control]`,
   `Field.Root → [Label]`, `PinInput.Root → [Input]`, `Editable.Root → [Preview, Input]`,
   `Fieldset.Root → [Legend|Content]`. Detect each `X.Root` and flag missing required siblings.
   Measures under-composition **without trusting any model**. Add it to the harness as a 4th signal
   + a "completeness rate" column.
3. **Grounded judge (secondary).** Feed the judge the SAME retrieved context the generator saw so it
   stops penalizing correct v3; narrow its role to **intent satisfaction** (objective metrics own
   v3-correctness now). Watch for it degrading into a "matches-the-context" rubber stamp — keep
   tsc+smell+completeness as the cross-check.
4. **Re-run** `run-ab.ts`; fill the "After Pass A" rows in §3.

### Pass B — retrieval mixing (NEW session — see §6 handoff)
Fix under-composition by guaranteeing a structural blueprint in the context window. Implement a
**reserved-slot context strategy** in `GenerationService`:

```
┌─────────────────┬───────────────────┬──────────────────┐
│ 1 Overview Chunk│ 1–2 Code Examples │ Remaining budget │
│  (top-level     │  (HOW subcomponents│  (prop-reference │
│   structure)    │   nest — blueprint)│   / capability)  │
└─────────────────┴───────────────────┴──────────────────┘
```
Algorithm: (1) initial top-k to find the **dominant `componentName`**; (2) explicitly fetch that
component's `component-overview` + its 1–2 highest-score `code-example` chunks; (3) fill the rest with
the top `prop-reference`/`capability-reference`. Re-run the A/B and target tsc-pass + completeness
toward ~90%. Update the "After Pass B" rows.

---

## 6. Handoff for Pass B (read this in the new session)

### Where everything lives (branch `week2_generation`)
- **Generation core:** `src/steps/4-generate/generator.ts` — `GenerationService.generate(query,
  {k, useContext})`. `renderContext()` turns a chunk payload into prompt text per chunk type.
  **This is the file Pass B edits** (the reserved-slot mixing goes here / a helper it calls).
- **Validators:** `src/steps/4-generate/validators/tscValidator.ts` (runs `npx tsc -p
  gen-sandbox/tsconfig.json` on the written file), `v2SmellDetector.ts` (`V2_SMELLS` list +
  `detectV2Smells`). Pass A adds `compositionLint.ts` here.
- **Judge:** `src/steps/4-generate/eval/generationJudge.ts` (`GenerationJudge`, model = `getJudgeModel()`).
- **A/B harness:** `src/steps/4-generate/eval/run-ab.ts` — `evaluate()` runs generate→tsc→smell→judge
  per (prompt, arm); aggregates + writes report to `artifacts/gen-eval/`.
- **Prompts:** `src/steps/4-generate/test-generation/landmine-prompts.ts` (15; each has `risks` =
  v2-smell ids it baits). All use components that ARE in the embedded corpus.
- **Spike / self-test:** `run-spike.ts` (4a manual inspection), `validator-selftest.ts` (proves tsc
  catches structure, is blind to prop-level — the finding that motivated the v2-smell lint).
- **Sandbox:** `gen-sandbox/tsconfig.json` (tracked; jsx `react-jsx`, `moduleResolution: Bundler`,
  `skipLibCheck`, `strict:false`). `gen-sandbox/generated.tsx` is the temp file the validator writes
  (gitignored). Pinned dev dep **`@chakra-ui/react@3.27.1`** (matches the crawled docs `version`).

### How to run
```bash
# prereqs: Qdrant up (collection chakra-ui-docs ~897 pts, all 4 chunk types embedded),
#          OPENAI_API_KEY set, DEBUG=false in .env (avoid OpenAI SDK firehose)
npx tsx src/steps/4-generate/eval/run-ab.ts            # the A/B (gen gpt-4o, judge gpt-4o-mini)
npx tsx src/steps/4-generate/test-generation/run-spike.ts        # quick manual look
npx tsx src/steps/4-generate/test-generation/validator-selftest.ts
```
Models via env: `GEN_MODEL` (default `gpt-4o`), `EVAL_JUDGE_MODEL` (default `gpt-4o-mini`).

### Gotchas
- **`RetrievalService.searchDetailed(query, k)` has NO payload filter.** Pass B's reserved slots
  (by `componentName` + `chunkType`) will likely need a **filtered search** — add a Qdrant
  payload-filter variant to `VectorStoreService.search` / `RetrievalService` (Qdrant supports
  `filter: { must: [{ key, match }] }`). Don't build a parallel retrieval path beyond that.
- **Corpus = the embedded 50 components** (Button, Checkbox, Checkbox-Card, Input, Field, Fieldset,
  Number-Input, Pin-Input, Password-Input, Editable, Stack, Box, Heading, Flex, Grid, Icon-Button,
  Close-Button, File-Upload, Color-Picker, …). Interactive widgets like Menu/Dialog/Select/Tabs are
  in `artifacts/raw-json-phase3-extra/` and **NOT embedded** — keep new prompts to embedded comps.
- `tsc` runs ~3–5s per call (npx spawn); 30 calls per A/B ≈ a couple minutes. The validator uses
  `shell:true` (a `DEP0190` warning prints — harmless).
- Keep the Pass-A generation **import-rule** in the system prompt.
- Re-embedding is only needed if chunks change — Pass B changes retrieval/prompting, not chunks, so
  **no re-embed required**.

### Related docs
- `EVALUATION_STRATEGY.md` — the retrieval-eval roadmap (Phases 1–3, the LLM-judge harness this
  reuses patterns from). `docs/CHUNK_TYPE_STRATEGY.md` — the 7 chunk types.
