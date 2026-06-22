# PropReferenceChunk Integration Test Plan

**Date Created:** December 29, 2025
**Objective:** Validate retrieval performance improvement by adding PropReferenceChunk to embedding dataset
**Baseline:** [RETRIEVAL_TEST_REPORT.md](RETRIEVAL_TEST_REPORT.md) (80% precision@1, property queries fail)

---

## Executive Summary

After implementing PropReferenceChunk (360 prop reference chunks added to normalize pipeline), we now have:

**Before Integration:**
- 387 CodeExampleChunks (code examples only)
- 0 PropReferenceChunks
- **Total: 387 chunks**
- Property-centric queries fail (Query 5: "button color" = 0% success)

**After Integration (Expected):**
- 387 CodeExampleChunks (maintained)
- 360 PropReferenceChunks (newly added)
- **Total: 747 chunks**
- Property-centric queries should improve significantly

---

## Test Phases

### Phase 1: Environment Setup & Data Preparation

**Goal:** Verify all systems are ready for testing

**Steps:**
```bash
# 1. Verify normalized chunks exist and include props
ls -lh artifacts/normalized/*.json | wc -l
# Expected: ~82 files (51 code example .json + 31 prop reference -props.json)

# 2. Check sample prop chunk structure
cat artifacts/normalized/Button-props.json | head -50
# Expected: Array of PropReferenceChunk objects with prop categorization

# 3. Count total chunks in normalized directory
node -e "const fs = require('fs'); const d='artifacts/normalized'; const files = fs.readdirSync(d); let count=0; files.forEach(f => { const data = JSON.parse(fs.readFileSync(\`\${d}/\${f}\`)); count += Array.isArray(data) ? data.length : 1; }); console.log('Total chunks:', count);"
# Expected: ~750 chunks (387 code + 360 props approximately)

# 4. Verify EmbeddingService and VectorStoreService are operational
npm run build
# Expected: No TypeScript errors

# 5. Start Qdrant (if using Docker)
docker-compose up -d qdrant
# Expected: Qdrant container running on port 6333

# 6. Clear previous collection (optional - for clean slate)
# You can manually delete the 'chakra-ui-docs' collection in Qdrant UI
# or the embedder will overwrite existing points
```

**Checklist:**
- [ ] All normalized files exist
- [ ] Prop chunks have correct structure (prop.category, content fields)
- [ ] TypeScript build succeeds
- [ ] Qdrant is running and accessible

---

### Phase 2: Embedding Generation with New Data

**Goal:** Generate embeddings for combined CodeExample + PropReference dataset

**Steps:**
```bash
# 1. Run embedder (this will load all normalized chunks including props)
npm run embed
# Expected output:
# - Loading normalized chunks...
# - Embedding [1] button-code-example-1-v1...
# - Embedding [2] button-prop-size-v1...  ← NEW PropReferenceChunks
# - ...
# - Success! Embedded ~750 chunks

# 2. Monitor progress
# Watch for output showing both CodeExampleChunk and PropReferenceChunk types

# 3. Verify embeddings in Qdrant
# Navigate to http://localhost:6333/dashboard (if using Docker)
# Check collection 'chakra-ui-docs' shows ~750 points
```

**Key Observations to Log:**
- [ ] Time to embed all chunks (should scale linearly, ~1-2 minutes)
- [ ] First few chunks logged (verify both code and prop chunks appearing)
- [ ] Final count matches expected (~750)
- [ ] No errors in embedding process

**What embedder currently does (from code review):**
```typescript
// Current embedding text: explanation + demonstrates tags only
const text = `${chunk.content?.explanation || ''} ${chunk.content?.demonstrates?.join(' ') || ''}`;

// For CodeExampleChunk: explanation + code tags
// For PropReferenceChunk: description + typeExplanation + usageGuidance + defaultBehavior
// (Note: propExplanationGenerator.ts generates all these fields)
```

---

### Phase 3: Baseline Comparison Testing

**Goal:** Run the same 5 test queries to measure improvement

**Test Queries (from original report):**

#### Query 1: "How do I size a button?"
```bash
npm run search -- "How do I size a button?"
```
**Expected improvement:**
- Baseline: Button (size example) at rank 1, score 0.616
- With props: Should have Button-props size chunk in top 5
- New metric: Proportion of results that are PropReferenceChunk

**Query 2: "button variants"**
```bash
npm run search -- "button variants"
```
**Expected improvement:**
- Baseline: Button (variant example) at rank 1, score 0.557
- With props: More prop-specific results
- New metric: Color/styling prop chunks appearing in results

**Query 3: "loading state"**
```bash
npm run search -- "loading state"
```
**Expected improvement:**
- Baseline: Button (loading state) at rank 1, score 0.540
- With props: loading and disabled prop chunks in top-10
- New metric: State prop disambiguation (which prop controls loading?)

#### Query 4: "button with icons"
```bash
npm run search -- "button with icons"
```
**Expected improvement:**
- Baseline: IconButton at rank 1, score 0.564
- With props: Composition props appearing (children, leftIcon, rightIcon)
- New metric: Composition intent retrieval

#### Query 5: "button color" (THE KEY FAILING QUERY)
```bash
npm run search -- "button color"
```
**Expected improvement:**
- Baseline: Color Mode (theme system) at rank 1 = FAIL
- With props: Button color-related prop chunks (colorPalette, colorScheme, variant)
- **Target: Change rank 1 from Color Mode → Button color prop chunk**
- **Success metric:** Rank 1 = Button color prop, Score > 0.50

**Additional Property-Centric Queries to Test:**
```bash
npm run search -- "Button disabled prop"
npm run search -- "how to make button required"
npm run search -- "Button size options"
npm run search -- "what props does Button have"
```

**Extended Query Categories (from VECTOR_DB_POC_GUIDE.md):**

#### Category 1: Size/Variants (CodeExampleChunk strength - baseline)
```bash
npm run search -- "How do I size a button?"
npm run search -- "Show me different button variants"
npm run search -- "Make a button larger"
```
**Expected:** CodeExampleChunks rank best (baseline behavior maintained)

#### Category 2: Interaction/State (State management)
```bash
npm run search -- "Button with loading state"
npm run search -- "Disabled button example"
npm run search -- "Button click handler"
```
**Expected:** Improved with PropReferenceChunk for state props (loading, disabled)

#### Category 3: Composition (Multi-component)
```bash
npm run search -- "Button with icons"
npm run search -- "Button group layout"
```
**Expected:** Should maintain baseline performance (CodeExample handles this well)

#### Category 4: Styling/Appearance (WHERE Props Help Most)
```bash
npm run search -- "Change button color"
npm run search -- "Rounded button corners"
npm run search -- "button color"
```
**Expected:** PropReferenceChunks should significantly improve results

#### Category 5: Edge Cases (New queries enabled by PropReferenceChunk)
```bash
npm run search -- "What is Button?"
npm run search -- "What props does Button have?"
npm run search -- "Button required prop"
npm run search -- "How do I disable a button"
```
**Expected:** Minimal in baseline (no ComponentOverview yet), improved with props

---

### Phase 4: Results Analysis

**Goal:** Quantify improvement over baseline

**Metrics to Track per Query:**

| Metric | Baseline | Target | Calculation |
|--------|----------|--------|-------------|
| **Precision@1** | 80% (4/5) | 90% (5/5) | Count correct top result |
| **Precision@5** | 60% (3/5) | 80% (4/5) | Count relevant results in top-5 |
| **Avg Top Score** | 0.553 | 0.58+ | Mean of top result scores |
| **Property Query Success** | 0% (0/1) | 90%+ (9/10) | Prop-specific queries ranking props top-5 |
| **Chunk Type Distribution** | CodeOnly | Code+Props | Track % of PropReferenceChunk in results |

**Per-Query Analysis Template:**

```
Query: "[query text]"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Baseline (Old):
  Rank 1: [component] - Score [X.XXX] - [relevance]

New Test (With Props):
  Rank 1: [component] - Score [X.XXX] - [relevance]
  Rank 2: [component] - Score [X.XXX] - [chunk type]
  ...

Improvement:
  ✅ Success Metric: [Met/Not Met]
  📊 Score change: [+X.XXX] / [-X.XXX]
  🔍 Chunk types: CodeExample vs PropReference mix
```

---

### Phase 5: Detailed Result Comparison

**Sample Comparison for Query 5 (The Failing One):**

**Before (CodeExampleChunk only):**
```
Query: "button color"
Rank 1: Color Mode (theme system) - Score 0.532 - ❌ OFF-TARGET
Rank 2: Button - Score 0.462 - ⚠️ Relevant but low score
Rank 3: Color Mode - Score 0.438 - ❌ Off-target
Rank 4: Color Picker - Score 0.433 - ❌ Off-target
Rank 5: Box - Score 0.420 - ❌ Unrelated

Result: FAIL (0/5 top results directly answer "button color")
```

**Expected After (CodeExample + PropReference):**
```
Query: "button color"
Rank 1: Button-prop-colorPalette - Score 0.62+ - ✅ DIRECT ANSWER
Rank 2: Button-prop-colorScheme - Score 0.61+ - ✅ DIRECT ANSWER
Rank 3: Button-prop-variant - Score 0.59+ - ✅ RELATED
Rank 4: Button-example-variant - Score 0.57 - ✅ EXAMPLE
Rank 5: Button-example-styling - Score 0.55 - ✅ EXAMPLE

Result: PASS (4/5 top results directly answer "button color")
```

---

### Phase 6: Statistical Summary Report

**Metrics Compilation:**

Create `EMBEDDING_TEST_RESULTS.md` with:

1. **Summary Table:**
   ```
   | Metric | Baseline | New Test | Δ Change | Target |
   |--------|----------|----------|----------|--------|
   | Precision@1 | 80% | ?% | +?% | 90% |
   | Precision@5 | 60% | ?% | +?% | 80% |
   | Avg Top Score | 0.553 | 0.??? | +0.0?? | 0.58+ |
   | Property Queries | 0% | ?% | +?% | 90%+ |
   | Total Chunks Indexed | 387 | 747 | +360 | ✅ |
   ```

2. **Success Criteria Checklist:**
   - [ ] Query 1 score improvement > 0.05
   - [ ] Query 2 score improvement > 0.03
   - [ ] Query 3 score improvement > 0.03
   - [ ] Query 4 maintains score (should not regress)
   - [ ] Query 5 rank 1 = Button prop (was Color Mode)
   - [ ] New property queries (6-10) show 80%+ relevance
   - [ ] No regressions in baseline passing queries

3. **Chunk Type Analysis:**
   - Count PropReferenceChunks in top-5 per query
   - Count CodeExampleChunks in top-5 per query
   - Analyze mix (should be 60/40 prop to code ratio expected)

---

## Test Execution Steps

**Recommended order:**

```bash
# Step 1: Verify environment (Phase 1)
npm run build
docker-compose down -v  # Clean old volume
docker-compose up -d qdrant

# Step 2: Generate normalized chunks (if not done)
npm run cli -- 1-normalize

# Step 3: Generate embeddings with new data (Phase 2)
npm run embed
# Monitor output and count final chunks

# Step 4: Run 5 baseline test queries (Phase 3 - from RETRIEVAL_TEST_REPORT.md)
echo "=== BASELINE QUERIES ==="
npm run search -- "How do I size a button?"
npm run search -- "button variants"
npm run search -- "loading state"
npm run search -- "button with icons"
npm run search -- "button color"  # THE KEY ONE

# Step 5: Run extended category tests (Phase 3 extended - from VECTOR_DB_POC_GUIDE.md)
echo "=== CATEGORY 1: Size/Variants ==="
npm run search -- "Show me different button variants"
npm run search -- "Make a button larger"

echo "=== CATEGORY 2: Interaction/State ==="
npm run search -- "Button with loading state"
npm run search -- "Disabled button example"
npm run search -- "Button click handler"

echo "=== CATEGORY 3: Composition ==="
npm run search -- "Button group layout"

echo "=== CATEGORY 4: Styling/Appearance ==="
npm run search -- "Change button color"
npm run search -- "Rounded button corners"

echo "=== CATEGORY 5: Edge Cases ==="
npm run search -- "What is Button?"
npm run search -- "What props does Button have?"
npm run search -- "Button required prop"
npm run search -- "How do I disable a button"

# Step 6: Document results in EMBEDDING_TEST_RESULTS.md (Phase 4-6)
# Compare against RETRIEVAL_TEST_REPORT.md baseline
```

**Total queries:** 18 test queries (5 baseline + 13 extended categories)

---

## Key Validation Points

### Does the embedder handle PropReferenceChunk?

**Check:** The embedder reads all `.json` files in `artifacts/normalized/`

**Current code:**
```typescript
const files = fs.readdirSync(NORMALIZED_DIR).filter(f => f.endsWith('.json'));
// This includes both:
// - Button.json (CodeExampleChunks)
// - Button-props.json (PropReferenceChunks)
```

**Verification:**
- Look for output showing chunks with `prop-` prefix in chunk ID
- Example: `button-prop-size-v1`, `button-prop-disabled-v1`, etc.

### What text is embedded for PropReferenceChunk?

**Current embedding strategy (from embedder.ts line 33):**
```typescript
const text = `${chunk.content?.explanation || ''} ${chunk.content?.demonstrates?.join(' ') || ''}`;
```

**For CodeExampleChunk:** explanation + code example tags ✅
**For PropReferenceChunk:** Will embed... **NEED TO VERIFY**

**PropReferenceChunk structure (from propExplanationGenerator.ts):**
```typescript
content: {
  description: "Controls the size of the button",      // ✅ Has this
  typeExplanation: "Union of 5 string values...",      // ✅ Has this
  usageGuidance: "Use md for primary actions...",      // ✅ Has this
  defaultBehavior: "Defaults to md"                    // ✅ Has this
}
```

**Issue to Check:** Does PropReferenceChunk have `explanation` and `demonstrates` fields?

**Action:** Verify schema
```bash
cat artifacts/normalized/Button-props.json | jq '.[] | {content}' | head -20
```

---

## Expected Outcomes

### Best Case (Hypothesis)
- Query 5 ("button color") improves from ❌ FAIL → ✅ PASS
- Property-centric queries (new ones) show 80%+ relevance
- No regressions in previous 4 queries
- **Verdict:** PropReferenceChunk integration successful ✅

### Good Case
- Query 5 improves but not to ✅ PASS (e.g., rank 2-3 now has correct answer)
- Precision@5 improves 20-30%
- Property queries work for 60-70% of cases
- **Verdict:** Good improvement, room for embedding strategy optimization

### Needs Work
- Query 5 still fails (Color Mode ranks 1st)
- Property queries show minimal improvement
- Chunk count increase shows (✅ 387 → 747) but not reflected in retrieval
- **Verdict:** Embedding text strategy needs refinement (proposal: include full content not just explanation)

---

## Post-Test Decision Tree

**After Phase 6 results, decide:**

### If PropReferenceChunk helps (Δ Precision@1 > 5%):
```
→ Include PropReferenceChunks in permanent embedding dataset ✅
→ Plan ComponentOverviewChunk implementation (Week 2+)
→ Expand property-centric query coverage
```

### If improvement is marginal (Δ Precision@1 1-5%):
```
→ Investigate embedding text strategy:
   Option A: Include more content (code snippets, full type info)
   Option B: Include chunk metadata (component category, tags)
   Option C: Consider larger embedding model (3-large)
→ Still include PropReferenceChunks (adds coverage)
→ Test Option A/B/C variants
```

### If no improvement (Δ Precision@1 < 1%):
```
→ Review PropReferenceChunk quality:
   - Are descriptions accurate?
   - Are categories correct?
   - Are tokens in optimal range?
→ Check embedder - is it processing prop chunks?
→ Consider embedding strategy overhaul:
   - Full chunk content (not just explanation)
   - Include type information in embedding text
   - Combine multiple fields for richer semantics
```

---

## Quick Reference: Running Tests

```bash
# Complete test sequence (18 queries)
npm run build && \
docker-compose down -v && \
docker-compose up -d qdrant && \
npm run cli -- 1-normalize && \
npm run embed && \
sleep 5 && \
echo "=== BASELINE QUERIES ===" && \
npm run search -- "How do I size a button?" && \
npm run search -- "button variants" && \
npm run search -- "loading state" && \
npm run search -- "button with icons" && \
npm run search -- "button color" && \
echo "=== CATEGORY 1: Size/Variants ===" && \
npm run search -- "Show me different button variants" && \
npm run search -- "Make a button larger" && \
echo "=== CATEGORY 2: Interaction/State ===" && \
npm run search -- "Button with loading state" && \
npm run search -- "Disabled button example" && \
npm run search -- "Button click handler" && \
echo "=== CATEGORY 3: Composition ===" && \
npm run search -- "Button group layout" && \
echo "=== CATEGORY 4: Styling/Appearance ===" && \
npm run search -- "Change button color" && \
npm run search -- "Rounded button corners" && \
echo "=== CATEGORY 5: Edge Cases ===" && \
npm run search -- "What is Button?" && \
npm run search -- "What props does Button have?" && \
npm run search -- "Button required prop" && \
npm run search -- "How do I disable a button"
```

**Or run individually for cleaner output:**
```bash
# Just baseline (5 queries - quick validation)
npm run search -- "How do I size a button?"
npm run search -- "button variants"
npm run search -- "loading state"
npm run search -- "button with icons"
npm run search -- "button color"
```

---

## Files to Reference

- **Baseline:** [RETRIEVAL_TEST_REPORT.md](RETRIEVAL_TEST_REPORT.md)
- **Results:** EMBEDDING_TEST_RESULTS.md (to be created after testing)
- **Normalized Data:** `artifacts/normalized/*.json` and `artifacts/normalized/*-props.json`
- **Embedder:** `src/steps/2-embed/embedder.ts`
- **Retriever:** `src/steps/3-search/retriever.ts`
- **Services:** `src/services/{EmbeddingService,VectorStoreService,RetrievalService}.ts`

---

## Timeline

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Setup | 5-10 min | Ready |
| Phase 2: Embed | 2-5 min | Ready |
| Phase 3: Query Tests (18 queries) | 15-25 min | Ready |
| Phase 4: Analysis | 15-30 min | Pending |
| Phase 5: Detailed Comparison | 20-40 min | Pending |
| Phase 6: Report | 20-30 min | Pending |
| **Total** | **75-140 min** | **Ready to Start** |

**Extended test coverage:**
- 5 baseline queries (RETRIEVAL_TEST_REPORT.md)
- 13 extended category queries (VECTOR_DB_POC_GUIDE.md test suite)
- Total: 18 comprehensive queries across 5 categories

---

## Next Steps After Testing

1. **Document findings** in EMBEDDING_TEST_RESULTS.md
2. **Update strategy** based on results
3. **Plan Phase 2:** ComponentOverviewChunk or embedding strategy refinement
4. **Archive results** for future comparison

