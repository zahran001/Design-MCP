# Design MCP - Embedder Restructure Implementation

**Status:** 🟢 Ready for Implementation
**Date:** December 29, 2025
**Priority:** CRITICAL - Fixes failing query (Query 5: "button color")

---

## Executive Summary

This repository contains a **planned implementation** to restructure the embedder and fix a critical issue where PropReferenceChunks have empty embeddings.

**The Problem:**
- Query "button color" fails (returns Color Mode instead of Button)
- PropReferenceChunks (360 chunks) have near-zero embeddings
- Embedder only extracts text from CodeExampleChunk fields

**The Solution:**
- Create chunk-type-aware text extraction utility
- Update embedder to route to appropriate extractors
- Update payload structure for polymorphic chunk support

**Expected Impact:**
- Precision@1: 80% → 100% (5/5 queries passing)
- PropReferenceChunks now contribute to semantic search
- Query "button color" now returns Button colorPalette #1

---

## Documentation Structure

### 📖 Start Here
1. **[EMBEDDER_IMPLEMENTATION_GUIDE.md](EMBEDDER_IMPLEMENTATION_GUIDE.md)** (30 min read)
   - Overview of problem and solution
   - Architecture explanation
   - Key design decisions
   - Commands reference

### ✅ Implementation Steps
2. **[IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)** (70 min work)
   - Phase-by-phase checklist
   - Code snippets for each change
   - Verification steps
   - Troubleshooting guide

### 📚 Reference Materials
3. **[EMBEDDER_RESTRUCTURE_README.md](EMBEDDER_RESTRUCTURE_README.md)** (detailed)
   - Comprehensive technical guide
   - Text extraction logic details
   - Error handling strategy
   - Validation checklist

4. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** (at a glance)
   - Quick problem/solution summary
   - File reference table
   - Command cheat sheet
   - Success criteria

5. **[Plan Document](C:\Users\minha\.claude\plans\nifty-rolling-feather.md)**
   - Complete technical design
   - Code snippets for all changes
   - Design rationale
   - Implementation strategy

---

## The Changes (Summary)

### New Files (2)
```
src/steps/2-embed/utils/extractEmbeddingText.ts      (40 lines)
src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts (80 lines)
```

### Modified Files (1)
```
src/steps/2-embed/embedder.ts                         (3 small changes)
```

### Total Changes
- **Lines of new code:** ~120
- **Lines modified:** ~3
- **Complexity:** Low (isolated changes)
- **Risk:** Low (easy to revert)

---

## Quick Start

### For Managers/Reviewers
Read in this order:
1. This document (2 min)
2. [EMBEDDER_IMPLEMENTATION_GUIDE.md](EMBEDDER_IMPLEMENTATION_GUIDE.md) - "The Problem in 30 Seconds" section (2 min)
3. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - "Problem → Solution" section (2 min)

**Total:** 6 minutes to understand the issue and fix.

### For Implementers
1. Read [EMBEDDER_IMPLEMENTATION_GUIDE.md](EMBEDDER_IMPLEMENTATION_GUIDE.md) (30 min)
2. Follow [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) (70 min)
3. Done! ✅

**Total:** ~100 minutes for full implementation and testing.

---

## Key Facts

### Current State (Broken)
- 747 chunks indexed (387 code-example + 360 prop-reference)
- 360 prop chunks have near-zero embeddings (unusable)
- Query "button color" returns wrong result (Color Mode instead of Button)
- Precision@1: 80% (4 of 5 queries pass)

### After Implementation (Fixed)
- All 747 chunks have rich semantic embeddings
- PropReferenceChunks contribute meaningfully to search
- Query "button color" returns Button colorPalette #1 (correct)
- Precision@1: 100% (5 of 5 queries pass)

### Timeline
- Planning: ✅ Complete (Design document done)
- Implementation: 70-100 minutes
- Testing: 20 minutes
- Total: ~2 hours start-to-finish

---

## Technical Overview

### The Core Issue

```typescript
// Current embedder (BROKEN for PropReferenceChunk)
const text = `${chunk.content?.explanation || ''} ${chunk.content?.demonstrates?.join(' ') || ''}`;

// CodeExampleChunk has: explanation, demonstrates ✅
// PropReferenceChunk has: description, typeExplanation, usageGuidance, defaultBehavior ❌

// Result: PropReferenceChunk gets empty text → empty embedding
```

### The Solution

```typescript
// New extractEmbeddingText() utility
if (isCodeExampleChunk(chunk)) {
  return extractCodeExampleText(chunk);  // explanation + demonstrates + keyPoints
}

if (isPropReferenceChunk(chunk)) {
  return extractPropReferenceText(chunk); // description + typeExplanation + ...
}

throw new Error(`Unsupported type...`); // Fail fast for new types
```

---

## Success Criteria

### Must Pass
- [ ] All 5 baseline queries return correct top result
- [ ] Query "button color" returns Button component (NOT Color Mode)
- [ ] Precision@1: 100% (5/5 passing)
- [ ] No TypeScript errors
- [ ] All tests pass
- [ ] Re-embedding completes successfully (747 chunks)

### Validation Tests
```bash
npm run search -- "How do I size a button?"     # Expected: Button ✅
npm run search -- "button variants"             # Expected: Button ✅
npm run search -- "loading state"               # Expected: Button ✅
npm run search -- "button with icons"           # Expected: IconButton ✅
npm run search -- "button color"                # Expected: Button colorPalette ✅ (FIX)
```

---

## Implementation Overview

### Phase 1: Create Extraction Utility (15 min)
Create `src/steps/2-embed/utils/extractEmbeddingText.ts` with:
- `extractCodeExampleText()` - natural language only (no code)
- `extractPropReferenceText()` - all content fields
- `extractEmbeddingText()` - main dispatcher (throws on unsupported)

### Phase 2: Create Unit Tests (10 min)
Create `src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts` with:
- CodeExampleChunk extraction test
- PropReferenceChunk extraction test
- Error handling test

### Phase 3: Update Embedder (10 min)
Modify `src/steps/2-embed/embedder.ts`:
1. Import `extractEmbeddingText`
2. Replace text extraction with try-catch wrapper
3. Update payload structure (polymorphic)

### Phase 4-7: Build, Test, Embed, Validate (50 min)
- Build project
- Run unit tests
- Clear Qdrant
- Re-embed (747 chunks)
- Test all queries
- Document results

---

## Estimated Effort

| Task | Duration |
|------|----------|
| Planning & Design | ✅ Complete |
| Phase 1: Extraction Utility | 15 min |
| Phase 2: Unit Tests | 10 min |
| Phase 3: Update Embedder | 10 min |
| Phase 4-7: Build & Test | 50 min |
| **Total** | **85 min** |

---

## Getting Started

### Option A: Quick Understanding (10 min)
1. This document (2 min)
2. "The Problem in 30 Seconds" in [EMBEDDER_IMPLEMENTATION_GUIDE.md](EMBEDDER_IMPLEMENTATION_GUIDE.md) (2 min)
3. [QUICK_REFERENCE.md](QUICK_REFERENCE.md) (6 min)

### Option B: Full Implementation (100 min)
1. Read: [EMBEDDER_IMPLEMENTATION_GUIDE.md](EMBEDDER_IMPLEMENTATION_GUIDE.md) (30 min)
2. Follow: [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) (70 min)
3. Verify: Tests pass ✅

### Option C: Deep Dive (2 hours)
1. [EMBEDDER_RESTRUCTURE_README.md](EMBEDDER_RESTRUCTURE_README.md) (45 min)
2. [C:\Users\minha\.claude\plans\nifty-rolling-feather.md](C:\Users\minha\.claude\plans\nifty-rolling-feather.md) (30 min)
3. [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md) (70 min)

---

## Files to Read/Create/Modify

### Documentation (Read These)
- ✅ `README_EMBEDDER.md` (this file)
- 📖 `EMBEDDER_IMPLEMENTATION_GUIDE.md` (main guide)
- ✅ `IMPLEMENTATION_CHECKLIST.md` (step-by-step)
- �� `EMBEDDER_RESTRUCTURE_README.md` (detailed reference)
- 🚀 `QUICK_REFERENCE.md` (at-a-glance)

### Code (Create/Modify)
- 🆕 `src/steps/2-embed/utils/extractEmbeddingText.ts` (CREATE)
- 🆕 `src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts` (CREATE)
- ✏️ `src/steps/2-embed/embedder.ts` (MODIFY - 3 places)

### Reference (Read Only)
- 📋 `src/schemas/NormalizedChunkSchema.ts` (type guards)
- 📊 `artifacts/normalized/Button.json` (CodeExampleChunk samples)
- 📊 `artifacts/normalized/Button-props.json` (PropReferenceChunk samples)
- 📈 `EMBEDDING_TEST_RESULTS.md` (to be updated)

---

## Key Design Decisions

### 1. Chunk-Type-Aware Extraction
Route based on type instead of hardcoded fields → Type-safe, extensible, testable

### 2. Code Blocks Excluded
Only embed natural language (explanation + demonstrates) → Better semantic quality, reduces noise

### 3. Strict Validation
Throw error on unsupported types → Fails fast, prevents garbage embeddings, forces correctness

### 4. Polymorphic Payload
Store full chunk in payload → Simple, uniform, future-proof, no data loss

---

## Support & Questions

- **Understanding the problem?** → [EMBEDDER_IMPLEMENTATION_GUIDE.md](EMBEDDER_IMPLEMENTATION_GUIDE.md)
- **How to implement?** → [IMPLEMENTATION_CHECKLIST.md](IMPLEMENTATION_CHECKLIST.md)
- **Technical details?** → [EMBEDDER_RESTRUCTURE_README.md](EMBEDDER_RESTRUCTURE_README.md)
- **Quick lookup?** → [QUICK_REFERENCE.md](QUICK_REFERENCE.md)

---

**Status:** 🟢 Ready for Implementation
**Begin With:** [EMBEDDER_IMPLEMENTATION_GUIDE.md](EMBEDDER_IMPLEMENTATION_GUIDE.md)
**Estimated Duration:** 85-100 minutes
