# Quality Evaluation Guide

## Overview

This guide explains how to evaluate the quality of extracted component documentation for RAG/embedding readiness. The evaluation process is designed to be **fast and practical** - focusing on the metrics that actually impact downstream LLM performance.

## Quick Start

```bash
# 1. Run smoke test (automated metrics)
npm run quality:smoke

# 2. View random samples (manual review)
npm run quality:samples

# 3. Run both
npm run quality:all
```

## Evaluation Tools

### 1. Smoke Test (`smoke-test.ts`)

**Purpose:** Automated pass/fail check for extraction quality

**What it checks:**
- ✅ Schema validation (≥95% must pass)
- ✅ Description coverage (≥80% should have descriptions)
- ✅ Code examples coverage (≥60% should have code examples)
- 📊 Content metrics (avg examples, description length)

**Interpreting results:**

```
🎉 PASS - Extraction quality is ready for RAG/embeddings
```
→ Proceed to embedding generation (Week 2)

```
⚠️ FAIL - Some thresholds not met
```
→ Review failed checks and adjust [extractors.ts](../src/steps/0-extract-docs/extractors.ts)

**Common failure reasons:**

| Issue | Threshold | Fix |
|-------|-----------|-----|
| Low code coverage | <60% | Lower `getCompositionScore()` threshold from 5 to 3 |
| Missing descriptions | <80% | Improve fallback description extraction |
| Schema errors | <95% | Check for malformed URLs or empty required fields |

### 2. Sample Viewer (`sample-viewer.ts`)

**Purpose:** Manual quality review with pretty-printed samples

**What it shows:**
- 📝 Component descriptions
- 💻 Code examples (with section context)
- 🔗 Related components
- ✅ Manual review checklist

**Manual review checklist:**

For each sample, verify:
- [ ] **Description is clear and self-contained** - Can you understand the component without seeing the original webpage?
- [ ] **Code examples are executable** - Can you copy-paste and expect it to work (no missing imports aside from the component itself)?
- [ ] **Related components make sense** - Are they actually used together in the examples?
- [ ] **Answers "how do I use X"** - Does the content provide practical usage guidance?

**Pass criteria:**
- If **2+ out of 3 samples** pass all checklist items → Ready for RAG
- If major issues found → Adjust extractors and re-run

### 3. Custom Sample Count

View more samples for thorough review:

```bash
# View 5 random samples
npm run quality:samples 5

# Or directly:
npx tsx src/steps/0-extract-docs/sample-viewer.ts 10
```

## Understanding Current Results

Based on your test run (2 files):

```
✅ Schema validation: 100% - Perfect
✅ Description coverage: 100% - Perfect
❌ Code examples coverage: 50% - Below threshold (60%)
```

**Analysis:**
- **Good news:** All extractions are valid and have descriptions
- **Issue:** Only 1/2 components have code examples
- **Root cause:** "Components" page is an overview/concept page (not a specific component)
- **Impact on RAG:** Low - Overview pages are still useful for context

**Recommendation:**
Run on more pages to get representative sample:

```bash
# Extract 10-20 components
npm run cli -- 0-extract-docs -m 20

# Re-run quality checks
npm run quality:all
```

## Quality Metrics Explained

### Schema Validation (Critical)
- **What:** Zod schema validation success rate
- **Threshold:** ≥95%
- **Impact on RAG:** High - Invalid data breaks embeddings pipeline

### Description Coverage (Important)
- **What:** % of components with descriptions
- **Threshold:** ≥80%
- **Impact on RAG:** Medium - Descriptions are key for semantic search

### Code Examples Coverage (Nice-to-have)
- **What:** % of components with code examples
- **Threshold:** ≥60%
- **Impact on RAG:** Medium - Code examples enable "show me how" queries
- **Note:** Some pages (concepts/overview) legitimately lack code examples

### Avg Code Examples (Informational)
- **What:** Average number of code examples per component
- **Target:** 2-5 examples per component
- **Impact on RAG:** Low - More is better, but diminishing returns after 5

### Avg Description Length (Informational)
- **What:** Average character length of descriptions
- **Target:** 100-500 characters
- **Impact on RAG:** Low - Too short (<50) or too long (>1000) can indicate extraction issues

## What Makes Extraction "Ready for RAG"?

### Critical Requirements (Must Have)
1. ✅ **Schema validation ≥95%** - Data is structurally valid
2. ✅ **Description coverage ≥80%** - Most components have semantic context
3. ✅ **No garbage data** - Installation commands, bare imports filtered out

### Quality Indicators (Nice to Have)
4. ✅ **Code examples coverage ≥60%** - Practical usage examples available
5. ✅ **Related components detected** - Cross-component queries possible
6. ✅ **Section context preserved** - Code examples have semantic labels

### Reality Check
- **Your current extraction** (based on 2 files) meets **all critical requirements** (100% valid, 100% descriptions)
- **Code coverage is low** (50%) but likely due to small sample size (only 2 files, 1 is overview page)
- **Verdict:** Extract 10-20 more components and re-test. If code coverage rises to ≥60%, you're ready.

## Iterative Improvement Workflow

### Iteration 1: Initial Extraction
```bash
npm run cli -- 0-extract-docs -m 5
npm run quality:all
```
→ Review results, identify issues

### Iteration 2: Tune Extractors
Adjust [extractors.ts](../src/steps/0-extract-docs/extractors.ts):
- Lower/raise composition score threshold
- Add/remove excluded sections
- Tweak content heuristics

```bash
npm run cli -- 0-extract-docs -m 5
npm run quality:all
```
→ Compare improvements

### Iteration 3: Scale Up
```bash
npm run cli -- 0-extract-docs -m 50
npm run quality:smoke
```
→ Final validation before embedding

## Troubleshooting

### Issue: "No JSON files found"
**Cause:** No artifacts generated yet
**Fix:** Run extraction first: `npm run cli -- 0-extract-docs -m 10`

### Issue: "Low code examples coverage"
**Cause:** Composition score threshold too strict
**Fix:** Lower threshold in [extractors.ts:399](../src/steps/0-extract-docs/extractors.ts#L399) from `5` to `3`

### Issue: "Schema validation failing"
**Cause:** Extracted data doesn't match schema
**Fix:** Check error details in smoke test output, review [RAGResultSchema.ts](../src/schemas/RAGResultSchema.ts)

### Issue: "Descriptions are too short/generic"
**Cause:** Fallback description logic too broad
**Fix:** Refine description extraction in [extractors.ts:466-481](../src/steps/0-extract-docs/extractors.ts#L466-L481)

## Next Steps After Passing Evaluation

1. ✅ **Commit current extraction logic** - Baseline is ready
2. 🔄 **Scale up extraction** - Run on 50-100 components
3. 📦 **Proceed to Week 2** - Transform & normalize for embeddings
4. 🧪 **Test with real RAG queries** - Validate end-to-end retrieval quality

## References

- **Extraction Logic:** [extractors.ts](../src/steps/0-extract-docs/extractors.ts)
- **Data Schema:** [RAGResultSchema.ts](../src/schemas/RAGResultSchema.ts)
- **Crawler:** [crawler.ts](../src/steps/0-extract-docs/crawler.ts)
- **Project Instructions:** [CLAUDE.md](../CLAUDE.md)

---

**Remember:** Perfect is the enemy of good. 70% quality extraction with 100 components beats 95% quality with 10 components for RAG performance. Focus on scale once you pass critical thresholds.
