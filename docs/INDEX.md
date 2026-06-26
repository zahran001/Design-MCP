# docs/ Index

> **Status:** 2026-06-26 — entry point + classification for `docs/`.

This folder is mostly a **historical/process archive** (POCs, design docs, phase-complete reports,
test logs). Only a few files are living references. This index is the one place that says which is
which, so a stale snapshot is never mistaken for current truth.

**Classification key**
- 🟢 **ACTIVE** — living reference, kept reasonably current.
- 🗄️ **HISTORICAL** — point-in-time snapshot. Useful for *why a decision was made*, but **may
  contradict the current state**. Do **not** trust it for current facts (counts, status, file paths).

**For current facts, trust the root docs, not anything here:**
- Overall status / how to run → [`../README.md`](../README.md), [`../CLAUDE.md`](../CLAUDE.md)
- Step-4 generation (the A–F loop, metrics) → [`../GENERATION_EXPERIMENT.md`](../GENERATION_EXPERIMENT.md)
- Retrieval eval → [`../EVALUATION_STRATEGY.md`](../EVALUATION_STRATEGY.md)
- Next phases → [`../README_HARDENING.md`](../README_HARDENING.md), [`../README_FULLSTACK.md`](../README_FULLSTACK.md)

---

## 🟢 ACTIVE (living references)
| Doc | What it is |
|---|---|
| [CHUNK_TYPE_STRATEGY.md](CHUNK_TYPE_STRATEGY.md) | ROI analysis of the 7 chunk types — which to implement and why. Referenced by `CLAUDE.md`. |
| [NORMALIZATION_TECHNICAL_GUIDE.md](NORMALIZATION_TECHNICAL_GUIDE.md) | Step-1 internals (transformers/inference/config). Reference for *mechanism*. ⚠️ its own status header predates PropReferenceChunk — use root docs for current chunk counts. |
| [NORMALIZATION_USAGE_GUIDE.md](NORMALIZATION_USAGE_GUIDE.md) | Step-1 usage, design decisions, testing. Same caveat as above. |

## 🗄️ HISTORICAL (point-in-time — don't trust for current facts)
Grouped by folder; filenames are self-describing. Listed so they're tracked, not so they're maintained.

| Folder | ~files | What it captures | Current equivalent |
|---|---|---|---|
| [archive/](archive/) | 4 | Early project plan/review, the original retrieval test report, vector-DB POC guide. | README / EVALUATION_STRATEGY |
| [week1/documentation/](week1/documentation/) | 6 | Week-1 extraction implementation notes, props extraction, code-block exploration, changelog. | README §Step 0 |
| [week1/testing/](week1/testing/) | 2 | Week-1 quality/eval quick references. | EVALUATION_STRATEGY |
| [week2/Phase1/](week2/Phase1/) | 5 | Normalization POC — gap analysis, decisions, phase-1 complete/implementation. | NORMALIZATION guides (active) |
| [week2/Phase2/PropReferenceChunk-design/](week2/Phase2/PropReferenceChunk-design/) | 5 (+2 helper) | Design docs for the prop-reference chunk. | NORMALIZATION_TECHNICAL_GUIDE |
| [week2/Phase2/VectorDB-design/](week2/Phase2/VectorDB-design/) | 4 | Vector-DB POC design / start-here / logging demo. | README §Step 2 |
| [week2/Phase2/restructure_embedder/](week2/Phase2/restructure_embedder/) | 10 (+2 helper) | Embedder restructure — payload redesign, metadata anchors, test plan/results, checklists. | `src/steps/2-embed/` + README §Step 2 |
| [week2/Refactoring/](week2/Refactoring/) | 7 | Week-2 refactoring guides, phase-complete reports, manual-testing instructions, progress logs. | current code + GENERATION_EXPERIMENT |

---

## Maintenance note
This is **classification, not a maintenance burden**: HISTORICAL docs are intentionally frozen — don't
update them to match the present. If a `docs/` file becomes genuinely dead, move it under `archive/`.
When a new *living* reference is added to `docs/`, list it in the ACTIVE table above and give it a
`Status:` header.
