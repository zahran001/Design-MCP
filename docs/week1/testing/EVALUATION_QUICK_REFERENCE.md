# Quality Evaluation - Quick Reference

## TL;DR

```bash
# Run extraction on 10-20 components
npm run cli -- 0-extract-docs -m 20

# Check quality
npm run quality:smoke

# If PASS → Proceed to embeddings
# If FAIL → Review and tune extractors
```

## Pass/Fail Criteria

| Metric | Threshold | Your Result | Status |
|--------|-----------|-------------|--------|
| Schema validation | ≥95% | 100% | ✅ |
| Description coverage | ≥80% | 100% | ✅ |
| Code examples coverage | ≥60% | 50% | ⚠️ Need more data |

**Verdict:** Extract more components (currently only 2 files). Re-test with 20+ components.

## Commands Reference

```bash
# Extraction
npm run cli -- 0-extract-docs -m 20           # Extract 20 components

# Quality checks
npm run quality:smoke                         # Automated metrics (30 sec)
npm run quality:samples                       # View 3 random samples
npm run quality:all                           # Both smoke + samples

# Custom sample count
npx tsx src/steps/0-extract-docs/sample-viewer.ts 5  # View 5 samples
```

## Manual Review Checklist (2 min per sample)

For each sample in `quality:samples` output:

1. ✅ **Description clear?** (understand without webpage context)
2. ✅ **Code executable?** (copy-paste ready)
3. ✅ **Related components make sense?** (actually used together)
4. ✅ **Answers "how to use X"?** (practical guidance)

**Pass if:** 2+ out of 3 samples check all boxes

## Quick Fixes

### Low Code Coverage (<60%)
**Fix:** Lower composition score in [extractors.ts:399](../src/steps/0-extract-docs/extractors.ts#L399)
```typescript
// Change from:
if (score < 5) {
// To:
if (score < 3) {
```

### Missing Descriptions (<80%)
**Fix:** Improve fallback in [extractors.ts:466-481](../src/steps/0-extract-docs/extractors.ts#L466-L481)

### Schema Errors (<95%)
**Fix:** Check error details in smoke test output, review schema

## What Actually Matters for RAG Quality?

### Critical (Must Have) ⚠️
1. Code examples are **executable** (copy-paste works)
2. Descriptions are **self-contained** (no webpage context needed)
3. No garbage data (install commands filtered out)

### Nice to Have ✨
4. Section context for code
5. Related components detected
6. High composition scores (≥5)

## Decision Tree

```
Extract 10-20 components
         ↓
   Run quality:smoke
         ↓
    PASS or FAIL?
    ↓           ↓
  PASS:       FAIL:
  Manual      Check which
  review 3    threshold failed
  samples     ↓
    ↓         Apply quick fix
  2+ pass?    ↓
    ↓         Re-run extraction
  YES: ✅     ↓
  Ready for   Re-test
  embeddings
    ↓
  NO: ⚠️
  Tune
  extractors
```

## Reality Check

**Your current status:**
- ✅ 100% valid schema
- ✅ 100% have descriptions
- ⚠️ 50% have code (only 2 files, 1 is overview page)

**Action:** Extract 20 components → Re-test → Likely ready

## Next Steps After Passing

1. Commit extraction logic
2. Scale to 50-100 components
3. Proceed to Week 2 (embeddings)

---

**Remember:** 70% quality with 100 components > 95% quality with 10 components for RAG.
