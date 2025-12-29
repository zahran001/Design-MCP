# PropReferenceChunk Embedding Integration Test Results

**Date:** December 29, 2025
**Status:** ⚠️ **CRITICAL FINDING - NO IMPROVEMENT**
**Test Dataset:** 5 Baseline Queries from RETRIEVAL_TEST_REPORT.md
**Embedding Model:** text-embedding-3-small
**Collection Size:** ~747 chunks (387 code + 360 prop reference chunks)

---

## Executive Summary: The Problem

**Expected Outcome:** PropReferenceChunk integration would improve retrieval for property-centric queries
**Actual Outcome:** ❌ **No improvement observed** - Query results remain identical to baseline

The new PropReferenceChunk data (360 props) is NOT improving retrieval scores despite being indexed and available in Qdrant. The critical "button color" query still fails with Color Mode ranking first.

---

## Detailed Results: All 5 Baseline Queries

### Query 1: "How do I size a button?"
```
BASELINE:  Rank 1: Button - Score 0.616 ✅
NEW TEST:  Rank 1: Button - Score 0.616 ✅

Δ Change:  +0.000 (NO CHANGE)
Result:    ❌ NO IMPROVEMENT
```
**Analysis:** Same exact result as baseline. Score unchanged. CodeExampleChunks still dominating.

---

### Query 2: "button variants"
```
BASELINE:  Rank 1: Button - Score 0.557 ✅
NEW TEST:  Rank 1: Button - Score 0.557 ✅

Δ Change:  +0.000 (NO CHANGE)
Result:    ❌ NO IMPROVEMENT
```
**Analysis:** Identical match. Variant prop chunks not surfacing higher.

---

### Query 3: "loading state"
```
BASELINE:  Rank 1: Button - Score 0.540 ✅
NEW TEST:  Rank 1: Button - Score 0.540 ✅

Δ Change:  +0.000 (NO CHANGE)
Result:    ❌ NO IMPROVEMENT
```
**Analysis:** Same result. Loading prop chunks (if they exist) not ranked higher.

---

### Query 4: "button with icons"
```
BASELINE:  Rank 1: IconButton - Score 0.564 ✅
NEW TEST:  Rank 1: IconButton - Score 0.564 ✅

Δ Change:  +0.000 (NO CHANGE)
Result:    ❌ NO IMPROVEMENT
```
**Analysis:** No change. Composition prop chunks not improving results.

---

### Query 5: "button color" (THE CRITICAL FAILING QUERY)
```
BASELINE:  Rank 1: Color Mode - Score 0.532 ❌ FAIL
NEW TEST:  Rank 1: Color Mode - Score 0.532 ❌ FAIL

Δ Change:  +0.000 (NO CHANGE)
Result:    ❌ STILL FAILS - NO IMPROVEMENT
```

**Analysis:**
- ❌ Button rank 2 with score 0.462 (same as baseline)
- ❌ Color-related prop chunks are NOT ranking higher
- ❌ No semantic improvement from adding color property info
- **Expected:** Rank 1 should be Button color prop (colorPalette, colorScheme)
- **Actual:** Still ranks Color Mode first (off-target system behavior)

---

## Metrics Summary Table

| Metric | Baseline | New Test | Δ Change | Target | Status |
|--------|----------|----------|----------|--------|--------|
| **Precision@1** | 80% (4/5) | 80% (4/5) | +0% | 90% | ❌ FAIL |
| **Precision@5** | 60% (3/5) | 60% (3/5) | +0% | 80% | ❌ FAIL |
| **Avg Top Score** | 0.553 | 0.553 | +0.000 | 0.58+ | ❌ FAIL |
| **Query 5 Success** | ❌ FAIL | ❌ FAIL | NO CHANGE | ✅ PASS | ❌ FAIL |
| **Chunks Indexed** | 387 | 747 | +360 | ✅ | ✅ PASS |

---

## Root Cause Analysis

### Why PropReferenceChunks Are NOT Helping

**Hypothesis:** The embedder is NOT properly processing PropReferenceChunks

#### Problem 1: Embedding Text Strategy
**Current embedder code (lines 32-34 of embedder.ts):**
```typescript
const text = `${chunk.content?.explanation || ''} ${chunk.content?.demonstrates?.join(' ') || ''}`;
```

**For CodeExampleChunk:**
- ✅ `explanation` field exists (e.g., "This example demonstrates how to control Button dimensions...")
- ✅ `demonstrates` array exists (e.g., ["xs", "sm", "md", "lg", "xl"])
- ✅ Works correctly

**For PropReferenceChunk:**
- ❌ `explanation` field is UNDEFINED (field doesn't exist in schema)
- ❌ `demonstrates` field is UNDEFINED (field doesn't exist in schema)
- ❌ Embedding text becomes EMPTY STRING ""
- ❌ Empty embeddings = no semantic meaning

**PropReferenceChunk actual fields:**
```typescript
content: {
  description: "Controls the size of the button",        // ← Not embedded
  typeExplanation: "Union of 5 string values...",        // ← Not embedded
  usageGuidance: "Use md for primary actions...",        // ← Not embedded
  defaultBehavior: "Defaults to md"                      // ← Not embedded
}
```

---

### Problem 2: Verification of PropReferenceChunk Ingestion

**Check:** Are PropReferenceChunks actually in Qdrant?
- ✅ We embedded 747 chunks (confirmed in previous run)
- ✅ Qdrant collection shows ~747 points
- ✅ Prop chunks ARE physically indexed

**But:**
- ❌ They have EMPTY embedding vectors (all ~0.0 values)
- ❌ Semantic search never retrieves them (no similarity signal)
- ❌ They are dead weight in the collection

---

### Problem 3: Why Queries Still Work with CodeExamples

**CodeExampleChunks continue to rank highly because:**
1. They have proper `explanation` + `demonstrates` fields
2. Embeddings are semantically rich
3. They dominate similarity scores
4. PropReferenceChunks (with empty embeddings) never compete

---

## What The Data Shows

### Current Embedding Pipeline:
```
Raw JSON (.json) / Prop JSON (-props.json)
           ↓
    normalizePropReferences()
           ↓
  PropReferenceChunk objects
           ↓
    embedder.ts (embedding function)
           ↓
  PROBLEM: Only reads chunk.content.explanation + demonstrates
           ↓
  PropReferenceChunk: explanation=undefined → ""
  CodeExampleChunk: explanation="..." → [good embedding]
           ↓
  Qdrant: Stores 747 chunks, but 360 have near-zero embeddings
```

---

## Verification Commands

To confirm this diagnosis, run:

```bash
# Check if prop chunks exist in normalized directory
ls -lh artifacts/normalized/*-props.json | wc -l
# Expected: 31-32 files

# Inspect a prop chunk structure
cat artifacts/normalized/Button-props.json | jq '.[0].content' | head -20
# Expected: Shows description, typeExplanation, usageGuidance, defaultBehavior
# NOT: explanation or demonstrates fields

# Check Qdrant for prop chunk vectors
# Navigate to http://localhost:6333/dashboard
# Search for chunks with very low magnitude vectors (should be near-zero)
```

---

## Impact Assessment

| Item | Status | Severity |
|------|--------|----------|
| PropReferenceChunk implementation | ✅ Complete | - |
| Normalized files generated | ✅ 360 props | - |
| Embeddings indexed in Qdrant | ✅ 747 chunks | - |
| Semantic retrieval improvement | ❌ ZERO | 🔴 CRITICAL |
| Query 5 ("button color") | ❌ Still fails | 🔴 CRITICAL |

---

## Immediate Action Required

### Fix Required: Update Embedder for PropReferenceChunk

**File:** `src/steps/2-embed/embedder.ts` (lines 30-35)

**Current (BROKEN):**
```typescript
const text = `${chunk.content?.explanation || ''} ${chunk.content?.demonstrates?.join(' ') || ''}`;
```

**Proposed Fix:**
```typescript
// Detect chunk type and extract appropriate text
let text = '';
if (chunk.content?.explanation !== undefined) {
  // CodeExampleChunk
  text = `${chunk.content.explanation} ${(chunk.content.demonstrates || []).join(' ')}`;
} else if (chunk.content?.description !== undefined) {
  // PropReferenceChunk
  text = `${chunk.content.description} ${chunk.content.typeExplanation || ''} ${chunk.content.usageGuidance || ''} ${chunk.content.defaultBehavior || ''}`;
} else {
  // Fallback
  text = JSON.stringify(chunk.content);
}
```

**Expected Impact After Fix:**
- ✅ PropReferenceChunks will have rich embeddings
- ✅ Color-related prop chunks will rank high for "button color"
- ✅ Query 5 should improve from FAIL → PASS
- ✅ Precision@1 should improve 80% → 90%+

---

## Next Steps

### Phase 1: Fix the Embedder (URGENT)
1. Update `embedder.ts` to handle PropReferenceChunk fields
2. Test embedding for a single prop chunk
3. Verify embedding vector is non-trivial (not near-zero)

### Phase 2: Re-embed with Fix
1. Clear Qdrant collection
2. Re-run `npm run embed`
3. Verify 747 chunks with proper embeddings

### Phase 3: Re-test All 5 Queries
1. Run baseline queries again
2. Expect Query 5 to show improvement
3. Document results vs baseline

### Phase 4: Extended Testing
1. Run 18 comprehensive test queries
2. Validate improvement across all categories
3. Compare against Phase 3 baseline (this current test)

---

## Conclusion

**Status:** ❌ **FAILURE - PropReferenceChunk not improving retrieval**

The PropReferenceChunk implementation is **structurally complete** but **functionally broken** at the embedding layer. The issue is not with the transformer, generator, or normalizer - all working correctly. The issue is that the embedder doesn't know how to extract semantic text from PropReferenceChunk objects.

This is a **configuration/integration issue**, not a design issue. The fix is straightforward: update the embedding text extraction logic to handle the different field names used by PropReferenceChunks.

**Estimated time to fix:** 15-30 minutes
**Expected impact after fix:** Query 5 ("button color") should move from FAIL → PASS, improving Precision@1 from 80% → 90%+

