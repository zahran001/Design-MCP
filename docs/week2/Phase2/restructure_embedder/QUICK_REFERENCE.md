# Quick Reference - Embedder Restructure

## Problem → Solution

```
❌ PROBLEM:
   embedder.ts extracts from: explanation + demonstrates
   CodeExampleChunk has these fields      → ✅ Works
   PropReferenceChunk doesn't have them   → ❌ Empty embeddings

   Result: "button color" query FAILS

✅ SOLUTION:
   Create extractEmbeddingText() utility
   Routes based on chunk type:
   - CodeExampleChunk    → extract explanation + demonstrates
   - PropReferenceChunk  → extract description + typeExplanation + ...

   Result: "button color" query PASSES
```

---

## Files Quick Reference

| File | Action | Size | Time |
|------|--------|------|------|
| `extractEmbeddingText.ts` | CREATE | 40 lines | 15 min |
| `extractEmbeddingText.test.ts` | CREATE | 80 lines | 10 min |
| `embedder.ts` | MODIFY (3 places) | ~3 changes | 10 min |

---

## The 3 Changes to embedder.ts

### Change 1: Import (Line 6)
```typescript
import { extractEmbeddingText } from './utils/extractEmbeddingText.js';
```

### Change 2: Text Extraction (Lines 32-34)
```typescript
// OLD
const text = `${chunk.content?.explanation || ''} ${chunk.content?.demonstrates?.join(' ') || ''}`;
if (text.trim().length === 0) continue;

// NEW
try {
  const text = extractEmbeddingText(chunk);
  if (text.trim().length === 0) {
    console.warn(`Skipping: ${chunk.metadata.chunkId}`);
    continue;
  }
} catch (error) {
  console.error(`Failed: ${chunk.metadata.chunkId}: ${error.message}`);
  throw error;
}
```

### Change 3: Payload (Lines 46-56)
```typescript
// OLD
payload: {
  chunkId,
  componentName: chunk.metadata?.componentName,
  sourceUrl: chunk.metadata?.sourceUrl,
  explanation: chunk.content?.explanation,
  code: chunk.content?.code,
}

// NEW
payload: {
  chunkId: chunk.metadata.chunkId,
  chunkType: chunk.metadata.chunkType,
  componentName: chunk.metadata.componentName,
  sourceUrl: chunk.metadata.sourceUrl,
  fullChunk: chunk
}
```

---

## Extraction Logic Comparison

### CodeExampleChunk
```
INPUT:
  explanation: "This example demonstrates button sizing"
  demonstrates: ["sizing", "variants"]
  keyPoints: ["Use md for primary actions"]
  code: "import { Button }..." (EXCLUDED)

OUTPUT:
  "This example demonstrates button sizing sizing variants Use md for primary actions"
```

### PropReferenceChunk
```
INPUT:
  description: "Controls the size"
  typeExplanation: "Union: 2xs, xs, sm, md, lg, xl, 2xl"
  usageGuidance: "Use md for primary"
  defaultBehavior: "Defaults to md"

OUTPUT:
  "Controls the size Union: 2xs, xs, sm, md, lg, xl, 2xl Use md for primary Defaults to md"
```

---

## Test Results Expected

### Query Results
```
Query 1: "How do I size a button?"
  Before: Button (0.616) ✅
  After:  Button (0.616+) ✅

Query 2: "button variants"
  Before: Button (0.557) ✅
  After:  Button (0.557+) ✅

Query 3: "loading state"
  Before: Button (0.540) ✅
  After:  Button (0.540+) ✅

Query 4: "button with icons"
  Before: IconButton (0.564) ✅
  After:  IconButton (0.564+) ✅

Query 5: "button color" ← THE FIX
  Before: Color Mode (0.532) ❌ FAIL
  After:  Button colorPalette (>0.50) ✅ PASS
```

### Metrics
```
Precision@1: 80% → 100%
Chunks embedded: 747 (387 code-example + 360 prop-reference)
PropReferenceChunks with embeddings: 0 → 360
```

---

## Command Reference

### Quick Commands
```bash
# Setup
npm run build
docker-compose down -v && docker-compose up -d qdrant && sleep 5

# Embed
npm run embed

# Test Critical Query
npm run search -- "button color"

# Test All Baseline Queries
npm run search -- "How do I size a button?"
npm run search -- "button variants"
npm run search -- "loading state"
npm run search -- "button with icons"
npm run search -- "button color"
```

### One-Liner (Full Cycle)
```bash
npm run build && \
docker-compose down -v && \
docker-compose up -d qdrant && \
sleep 5 && \
npm run embed && \
sleep 2 && \
npm run search -- "button color"
```

---

## Key Insights

### Why Strict Error Handling?
- Only 2 chunk types exist (code-example, prop-reference)
- 5 other types defined but no generators
- Silent fallback creates bad embeddings
- Strict approach fails fast = better DX

### Why Exclude Code?
- Code has low semantic density
- Natural language optimized for search
- Code preserved in payload for LLM
- Reduces embedding size

### Why Full Chunk in Payload?
- Simple, uniform structure
- Works for all chunk types (now and future)
- LLM gets all context
- No data loss

---

## Success Criteria Checklist

- [ ] Files created (extractEmbeddingText.ts + test)
- [ ] Files modified (embedder.ts - 3 places)
- [ ] `npm run build` passes
- [ ] `npm run test` passes
- [ ] Re-embed succeeds (747 chunks)
- [ ] Query "button color" returns Button ✅
- [ ] All 5 baseline queries pass ✅
- [ ] Precision@1: 100% ✅

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Build fails | Check imports have `.js` extension |
| Tests fail | Check chunk structure in test data |
| Embed fails | Check Docker: `docker ps \| grep qdrant` |
| Wrong query results | Clear Qdrant: `docker-compose down -v` |

---

## Documentation Structure

```
EMBEDDER_IMPLEMENTATION_GUIDE.md ← START HERE (30 min read)
    ↓
IMPLEMENTATION_CHECKLIST.md ← FOLLOW THIS (70 min do)
    ↓
EMBEDDER_RESTRUCTURE_README.md ← REFERENCE THIS (detailed)
    ↓
C:\Users\minha\.claude\plans\nifty-rolling-feather.md ← PLAN
    ↓
QUICK_REFERENCE.md ← YOU ARE HERE
```

---

## Time Estimate

- Read guide: 10 min
- Implement Phase 1-3: 35 min
- Build & embed: 25 min
- Test & document: 10 min
- **Total: ~80 min**

---

## Key Files

**Create:**
- `src/steps/2-embed/utils/extractEmbeddingText.ts`
- `src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts`

**Modify:**
- `src/steps/2-embed/embedder.ts` (3 changes)

**Update:**
- `EMBEDDING_TEST_RESULTS.md` (with new scores)

**Reference:**
- `src/schemas/NormalizedChunkSchema.ts` (type guards)
- `artifacts/normalized/Button.json` (sample data)
- `artifacts/normalized/Button-props.json` (sample data)

---

## Next Steps

1. **Read** `EMBEDDER_IMPLEMENTATION_GUIDE.md`
2. **Follow** `IMPLEMENTATION_CHECKLIST.md`
3. **Verify** all tests pass
4. **Document** results
5. **Done!** 🚀

---

*Last Updated: December 29, 2025*
*Status: Ready to Implement*
