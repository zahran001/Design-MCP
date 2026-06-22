# Embedder Restructure - Implementation Checklist

**Status:** Ready to Implement
**Estimated Duration:** 45-60 minutes
**Complexity:** Low (3 small files, 2 small modifications)

---

## Pre-Implementation

### Preparation
- [ ] Read `EMBEDDER_RESTRUCTURE_README.md` (10 min)
- [ ] Review plan at `C:\Users\minha\.claude\plans\nifty-rolling-feather.md` (5 min)
- [ ] Check current state:
  ```bash
  npm run build  # Should pass
  npm run test   # Should pass (existing tests)
  ```

### Verify Current Artifacts
- [ ] Check chunk types are only code-example and prop-reference:
  ```bash
  grep -h "chunkType" artifacts/normalized/*.json | sort | uniq -c
  # Expected: 387 code-example, 360 prop-reference (total 747)
  ```

---

## Phase 1: Create Extraction Utility (15 min)

### Create File
- [ ] Create `src/steps/2-embed/utils/extractEmbeddingText.ts`

### Implementation
- [ ] Add imports:
  - `NormalizedChunk, isCodeExampleChunk, isPropReferenceChunk`
  - `CodeExampleChunk, PropReferenceChunk`

- [ ] Implement `extractCodeExampleText()`:
  - Join: `explanation + demonstrates[] + keyPoints[]`
  - Return trimmed result
  - **Exclude code blocks**

- [ ] Implement `extractPropReferenceText()`:
  - Join: `description + typeExplanation + usageGuidance + defaultBehavior`
  - Handle optional fields with `|| ''`
  - Return trimmed result

- [ ] Implement `extractEmbeddingText()` dispatcher:
  - Check `isCodeExampleChunk()` → call extractor
  - Check `isPropReferenceChunk()` → call extractor
  - **Throw error for unsupported types** (strict validation)
  - Include helpful error message

### Verification
- [ ] File compiles: `npm run build`
- [ ] No TypeScript errors

---

## Phase 2: Create Unit Tests (10 min)

### Create File
- [ ] Create `src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts`

### Implementation
- [ ] Test CodeExampleChunk:
  - Verify explanation is included
  - Verify demonstrates array is joined
  - **Verify code block is NOT included**
  - Verify keyPoints are included

- [ ] Test PropReferenceChunk:
  - Verify all 4 content fields are included
  - Verify optional fields don't break when missing
  - Verify proper spacing between fields

- [ ] Test Error Handling:
  - Create chunk with unsupported type
  - Verify error is thrown
  - Verify error message is helpful

### Verification
- [ ] Tests compile: `npm run build`
- [ ] All tests pass: `npm run test -- src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts`

---

## Phase 3: Update Embedder (10 min)

### File: `src/steps/2-embed/embedder.ts`

#### Change 1: Add Import (Line 6)
- [ ] After existing imports, add:
  ```typescript
  import { extractEmbeddingText } from './utils/extractEmbeddingText.js';
  ```

#### Change 2: Replace Text Extraction (Lines 32-34)
- [ ] Find: `const text = ${chunk.content?.explanation...`
- [ ] Replace with try-catch wrapper:
  ```typescript
  try {
    const text = extractEmbeddingText(chunk);
    if (text.trim().length === 0) {
      console.warn(`Skipping chunk with empty text: ${chunk.metadata.chunkId}`);
      continue;
    }
    // ... rest of loop continues here
  } catch (error) {
    console.error(`Failed to extract text from chunk ${chunk.metadata.chunkId}:`, error.message);
    throw error;
  }
  ```

#### Change 3: Update Payload Structure (Lines 46-56)
- [ ] Find: `allPoints.push({ id: pointId, vector, payload: {...}`
- [ ] Replace payload with:
  ```typescript
  payload: {
    chunkId: chunk.metadata.chunkId,
    chunkType: chunk.metadata.chunkType,
    componentName: chunk.metadata.componentName,
    sourceUrl: chunk.metadata.sourceUrl,
    fullChunk: chunk
  }
  ```

### Verification
- [ ] File compiles: `npm run build`
- [ ] No TypeScript errors in embedder

---

## Phase 4: Full Build & Test (5 min)

- [ ] Build entire project:
  ```bash
  npm run build
  ```
  Expected: ✅ No errors

- [ ] Run all tests:
  ```bash
  npm run test
  ```
  Expected: ✅ All tests pass (new tests included)

---

## Phase 5: Re-embed & Validate (20 min)

### Clean Environment
- [ ] Stop and clean Qdrant:
  ```bash
  docker-compose down -v
  ```

- [ ] Restart Qdrant:
  ```bash
  docker-compose up -d qdrant
  sleep 5
  ```

### Re-embed with Fixed Code
- [ ] Run embedding:
  ```bash
  npm run embed
  ```

Expected output:
- ✅ "Creating collection..."
- ✅ "Loading normalized chunks..."
- ✅ "Embedding [1] Embedding ... (repeated 747 times)"
- ✅ "Upserting 747 points to Qdrant..."
- ✅ "Success! Embedded 747 chunks."
- ❌ NO errors or warnings about PropReferenceChunk

### Verify Embedding Success
- [ ] Check console output for "Success! Embedded 747 chunks"
- [ ] No error messages about unsupported chunk types
- [ ] All 747 chunks (387 code-example + 360 prop-reference) embedded

---

## Phase 6: Test Critical Query (5 min)

### Test "button color" (The Failing Query)
```bash
npm run search -- "button color"
```

**Verify Results:**
- [ ] Rank 1 is Button component (or Button prop)
- [ ] Score is > 0.50
- [ ] NOT Color Mode (the old wrong result)

Expected: Button colorPalette prop ✅

### Test Baseline Queries
```bash
npm run search -- "How do I size a button?"
npm run search -- "button variants"
npm run search -- "loading state"
npm run search -- "button with icons"
```

**Verify Results:**
- [ ] All 5 queries return relevant top result
- [ ] Precision@1 = 100% (5/5)

---

## Phase 7: Update Documentation (5 min)

- [ ] Create/update `EMBEDDING_TEST_RESULTS.md`:
  - [ ] Add results for all 5 baseline queries
  - [ ] Show scores for each query
  - [ ] Compare Precision@1 (80% → 100%)
  - [ ] Document Query 5 improvement (FAIL → PASS)
  - [ ] Include date and timestamp

- [ ] Create `EMBEDDER_IMPLEMENTATION_SUMMARY.md`:
  - [ ] Files created (extractEmbeddingText.ts + tests)
  - [ ] Files modified (embedder.ts)
  - [ ] Changes summary
  - [ ] Testing results
  - [ ] Known issues (if any)

---

## Troubleshooting

### Issue: Build Fails
**Solution:**
1. Check imports are correct
2. Verify file paths use `.js` extensions
3. Check TypeScript syntax

```bash
npm run build  # See full error
```

### Issue: Tests Fail
**Solution:**
1. Check chunk structure matches schema
2. Verify test data is correct
3. Check assertions match implementation

```bash
npm run test -- src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts
```

### Issue: Embed Command Fails
**Solution:**
1. Check Docker is running: `docker ps | grep qdrant`
2. Check Qdrant is listening: `curl http://localhost:6333/health`
3. Check error message for unsupported chunk types

```bash
npm run embed  # See error message
```

### Issue: Search Returns Wrong Results
**Solution:**
1. Verify Qdrant collection was cleared properly
2. Check all 747 chunks were embedded
3. Test critical query: `npm run search -- "button color"`

```bash
# Check Qdrant dashboard
open http://localhost:6333/dashboard
```

---

## Success Criteria

### Code Quality
- [ ] New code follows project style
- [ ] TypeScript strict mode passes
- [ ] All tests pass
- [ ] No console errors during embed

### Functionality
- [ ] 747 chunks embedded (387 code-example + 360 prop-reference)
- [ ] No crashes on unsupported types
- [ ] PropReferenceChunk embeddings are semantic (not empty)
- [ ] CodeExampleChunk embeddings unchanged

### Test Results
- [ ] All 5 baseline queries pass
- [ ] Query 5 ("button color") improves from FAIL → PASS
- [ ] Precision@1: 80% → 100%
- [ ] No regression in existing queries

---

## Final Checklist

- [ ] All code changes complete
- [ ] All tests passing
- [ ] Re-embedding successful (747 chunks)
- [ ] All 5 baseline queries pass
- [ ] Query 5 now returns Button colorPalette #1
- [ ] Documentation updated
- [ ] Ready to merge!

---

## Time Tracking

| Phase | Estimated | Actual | Status |
|-------|-----------|--------|--------|
| Phase 1: Create Extraction Utility | 15 min | — | — |
| Phase 2: Create Unit Tests | 10 min | — | — |
| Phase 3: Update Embedder | 10 min | — | — |
| Phase 4: Build & Test | 5 min | — | — |
| Phase 5: Re-embed & Validate | 20 min | — | — |
| Phase 6: Test Queries | 5 min | — | — |
| Phase 7: Documentation | 5 min | — | — |
| **TOTAL** | **70 min** | — | — |

---

## Notes

- Strict error handling is intentional - prevents silent bad embeddings
- Code blocks excluded from embeddings by design (low semantic value)
- Payload now stores full chunk (future-proof for new types)
- Expected to fix Query 5 immediately upon successful embedding

---

**Good luck! 🚀**
