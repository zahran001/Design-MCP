# Step 4 — Spec-Driven Generation: Experiment & Correction Loop

> **Status:** Phase 4a (thin slice) ✅ verified. Phase 4b A/B harness ✅ built and run. Correction
> loop: **Pass A** ✅ (fixed eval confounders / judge inversion), **Pass B** ✅ (reserved-slot retrieval
> mixing; satisfaction Δ +20%→+27%, tsc held 53%), **Pass C** ✅ (tsc self-correction — **negative
> result**: compiler-feedback repair failed because TS's JSX-prop errors don't name the offending
> prop), **Pass D** ✅ (**smell-guided repair, run as a 2×2**: naming the prop lifted grounded tsc
> **53%→73%** and no-context **20%→53%**). Key result: **prop-rename hints and structural retrieval are
> separable** — hints lift both arms, retrieval's residual **+20pt after both get the cheat sheet is
> structural composition** a rename map can't encode. The remaining ~27pt is two named non-rename
> classes (icon-as-child, string-token coercion) + a few composition gaps. **Pass E** ✅ added two
> narrow heuristic hints for those classes — **both predicted cells flipped** (`icon-button`,
> `number-input`), grounded hinted **73%→80%**. The residual is now a small, *named* **structural**
> set (`field-invalid` ecosystem fallback, `password-input` `InputGroup` composition) — the clean
> hand-off to grounded few-shot. **Branch:** `week2_generation`.

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

| Run | judge satisfaction | tsc-pass | **v2-smell rate** | complete% | notes |
|---|---|---|---|---|---|
| **Baseline — no-context** | 47% ⚠️ | 13% | **87%** (24) | — | model's memory; v2-riddled. judge INVERTED |
| **Baseline — grounded** | 20% ⚠️ | 47% | **33%** (8) | — | grounded; judge wrongly rated correct v3 low |
| **Baseline Δ** | **−27%** ⚠️ | **+33 pts** | **−53 pts** | — | objective metrics confirm thesis; judge lying |
| **Pass A — no-context** | 0% | 13% | **87%** (25) | 100% | grounded judge now correctly rejects all v2 |
| **Pass A — grounded** | 20% | 53% | **47%** (15) | 100% | + import-rule + grounded judge + completeness lint |
| **Pass A Δ** | **+20%** ✅ | **+40 pts** | **−40 pts** | +0 | **judge un-inverted (−27%→+20%)**; objective wins hold |
| **Pass B — no-context** | 0% | 13% | **87%** (22) | 100% | unchanged control arm |
| **Pass B — grounded** | 27% | 53% | **40%** (14) | 100% | + reserved-slot context mixing (overview+code-example blueprint) |
| **Pass B Δ** | **+27%** ✅ | **+40 pts** | **−47 pts** | +0 | satisfaction lifted (Δ +20%→+27%); tsc cap is now **non-composition** |
| **Pass C — no-context** | 0% | 13% → **20%** | **87%** (25) | 100% | + tsc self-correction loop (cap 2). 25 repair iters → **1** fix (number-input) |
| **Pass C — grounded** | 27% | 53% → **53%** | **40%** (8) | 100% | self-correction recovered **0** of 7 fails in 14 iters — see §3 Pass C notes |
| **Pass C Δ** | **+27%** ✅ | single **+40** / repaired **+33** | **−47 pts** | +0 | **self-heal failed**; Δ(repaired) *shrank* (only fix was in the control arm) |
| **Pass D — no-context** | 7% | 13% → 20% → **53%** | **87%** (23) | 100% | raw→**hinted** repair; cheat sheet heals flat renames, **not** structure |
| **Pass D — grounded** | 27% | 47% → 53% → **73%** | **40%** (8) | 100% | + smell-guided hints (name the prop); **+20pt over raw** |
| **Pass D Δ** | **+20%** | tsc raw **+33** / **hinted +20** | **−47 pts** | +0 | hinted Δ *compresses* (cheat sheet lifts weak arm more) — retrieval's residual **+20pt is STRUCTURAL** |
| **Pass E — no-context** | 0% | 13% → 20% → **53%** | **87%** (25) | 100% | unchanged (the two new rules target grounded residuals) |
| **Pass E — grounded** | 33% | 47% → 53% → **80%** | **40%** (8) | 100% | + icon-as-child & string-coercion hints; **both predicted cells flipped** |
| **Pass E Δ** | **+33%** | tsc raw **+33** / **hinted +27** | **−47 pts** | +0 | grounded hinted 73%→80%; residual is now genuinely **structural** (few-shot territory) |

> **Pass D 2×2 (tsc-pass, generation arm × repair mode)** — report
> `gen-ab-2026-06-25T18-03-56-870Z.json`. (Single-shot grounded 47% vs the 53%
> of Passes B/C is generation variance at temp 0.2; the *contrasts within this
> run* are the robust signal.)
>
> | | single-shot | raw-repair | **hinted-repair** |
> |---|---|---|---|
> | **grounded** | 47% | 53% | **73%** |
> | **no-context** | 13% | 20% | **53%** |
>
> - **Hint effect \| grounded:** +20pt (53→73). **Hint effect \| no-context:** **+33pt** (20→53) — the single biggest lift in the experiment.
> - **Retrieval residual *after both get hints*:** 73−53 = **+20pt**, and it is **structural** (composed components a rename map can't encode).
> - **Pure thesis (raw cells) preserved:** +33pt — directly comparable to Pass C.

Headline: **grounding cut deprecated-API usage by ~40–53 pts and ~tripled–quadrupled type-validity,
Pass A flipped the judge from −27% to +20% by grounding it in the retrieved v3 reference, and Pass B's
reserved-slot blueprint pushed satisfaction Δ to +27% and v2-smell Δ to −47 pts — while exposing that
the tsc ceiling (53%) is a generation-quality problem, not a retrieval one. Pass C then tested the
"obvious" fix (a tsc self-correction loop) and it FAILED (grounded 53%→53%): TypeScript's coarse
JSX-prop errors don't name the bad prop, so compiler-feedback repair can't localize it. Pass D fixed
that by feeding smell-guided hints that NAME the prop — grounded tsc 53%→73%, no-context 20%→53% — and,
run as a 2×2, proved prop-rename hints and structural retrieval are separable: retrieval's residual
+20pt advantage (even after both arms get the cheat sheet) is structural composition the rename map
can't encode. Pass E added two narrow heuristic hints (icon-as-child, string-token coercion) and both
pre-registered target cells flipped, taking grounded hinted to ~80% and leaving only a small, named
structural residual for grounded few-shot.**

### Pass A notes (2026-06-25)
- **Inversion fixed (primary goal).** Satisfaction Δ flipped −27% → **+20%**. Grounding the judge in
  the SAME retrieved v3 reference made it recognize `Field.Root` / `NumberInput.Root` as correct v3
  (verified in the report reasons). No-context satisfaction fell to 0% — the judge now correctly
  rejects the v2-riddled ungrounded output.
- **Objective wins hold:** tsc-pass +40 pts (grounded 53% vs 13%), v2-smell −40 pts.
- **Caveats (single-run noise + residual judge error):**
  - Grounded v2-smell *rose* vs baseline (33%→47%) — this is **generation variance** (e.g. this run's
    grounded `field-invalid` slipped to 6 smells; baseline had 0). The **Δ vs no-context is the robust
    signal**, not the grounded absolute. Future rigor: average ≥3 generations or temperature 0.
  - **Completeness lint read 100%/100% (inc=0 everywhere)** — the prompt's "assemble all required
    parts" nudge largely resolved hollow roots (e.g. grounded `number-input` went tsc-ERR→ok), and the
    no-context arm uses v2 *monolithic* components (no `.Root`, so the lint is N/A). So the lint did not
    discriminate this run; it stands as a **regression guard**, and **Pass B (retrieval mixing) is the
    real lever for the remaining grounded tsc failures**.
  - The grounded judge is better but still imperfect (e.g. it called `number-input` "incomplete" while
    the objective lint+tsc say it's fine). **Objective signals remain the trustworthy spine.**

### Pass B notes (2026-06-25) — reserved-slot retrieval mixing
**What shipped.** A reserved-slot context strategy in `generator.ts`
(`assembleReservedSlots`): an initial top-k finds the **dominant `componentName`**, then we explicitly
fetch that component's `component-overview` (top-level structure) + its 1–2 best `code-example`
chunks (HOW subcomponents nest — the structural blueprint), and fill the remaining budget with the
top-k prop/capability references. Backed by a Qdrant **payload filter** added to
`VectorStoreService.search` + a vector-reuse `RetrievalService.searchByVector` (one query embedding
reused across all filtered fetches — no re-embed). Verified the slots fire as designed: e.g. *"a
number input…"* → `[1] Number Input overview, [2-3] Number Input code-examples, [4-8] prop-refs`
(report: `gen-ab-2026-06-25T16-54-49-923Z.json`).

**Result — the blueprint helped the headline, not the compiler.**
- **Satisfaction rose** 20%→**27%** grounded; the Δ vs no-context improved **+20%→+27%**. The richer
  blueprint also grounds the judge's reference better.
- **v2-smell fell** 47%→**40%** (15→14); Δ widened to **−47 pts**.
- **tsc-pass held flat at 53%** — short of the ~90% target. **This is the honest, important result.**

**Why tsc didn't move (evidence, not excuse).** Reserved slots were designed to fix
**under-composition** — but Pass A's completeness nudge had *already* driven the composition lint to
**0 missing parts (100% complete)**. With no hollow `.Root` left to repair, the blueprint had little
tsc headroom to recover. The 7 remaining grounded tsc-failures are a **different, non-composition
class** (confirmed by reading each):
  - **icon-as-prop** — `IconButton icon={<…/>}` / `Button leftIcon` (`button-icon`, `icon-button`):
    v3 takes the icon as a **child**; `tsc` *does* catch this prop (`TS2322` on `IconButtonProps`).
  - **stubborn v2 fallback** — `field-invalid` emitted full `FormControl`/`FormLabel`/react-hook-form,
    **ignoring the v3 context entirely** (5 tsc errors, 7 smells). Mixing better context can't *force*
    the model to use it; the v2 prior occasionally wins outright.
  - **minor prop-type** — `number-input` is **correctly composed** (`NumberInput.Root/.Control/.Input`)
    and fails on a single `defaultValue={0}` numeric-vs-string (`TS2322`).

**Conclusion (the result that matters).** Reserved-slot mixing was the *right* fix for
under-composition, but Pass A had already closed that gap — so its marginal tsc lift was small while
it still delivered a real **semantic** win (+7pt satisfaction, −7pt smell). The remaining tsc cap is
**generation-adherence and prop-level correctness, a generation lever — not a retrieval lever.** The
next move is on the generator/prompt side (explicit icon-as-child + prop-type rules, few-shot from the
retrieved code-example, or temperature-0 / ≥3-sample averaging to separate signal from variance), not
more retrieval tuning. Objective signals (tsc + smell + completeness) again kept the story honest:
they show *where* grounding's ceiling actually is.

### Pass C notes (2026-06-25) — tsc self-correction loop (the plan was wrong, and that's the finding)
**What shipped.** A bounded compiler-feedback repair loop (`GenerationService.repair`, cap 2 iters,
temp 0): on a single-shot `tsc` failure, feed the exact `error TS####` lines back to the model with
the arm's OWN context (grounded docs / nothing), and re-check. The harness now reports BOTH
single-shot tsc-pass (retrieval thesis, unchanged) and post-repair tsc-pass (product). Report:
`gen-ab-2026-06-25T17-21-57-766Z.json`.

**Prediction vs reality.** The plan claimed self-correction "typically repairs almost all minor type
mismatches… pushing tsc-pass toward 90%." **It did not.**
- **grounded: 53% → 53%.** Zero of 7 failures recovered, across **14** repair attempts.
- **no-context: 13% → 20%.** Exactly **one** fix (`number-input`) in **25** attempts.
- The retrieval thesis still fully reproduced single-shot (**Δ +40 pts**), but **Δ(repaired) *shrank* to
  +33 pts** — because the one successful repair landed in the *control* arm, not the grounded one.

**Root cause (the real result): the compiler is a great DETECTOR but a poor TEACHER.** I read every
healed-but-still-failing component. After 2 iters with the errors fed back, `button-loading` still
carried `isLoading`/`colorScheme`, `stack-gap` still `spacing`, `icon-button` still `icon={…}`. Why:
TypeScript's JSX-prop error is **coarse** — a wrong attribute yields one aggregate line,
`TS2322: Type '{ …the entire props object… }' is not assignable to ButtonProps`, that **never names
the offending prop**. Handed that, the model can't localize the fix and returns near-identical code.
Even the one *precise* diagnostic — `number-input`'s `Type 'number' is not assignable to type
'string'` (`defaultValue={0}`) — was left unfixed in the grounded arm (and only fixed once, in
no-context). So error-feedback alone is unreliable even when the message is clear.

**The deeper meta-finding (consistent with Pass A/B).** To make self-correction work cleanly you'd
have to *translate* the coarse diagnostic into an actionable instruction — "drop `isLoading`, v3 uses
`loading`; `colorScheme`→`colorPalette`; `spacing`→`gap`." But that **is** the v2→v3 rename map, which
is exactly the §5.1 contamination we ruled out (it leaks the answer into the shared prompt and
collapses the Δ). **So the clean-experiment ceiling on compiler-feedback self-correction is set by the
compiler's error ergonomics, not by the model's willingness to retry.** The path to ~90% is *not* more
compiler loops; it needs the rename knowledge injected where it doesn't break the experiment:
**grounded-only few-shot (§5.2)** — a flawless v3 exemplar for the dominant component, which carries
the correct prop names structurally without a global prompt edict — or a **smell-guided repair hint**
(pair each coarse `TS2322` with the matched `V2_SMELLS` entry to name the prop for the model). Pass C's
value was diagnostic: it proved the "free" lever isn't free, and sharpened where the real lever is.

### Pass D notes (2026-06-25) — smell-guided repair, run as a 2×2 (the payoff pass)
**Design.** Pass C said: compiler-feedback fails because the error never *names* the bad prop. Pass D
translates the coarse `TS2322` into a surgical instruction by reusing `V2_SMELLS` (which already
carries the v3 replacement per entry) — new `validators/repairHints.ts`, ~6 lines, no new knowledge.
The hint is the v2→v3 rename map, i.e. curated knowledge, so feeding it to the control would
contaminate the pure baseline (the §5.1 risk). To avoid the Option-1/Option-2 false choice, the hint
is run as an **orthogonal repair-mode factor**: from the SAME single-shot component, the harness runs
**two** repair loops — `raw` (tsc errors only, = Pass C) and `hinted` (errors + migration hints) — so
generation variance is controlled out and the raw cells preserve the comparable baseline.

**Result — the hint works, and confirms the Pass C diagnosis.** Naming the prop unlocked repair:
grounded **53%→73%** (+20pt over raw), no-context **20%→53%** (+33pt — the biggest single lift in the
whole experiment). The compiler is the detector; the smell map is the **teacher** it lacked.

**The decomposition the 2×2 buys (this is the real finding):**
- **The cheat sheet and retrieval are separable and complementary.** Hints own **flat prop renames**
  (they lift *both* arms); retrieval owns **structural composition** (the residual). After *both* arms
  get the cheat sheet, grounded still leads by **+20pt (73 vs 53)** — and reading the still-failing
  cells shows that gap is *structural*: no-context+hint dropped `isChecked` but kept a **monolithic
  `<Checkbox>`** (nonexistent in v3 — needs `Checkbox.Root/.Control/.HiddenInput`); a rename map can't
  supply that, the retrieved blueprint can.
- **Why keeping the raw baseline mattered (the 2×2 vindicated over Option 1).** Δ(hinted) **compressed
  to +20%** from Δ(raw) **+33%** — *not* because retrieval got less valuable, but because the cheat
  sheet helps the weaker (ungrounded) arm more. Had we run Option 1 (hint-only, both arms) we'd have
  seen just the compressed +20% and risked concluding "retrieval matters less now." The raw cells prove
  retrieval's contribution is unchanged; the hint adds an orthogonal, arm-asymmetric lift.

**Prediction check (calibration, on the record).** Pre-registered: hints fix the rename class but miss
`icon-button` (`icon={…}` is icon-as-child, **not** a smell) and `number-input` (`defaultValue={0}` is
a value-type, not a rename). **Both confirmed still ERR** after hinting. Estimate was grounded
~75–85%; **actual 73%**, slightly under — because two *smell-class* cases needed **structure, not just
a rename**: `password-input` (hint named `InputRightAddon→InputGroup endElement` but the model emitted
v2 `InputRightElement` — structural pattern under-specified) and a variance-driven non-smell
`field-invalid`. Honest takeaway: a rename hint heals a prop swap but **not** a composition change.

**Where this leaves the pipeline.** Grounded generation: 47% single-shot → **73%** with retrieval +
reserved-slot blueprint + smell-guided repair, every gain attributable to objective `tsc` (no judge
trust required). The last ~27pt is two named, non-rename classes — **icon-as-child** and
**string-token coercion** — plus a couple of **structural** composition gaps. Closing them is either
(a) two more curated rules in the hint/smell map (icon-as-child; numeric-literal-on-token → quote it),
or (b) the structural lever (grounded few-shot exemplar) for the composition cases — *not* more
retrieval or more generic compiler loops.

### Pass E notes (2026-06-25) — structural & typographic hints (the two named residuals)
**What shipped.** Two heuristic rules added to `repairHints.ts` for the non-rename classes Pass D
isolated, kept deliberately narrow after correcting the proposed spec:
- **icon-as-child** — matches ONLY the bare `icon={<jsx/>}` prop (IconButton). `leftIcon`/`rightIcon`
  are already `V2_SMELLS` and already work (Pass D), so they're not re-matched.
- **string-token coercion** — `value`/`defaultValue` given a numeric literal, but the hint is **gated on
  the tsc diagnostic** (`…not assignable to type 'string'`). The proposed `gap`/`spacing` targets were
  dropped: numeric tokens are VALID for those in v3 (`gap={4}` is fine), and `spacing` is already a
  rename smell — a "quote it" hint would have contradicted the correct rename. Gating means
  legitimately-numeric props (e.g. a Slider `value`) are never touched.

**Prediction check (pre-registered, judged per-cell — not the headline — because n=15 has real
generation variance).** Both targets flipped, and both are attributable:
- `icon-button` (grounded): hint ERR→**ok**, healed now `<IconButton …><SearchIcon /></IconButton>` (icon as a child).
- `number-input` (grounded): hint ERR→**ok**, healed now `defaultValue="0"` (was `{0}`).

**Aggregate.** Grounded hinted **73%→80%**. Net +1 cell, not +2, because `button-icon` regressed
ok→ERR this run — pure variance (its `colorScheme`/`leftIcon` handling is untouched code; it simply
repaired worse), which is exactly why the success criterion was the two *target* cells, not the rate.
Δ(hinted) widened to **+27%**. No-context held at 53% (the new rules fire mostly where structure
exists, i.e. the grounded arm).

**Where the pipeline truly ends (the inventory this pass buys).** Grounded generation now reaches
**~80% tsc-valid** via retrieval + reserved-slot blueprint + smell/heuristic-guided repair, every gain
attributable to objective `tsc`. The *remaining* grounded hinted failures are no longer prop-level:
`field-invalid` (the model abandons v3 for a full `FormControl`/react-hook-form ecosystem) and
`password-input` (needs v3 `InputGroup endElement` **composition**, not a rename). These are
**deep structural/integration** errors — the genuine boundary of what curated lint + retrieval can do,
and the clean hand-off to the only lever left: **grounded few-shot exemplars** (§5.2) that supply a
full structural template. The correction loop has converged: each pass removed one attributable class
(judge inversion → under-composition → compiler ergonomics → prop renames → icon/coercion), leaving a
small, *named* structural residual instead of a vague "quality gap."

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
