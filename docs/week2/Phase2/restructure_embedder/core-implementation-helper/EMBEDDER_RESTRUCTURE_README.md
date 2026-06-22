# Embedder Restructure: PropReferenceChunk Support

**Status:** Ready for Implementation
**Date:** December 29, 2025
**Priority:** CRITICAL - Blocks Query 5 ("button color") from passing

## Overview

This implementation restructures the embedder to support multiple chunk types, fixing a critical issue where PropReferenceChunks have empty embeddings and contribute zero semantic value to retrieval.

**Problem:** Query "button color" fails because the embedder only extracts text from CodeExampleChunk fields, but PropReferenceChunk has different field names.

**Solution:** Create a chunk-type-aware text extraction utility that routes to appropriate field extractors.

**Impact:** Precision@1 should improve from 80% → 100% (5/5 queries passing)

---

## Current State: The Problem

### What's Broken

**embedder.ts line 33:**
```typescript
const text = `${chunk.content?.explanation || ''} ${chunk.content?.demonstrates?.join(' ') || ''}`;
```

This hardcoded approach:
- ✅ Works for CodeExampleChunk (has `explanation` + `demonstrates`)
- ❌ Fails for PropReferenceChunk (has `description`, `typeExplanation`, `usageGuidance`, `defaultBehavior`)
- Result: 360 prop chunks have near-zero embeddings

### Test Results

| Query | Baseline | Status |
|-------|----------|--------|
| "How do I size a button?" | Button (0.616) | ✅ PASS |
| "button variants" | Button (0.557) | ✅ PASS |
| "loading state" | Button (0.540) | ✅ PASS |
| "button with icons" | IconButton (0.564) | ✅ PASS |
| "button color" | Color Mode (0.532) | ❌ **FAIL** |

**Expected after fix:** All 5 queries PASS, with Query 5 showing Button colorPalette #1

---

## Implementation Architecture

### Phase 1: Create Text Extraction Utility

**File:** `src/steps/2-embed/utils/extractEmbeddingText.ts` (NEW)

This utility centralizes text extraction logic, making it:
- **Type-safe** - Uses TypeScript type guards from schema
- **Testable** - Isolated from embedding orchestration
- **Extensible** - Clear pattern for adding new chunk types
- **Strict** - Fails fast for unsupported types

**Key Functions:**

```typescript
// Extract natural language from CodeExampleChunk
// Excludes code blocks (low semantic density)
extractCodeExampleText(chunk: CodeExampleChunk): string

// Extract all content fields from PropReferenceChunk
extractPropReferenceText(chunk: PropReferenceChunk): string

// Main dispatcher - routes based on chunk type
export extractEmbeddingText(chunk: NormalizedChunk): string
```

**Design Decisions:**

1. **Code Blocks Excluded:** Only embed `explanation + demonstrates + keyPoints`
   - Rationale: Code has low semantic density; natural language optimized for search
   - Code preserved in payload for LLM context after retrieval

2. **Strict Validation:** Throws error for unsupported types
   - Fails fast (prevents bad embeddings)
   - Forces explicit implementation (new types require extractor)
   - Clear error message guides developer

3. **Type Guards:** Uses existing type guards from `NormalizedChunkSchema.ts`
   - Consistent with `getChunkTokenCount()` pattern
   - Type-safe with IntelliSense support

### Phase 2: Update Embedder

**File:** `src/steps/2-embed/embedder.ts`

**Three Changes:**

1. **Import utility** (after line 5):
   ```typescript
   import { extractEmbeddingText } from './utils/extractEmbeddingText.js';
   ```

2. **Replace text extraction** (lines 32-34):
   ```typescript
   try {
     const text = extractEmbeddingText(chunk);
     if (text.trim().length === 0) {
       console.warn(`Skipping chunk with empty text: ${chunk.metadata.chunkId}`);
       continue;
     }
     // ... continue with embedding
   } catch (error) {
     console.error(`Failed to extract text from chunk ${chunk.metadata.chunkId}:`, error.message);
     throw error; // Fail entire embedding job
   }
   ```

3. **Update payload structure** (lines 46-56):
   ```typescript
   // Store polymorphic data (works for all chunk types)
   allPoints.push({
     id: pointId,
     vector,
     payload: {
       chunkId: chunk.metadata.chunkId,
       chunkType: chunk.metadata.chunkType,
       componentName: chunk.metadata.componentName,
       sourceUrl: chunk.metadata.sourceUrl,
       fullChunk: chunk  // LLM gets all context
     },
   });
   ```

### Phase 3: Unit Tests

**File:** `src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts` (NEW)

Test coverage:
- CodeExampleChunk extraction (verify code excluded)
- PropReferenceChunk extraction (all content fields)
- Error handling (unsupported types throw)
- Edge cases (missing optional fields)

Run with: `npm run test -- src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts`

---

## Implementation Steps

### Before You Start

1. Review the current state:
   ```bash
   cat artifacts/normalized/Button.json | head -50      # CodeExampleChunk
   cat artifacts/normalized/Button-props.json | head -50 # PropReferenceChunk
   ```

2. Verify chunk types in artifacts:
   ```bash
   grep -h "chunkType" artifacts/normalized/*.json | sort | uniq -c
   # Expected output:
   #       387 "chunkType": "code-example",
   #       360 "chunkType": "prop-reference",
   ```

### Step 1: Create Extraction Utility

Create `src/steps/2-embed/utils/extractEmbeddingText.ts` with:
- `extractCodeExampleText()` - natural language only
- `extractPropReferenceText()` - all content fields
- `extractEmbeddingText()` - main dispatcher (throws on unsupported types)

**Verify:**
```bash
npm run build  # Should compile without errors
```

### Step 2: Update Embedder

Modify `src/steps/2-embed/embedder.ts`:
1. Add import for `extractEmbeddingText`
2. Replace lines 32-34 with try-catch wrapper
3. Update payload structure (lines 46-56)

**Verify:**
```bash
npm run build  # Should compile without errors
```

### Step 3: Create Tests

Create `src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts` with:
- CodeExampleChunk test
- PropReferenceChunk test
- Error handling test

**Verify:**
```bash
npm run test -- src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts
# Expected: All tests pass
```

### Step 4: Re-embed and Validate

```bash
# Clean and rebuild
npm run build

# Clear Qdrant
docker-compose down -v
docker-compose up -d qdrant
sleep 5

# Re-embed with fixed code
npm run embed

# Expected output:
# Embedding 747 chunks... (387 code-example + 360 prop-reference)
# No errors (strict validation ensures only supported types)
```

### Step 5: Test Critical Query

```bash
npm run search -- "button color"
```

**Expected result:**
- **Before:** Color Mode #1 (score 0.532) ❌ FAIL
- **After:** Button colorPalette #1 (score > 0.50) ✅ PASS

### Step 6: Run All Baseline Queries

```bash
npm run search -- "How do I size a button?"
npm run search -- "button variants"
npm run search -- "loading state"
npm run search -- "button with icons"
npm run search -- "button color"
```

**Expected:** All 5 queries return relevant top results

### Step 7: Update Test Results

Edit `EMBEDDING_TEST_RESULTS.md`:
- Update query scores
- Compare Precision@1 (expect 80% → 100%)
- Document improvement in Query 5

---

## Technical Details

### Text Extraction Logic

**CodeExampleChunk:**
```
explanation: "This example demonstrates how to size buttons"
demonstrates: ["sizing", "variants"]
keyPoints: ["Use md for primary actions"]

Extracted text:
"This example demonstrates how to size buttons sizing variants Use md for primary actions"
```

**PropReferenceChunk:**
```
description: "Controls the size of the button"
typeExplanation: "Union type with 7 string options: 2xs, xs, sm, md, lg, xl, 2xl"
usageGuidance: "Use md for primary actions"
defaultBehavior: "Defaults to md if not specified"

Extracted text:
"Controls the size of the button Union type with 7 string options: 2xs, xs, sm, md, lg, xl, 2xl Use md for primary actions Defaults to md if not specified"
```

### Error Handling

When unsupported chunk type is encountered:

```typescript
Error: Unsupported chunk type "capability-reference" (chunk: button-capability-sizing-v1).
Add an extractor function to extractEmbeddingText() before embedding this type.
```

This fails the entire embedding job (safe approach) rather than creating bad embeddings.

### Payload Evolution

**Before (CodeExampleChunk-specific):**
```json
{
  "chunkId": "...",
  "componentName": "Button",
  "sourceUrl": "...",
  "explanation": "...",
  "code": "..."
}
```

**After (Polymorphic):**
```json
{
  "chunkId": "...",
  "chunkType": "prop-reference",
  "componentName": "Button",
  "sourceUrl": "...",
  "fullChunk": {
    "metadata": { ... },
    "prop": { ... },
    "content": { ... },
    "apiReference": { ... }
  }
}
```

Benefits:
- Simple, uniform structure across all chunk types
- No data loss (full chunk available for LLM)
- Future-proof (new chunk types work without changes)

---

## Validation Checklist

Before marking as complete:

- [ ] `extractEmbeddingText.ts` created with 2 extractors + dispatcher
- [ ] `extractEmbeddingText.test.ts` created with tests passing
- [ ] `embedder.ts` updated with import, try-catch, and payload changes
- [ ] `npm run build` succeeds without errors
- [ ] `npm run test` for extraction utility passes
- [ ] Docker & Qdrant cleaned: `docker-compose down -v && docker-compose up -d qdrant`
- [ ] Re-embed succeeds: `npm run embed` (747 chunks)
- [ ] Query "button color" returns Button colorPalette #1
- [ ] All 5 baseline queries pass
- [ ] `EMBEDDING_TEST_RESULTS.md` updated with new metrics
- [ ] Plan documented in `EMBEDDER_RESTRUCTURE_IMPLEMENTATION.md`

---

## Expected Outcomes

### Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Precision@1 | 80% (4/5) | 100% (5/5) | ✅ PASS |
| Query 5 "button color" | FAIL | PASS | ✅ PASS |
| PropReferenceChunks with semantic embeddings | 0/360 | 360/360 | ✅ PASS |
| CodeExampleChunk regression | — | None | ✅ PASS |

### Query Results

**Query 1: "How do I size a button?"**
- Before: Button (0.616)
- After: Button (0.616+) - no regression

**Query 5: "button color"** (THE KEY FIX)
- Before: Color Mode (0.532) ❌
- After: Button colorPalette (>0.50) ✅

---

## Rollback Plan

If issues occur:

1. **Qdrant vector search broken:**
   ```bash
   git checkout src/steps/2-embed/embedder.ts
   docker-compose down -v && docker-compose up -d qdrant
   npm run build && npm run embed
   ```

2. **Tests failing:**
   ```bash
   npm run test -- src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts
   # Fix implementation based on test failures
   ```

3. **Embeddings broken:**
   ```bash
   # Check error message from npm run embed
   # Most likely: new chunk type encountered
   # Fix: Add extractor to extractEmbeddingText() or remove generator
   ```

---

## Files Modified/Created

### New Files
- `src/steps/2-embed/utils/extractEmbeddingText.ts` - Text extraction utility
- `src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts` - Unit tests
- `EMBEDDER_RESTRUCTURE_README.md` (this file)

### Modified Files
- `src/steps/2-embed/embedder.ts` - 3 changes (import, text extraction, payload)

### Referenced Files (Read-only)
- `src/schemas/NormalizedChunkSchema.ts` - Type guards and chunk definitions
- `artifacts/normalized/Button.json` - CodeExampleChunk sample data
- `artifacts/normalized/Button-props.json` - PropReferenceChunk sample data
- `EMBEDDING_TEST_RESULTS.md` - Test results to be updated

---

## Key Insights

### Why Strict Validation?

**Current codebase reality:**
- Only 2 chunk types are EVER generated: code-example (387) and prop-reference (360)
- 5 other chunk types are defined but have NO generators
- If new types are added, developer will modify embedder anyway

**Silent fallback problems:**
- `JSON.stringify(chunk.content)` creates garbage embeddings
- No warning that something is wrong
- Silent data quality degradation

**Strict approach benefits:**
- Fails fast (developer knows immediately)
- Forces correctness (new types require explicit extractor)
- Clear guidance (error message tells what to do)
- Better DX (no mystery bad embeddings)

### Why Exclude Code?

**Schema precedent:**
- `CODE_WEIGHT = 0.40` shows code has lower semantic density
- Natural language descriptions already optimized for search

**Efficiency:**
- Reduces embedding size without losing signal
- Code syntax ≠ semantic meaning

**Retrieval quality:**
- "button color" should match semantic meaning, not code syntax
- Natural language embeds intent, code embeds syntax

---

## Next Steps After Implementation

1. **Validate with extended test suite** (18 queries across 5 categories)
2. **Plan Phase 2:** Implement ComponentOverviewChunk extractor
3. **Archive results** in test documentation
4. **Consider embedding model upgrade** (text-embedding-3-large if needed)

---

## Questions?

Refer to the detailed plan at `C:\Users\minha\.claude\plans\nifty-rolling-feather.md`
