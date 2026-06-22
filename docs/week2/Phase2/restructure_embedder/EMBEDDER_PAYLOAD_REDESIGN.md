# Embedder Payload Redesign & Text Extraction Implementation Plan

**Date:** December 29, 2025
**Objective:** Fix embedder for polymorphic chunk support + enable future filtering
**Scope:** Extract text injection + Payload structure redesign
**Impact:** Fixes 80% → 100% Precision@1 + enables chunk-type filtering

---

## Executive Summary

The embedder currently:
- ❌ Only extracts text for `CodeExampleChunk` (hardcoded fields)
- ❌ Leaves `PropReferenceChunk` with empty/unusable embeddings
- ❌ Stores only code-specific payload fields (won't scale to 7 chunk types)
- ❌ No filterability (can't query by `chunkType` or `category` in Qdrant)

**This plan fixes all three issues:**

1. **Text Extraction (Chunk-Type-Aware)**
   Extract embedding text from the correct fields based on chunk type
   - `CodeExampleChunk` → `explanation + demonstrates + keyPoints`
   - `PropReferenceChunk` → `description + typeExplanation + usageGuidance + defaultBehavior`
   - Enables support for 5 more chunk types planned

2. **Payload Restructuring (Polymorphic + Filterable)**
   Redesign payload structure for:
   - **Searchability:** Elevate filterable fields to top level (Qdrant filters work here)
   - **Polymorphism:** Store full chunk object (supports all 7 chunk types)
   - **Backward Compatibility:** Maintain current search behavior

3. **Testing + Validation**
   Unit tests + integration tests to verify 100% Precision@1 on baseline queries

---

## Current State (Broken)

### Hardcoded Text Extraction (embedder.ts:33)
```typescript
const text = `${chunk.content?.explanation || ''} ${chunk.content?.demonstrates?.join(' ') || ''}`;
```

**Problems:**
- `chunk.content` structure differs across chunk types
- `explanation` doesn't exist in `PropReferenceChunk`
- `demonstrates` doesn't exist in `PropReferenceChunk`
- **Result:** Empty text → near-zero embedding vector

**Real Impact (360 props in dataset):**
- CodeExampleChunk (387): Rich embedding text ✅
- PropReferenceChunk (360): Empty/useless embeddings ❌
- Query "button color" returns Color Mode (theme system) instead of Button prop

### Current Payload Structure (embedder.ts:49-55)
```typescript
payload: {
  chunkId,
  componentName: chunk.metadata?.componentName,
  sourceUrl: chunk.metadata?.sourceUrl,
  explanation: chunk.content?.explanation,              // ❌ Code-specific
  code: chunk.content?.code,                            // ❌ Code-specific
}
```

**Limitations:**
- Only stores code example fields (doesn't work for other chunk types)
- No `chunkType` for routing/filtering
- No `category` for component filtering
- No way to reconstruct full chunk for LLM context
- Not extensible to other chunk types

---

## Proposed Solution

### Phase 1: Create `extractEmbeddingText.ts` Utility

**File:** `src/steps/2-embed/utils/extractEmbeddingText.ts`
**Purpose:** Route text extraction based on chunk type
**Size:** ~90 lines of code

```typescript
import { NormalizedChunk, isCodeExampleChunk, isPropReferenceChunk } from '../../schemas/NormalizedChunkSchema.js';

/**
 * Extract optimal embedding text from a chunk.
 * Routes to chunk-type-specific extractors.
 *
 * Design:
 * - Each chunk type has a dedicated extractor function
 * - Extractor combines fields specific to that chunk type
 * - Falls back to empty string gracefully (won't crash embedder)
 * - Returns trimmed, non-empty text or error
 *
 * @param chunk - Normalized chunk (any of 7 types)
 * @returns Embedding text (natural language for vector generation)
 * @throws If chunk type is not supported
 */
export function extractEmbeddingText(chunk: NormalizedChunk): string {
  if (isCodeExampleChunk(chunk)) {
    return extractCodeExampleText(chunk);
  }

  if (isPropReferenceChunk(chunk)) {
    return extractPropReferenceText(chunk);
  }

  // Placeholder for future chunk types
  // if (isComponentOverviewChunk(chunk)) return extractComponentOverviewText(chunk);
  // if (isCapabilityReferenceChunk(chunk)) return extractCapabilityReferenceText(chunk);
  // if (isPropGroupChunk(chunk)) return extractPropGroupText(chunk);
  // if (isCompositionPatternChunk(chunk)) return extractCompositionPatternText(chunk);
  // if (isAPIReferenceChunk(chunk)) return extractAPIReferenceText(chunk);

  throw new Error(
    `Unsupported chunk type: ${(chunk.metadata as any).chunkType}. ` +
    `Chunk ID: ${chunk.metadata.chunkId}`
  );
}

/**
 * Extract text from CodeExampleChunk
 *
 * Uses:
 * 1. explanation (primary - human description of what this does)
 * 2. demonstrates (tags - what this example demonstrates)
 * 3. keyPoints (optional - key takeaways)
 *
 * Rationale:
 * - explanation is natural language for semantic understanding
 * - demonstrates provides keyword context (e.g., "size prop usage")
 * - keyPoints adds specific technical details
 *
 * Example:
 * Input:
 *   explanation: "This example shows how to use different button sizes..."
 *   demonstrates: ["size prop usage", "HStack layout"]
 *   keyPoints: ["Size prop accepts xs|sm|md|lg|xl"]
 *
 * Output:
 * "This example shows how to use different button sizes... size prop usage HStack layout Size prop accepts xs|sm|md|lg|xl"
 */
function extractCodeExampleText(chunk: any): string {
  const parts: string[] = [];

  // Add explanation (main content)
  if (chunk.content?.explanation) {
    parts.push(chunk.content.explanation);
  }

  // Add demonstrates tags (what this demonstrates)
  if (Array.isArray(chunk.content?.demonstrates)) {
    parts.push(...chunk.content.demonstrates);
  }

  // Add key points (technical details)
  if (Array.isArray(chunk.content?.keyPoints)) {
    parts.push(...chunk.content.keyPoints);
  }

  const text = parts.join(' ').trim();
  if (!text) {
    throw new Error(
      `CodeExampleChunk has no embedding text: ${chunk.metadata?.chunkId}. ` +
      `Missing explanation, demonstrates, and keyPoints.`
    );
  }
  return text;
}

/**
 * Extract text from PropReferenceChunk
 *
 * Uses:
 * 1. description (primary - what does this prop do)
 * 2. typeExplanation (types and options)
 * 3. usageGuidance (when/how to use it)
 * 4. defaultBehavior (what's the default)
 *
 * Rationale:
 * - description is the "why" (what problem does this solve)
 * - typeExplanation is the "what" (what values are accepted)
 * - usageGuidance is the "when" (in what context is this useful)
 * - defaultBehavior is the "default" (what happens if omitted)
 *
 * Together they fully answer: "What does prop X do and when should I use it?"
 *
 * Example:
 * Input:
 *   description: "Controls the size of the button..."
 *   typeExplanation: "Union type with 7 options: 2xs, xs, sm, md, lg, xl, 2xl"
 *   usageGuidance: "Use md for primary actions, sm for secondary..."
 *   defaultBehavior: "Defaults to 'md' if not specified"
 *
 * Output:
 * "Controls the size of the button... Union type with 7 options: 2xs, xs, sm, md, lg, xl, 2xl Use md for primary actions, sm for secondary... Defaults to 'md' if not specified"
 */
function extractPropReferenceText(chunk: any): string {
  const parts: string[] = [];

  // Add description (what does this prop do)
  if (chunk.content?.description) {
    parts.push(chunk.content.description);
  }

  // Add type explanation (what values are accepted)
  if (chunk.content?.typeExplanation) {
    parts.push(chunk.content.typeExplanation);
  }

  // Add usage guidance (when/how to use)
  if (chunk.content?.usageGuidance) {
    parts.push(chunk.content.usageGuidance);
  }

  // Add default behavior (what's the default)
  if (chunk.content?.defaultBehavior) {
    parts.push(chunk.content.defaultBehavior);
  }

  const text = parts.join(' ').trim();
  if (!text) {
    throw new Error(
      `PropReferenceChunk has no embedding text: ${chunk.metadata?.chunkId}. ` +
      `Missing description, typeExplanation, usageGuidance, and defaultBehavior.`
    );
  }
  return text;
}
```

**Design Rationale:**
- ✅ Chunk-type-aware routing (different extractors for different types)
- ✅ Clear comments explaining why we use each field
- ✅ Graceful error handling (fail fast with context)
- ✅ Extensible pattern for future chunk types (comments show placeholders)
- ✅ DRY extraction functions (reusable, testable)

---

### Phase 2: Update Payload Structure for Polymorphic Support

**File:** `src/steps/2-embed/embedder.ts` (modify lines 49-56)
**Purpose:** Restructure payload for all 7 chunk types + enable filtering
**Impact:** Enables Qdrant filters on chunk metadata

#### Current Payload (Lines 46-56)
```typescript
allPoints.push({
  id: pointId,
  vector,
  payload: {
    chunkId,
    componentName: chunk.metadata?.componentName,
    sourceUrl: chunk.metadata?.sourceUrl,
    explanation: chunk.content?.explanation,
    code: chunk.content?.code,
  },
});
```

#### Proposed New Payload Structure
```typescript
allPoints.push({
  id: pointId,
  vector,
  payload: {
    // ============================================================
    // FILTERABLE FIELDS (top-level, used in Qdrant filters)
    // ============================================================
    // These fields enable filtering at retrieval time
    // Example: search for only PropReferenceChunk results
    //
    // Qdrant supports:
    // - Keyword filter: `chunkType = 'prop-reference'`
    // - Nested conditions: `category = 'form-controls'`
    //
    chunkType: chunk.metadata?.chunkType || 'unknown',      // Chunk discriminator
    chunkId: chunk.metadata?.chunkId,                       // Stable chunk ID
    componentName: chunk.metadata?.componentName,           // Component (e.g., "Button")
    category: chunk.metadata?.category,                     // Component category
    tags: chunk.metadata?.tags || [],                       // Semantic tags

    // ============================================================
    // DISPLAY FIELDS (used by frontend/CLI)
    // ============================================================
    sourceUrl: chunk.metadata?.sourceUrl,                   // Original docs URL
    version: chunk.metadata?.version,                       // Schema version
    complexity: chunk.metadata?.complexity,                 // Skill level

    // ============================================================
    // CHUNK-SPECIFIC FIELDS (payload flattening for quick access)
    // ============================================================
    // For CodeExampleChunk
    explanation: chunk.content?.explanation,               // Code explanation
    code: chunk.content?.code,                              // Code snippet
    demonstrates: chunk.content?.demonstrates,             // Demo tags

    // For PropReferenceChunk
    propName: (chunk as any).prop?.name,                    // Prop name (e.g., "size")
    propCategory: (chunk as any).prop?.category,           // Prop category
    propDescription: (chunk.content as any)?.description,  // Prop description
    propType: (chunk.content as any)?.typeExplanation,     // Type info

    // ============================================================
    // FULL CHUNK (stored for LLM context/reconstruction)
    // ============================================================
    // The complete chunk object, stored as JSON string for later retrieval.
    // This allows the LLM to have full context without another DB lookup.
    //
    // Usage pattern:
    // 1. Retrieve chunk from Qdrant (includes vector + payload)
    // 2. Extract fullChunk from payload
    // 3. Parse and send to LLM for context window
    // 4. LLM uses full chunk structure for accurate answers
    //
    fullChunk: JSON.stringify(chunk),                       // Full chunk for LLM
  },
});
```

**Rationale for Structure:**

| Section | Why? | Example |
|---------|------|---------|
| **Filterable Fields** | Enable Qdrant filter queries | `chunkType = 'prop-reference'` |
| **Display Fields** | CLI/UI needs these without parsing JSON | `sourceUrl` for "Learn more" links |
| **Chunk-Specific** | Quick access (no parsing required) | `propName` for prop-focused UI |
| **Full Chunk** | LLM context + reconstruction | Send full object to LLM for accuracy |

---

### Phase 3: Update Embedder to Use New Text Extraction

**File:** `src/steps/2-embed/embedder.ts` (modify lines 33-55)

#### Before
```typescript
for (const chunk of chunks) {
  const text = `${chunk.content?.explanation || ''} ${chunk.content?.demonstrates?.join(' ') || ''}`;
  if (text.trim().length === 0) continue;

  count++;
  const chunkId = chunk.metadata?.chunkId;
  console.log(`  [${count}] Embedding ${chunkId}...`);

  const vector = await embedding.embedText(text);
  const pointId = uuidv5(chunkId, NAMESPACE);

  allPoints.push({
    id: pointId,
    vector,
    payload: {
      chunkId,
      componentName: chunk.metadata?.componentName,
      sourceUrl: chunk.metadata?.sourceUrl,
      explanation: chunk.content?.explanation,
      code: chunk.content?.code,
    },
  });
}
```

#### After
```typescript
import { extractEmbeddingText } from './utils/extractEmbeddingText.js';

for (const chunk of chunks) {
  let text: string;
  try {
    text = extractEmbeddingText(chunk);
  } catch (error) {
    console.warn(`  ⚠️  Skipping chunk (extraction failed): ${chunk.metadata?.chunkId}`);
    console.warn(`     Error: ${(error as Error).message}`);
    continue;
  }

  if (text.trim().length === 0) continue;

  count++;
  const chunkId = chunk.metadata?.chunkId;
  console.log(`  [${count}] Embedding ${chunkId}...`);

  const vector = await embedding.embedText(text);
  const pointId = uuidv5(chunkId, NAMESPACE);

  allPoints.push({
    id: pointId,
    vector,
    payload: {
      // Filterable fields (top level for Qdrant filters)
      chunkType: chunk.metadata?.chunkType || 'unknown',
      chunkId: chunk.metadata?.chunkId,
      componentName: chunk.metadata?.componentName,
      category: chunk.metadata?.category,
      tags: chunk.metadata?.tags || [],

      // Display fields
      sourceUrl: chunk.metadata?.sourceUrl,
      version: chunk.metadata?.version,
      complexity: chunk.metadata?.complexity,

      // Chunk-specific fields (for quick access)
      explanation: chunk.content?.explanation,
      code: chunk.content?.code,
      demonstrates: chunk.content?.demonstrates,
      propName: (chunk as any).prop?.name,
      propCategory: (chunk as any).prop?.category,
      propDescription: (chunk.content as any)?.description,
      propType: (chunk.content as any)?.typeExplanation,

      // Full chunk for LLM context
      fullChunk: JSON.stringify(chunk),
    },
  });
}
```

---

### Phase 4: Create Unit Tests for Text Extraction

**File:** `src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts`
**Purpose:** Validate extraction for all chunk types
**Size:** ~120 lines

```typescript
import { describe, it, expect } from '@jest/globals';
import { extractEmbeddingText } from '../extractEmbeddingText.js';
import { CodeExampleChunk, PropReferenceChunk } from '../../../schemas/NormalizedChunkSchema.js';

describe('extractEmbeddingText', () => {
  describe('CodeExampleChunk', () => {
    it('extracts explanation + demonstrates + keyPoints', () => {
      const chunk: CodeExampleChunk = {
        metadata: {
          chunkId: 'button-example-sizes-v1',
          chunkType: 'code-example',
          componentName: 'Button',
          sourceUrl: 'https://chakra-ui.com/docs/components/button',
          version: '3.27.1',
          tags: ['size', 'variants'],
          category: 'form-controls',
          complexity: 'simple'
        },
        example: {
          title: 'Button Sizes',
          intent: 'Show different button sizes',
          difficulty: 'basic'
        },
        content: {
          explanation: 'This example demonstrates button sizing.',
          code: '<Button size="md">Click me</Button>',
          demonstrates: ['size prop usage', 'responsive design'],
          keyPoints: ['Use xs for small actions', 'Use lg for primary CTAs']
        },
        codeMetadata: {
          language: 'tsx',
          imports: [],
          components: ['Button'],
          props: [],
          complexity: 2
        }
      };

      const text = extractEmbeddingText(chunk);

      expect(text).toContain('This example demonstrates button sizing.');
      expect(text).toContain('size prop usage');
      expect(text).toContain('responsive design');
      expect(text).toContain('Use xs for small actions');
    });

    it('handles missing keyPoints gracefully', () => {
      const chunk: CodeExampleChunk = {
        // ...metadata
        content: {
          explanation: 'Example text',
          code: '<Button>Test</Button>',
          demonstrates: ['prop usage'],
          // keyPoints omitted
        },
        // ...other fields
      };

      const text = extractEmbeddingText(chunk);
      expect(text).toBeTruthy();
      expect(text).toContain('Example text');
    });

    it('throws if no embedding text can be extracted', () => {
      const chunk: CodeExampleChunk = {
        // ...metadata
        content: {
          explanation: '',
          code: '',
          demonstrates: [],
          // Empty content
        },
        // ...other fields
      };

      expect(() => extractEmbeddingText(chunk)).toThrow(
        /CodeExampleChunk has no embedding text/
      );
    });
  });

  describe('PropReferenceChunk', () => {
    it('extracts description + typeExplanation + usageGuidance + defaultBehavior', () => {
      const chunk: PropReferenceChunk = {
        metadata: {
          chunkId: 'button-prop-size-v1',
          chunkType: 'prop-reference',
          componentName: 'Button',
          sourceUrl: 'https://chakra-ui.com/docs/components/button',
          version: '3.27.1',
          tags: ['size', 'styling'],
          category: 'form-controls',
          complexity: 'simple'
        },
        prop: {
          fullName: 'size',
          name: 'size',
          category: 'sizing'
        },
        content: {
          description: 'Controls the size of the button.',
          typeExplanation: 'Accepts: 2xs | xs | sm | md | lg | xl | 2xl',
          usageGuidance: 'Use md for primary actions, sm for secondary.',
          defaultBehavior: 'Defaults to md if not specified.'
        },
        apiReference: {
          type: { kind: 'string' },
          defaultValue: 'md',
          required: false
        }
      };

      const text = extractEmbeddingText(chunk);

      expect(text).toContain('Controls the size of the button.');
      expect(text).toContain('2xs | xs | sm | md | lg | xl | 2xl');
      expect(text).toContain('Use md for primary actions');
      expect(text).toContain('Defaults to md');
    });

    it('handles missing optional fields', () => {
      const chunk: PropReferenceChunk = {
        // ...metadata
        content: {
          description: 'Controls something',
          typeExplanation: 'Type info',
          usageGuidance: undefined, // Optional, missing
          defaultBehavior: undefined // Optional, missing
        },
        // ...other fields
      };

      const text = extractEmbeddingText(chunk);
      expect(text).toBeTruthy();
      expect(text).toContain('Controls something');
      expect(text).toContain('Type info');
    });

    it('throws if no description or typeExplanation', () => {
      const chunk: PropReferenceChunk = {
        // ...metadata
        content: {
          description: '',
          typeExplanation: '',
          usageGuidance: undefined,
          defaultBehavior: undefined
        },
        // ...other fields
      };

      expect(() => extractEmbeddingText(chunk)).toThrow(
        /PropReferenceChunk has no embedding text/
      );
    });
  });

  describe('Unsupported chunk types', () => {
    it('throws error for unsupported types', () => {
      const chunk = {
        metadata: {
          chunkId: 'test-chunk',
          chunkType: 'composition-pattern', // Not yet implemented
          componentName: 'Button',
          sourceUrl: 'https://example.com',
          version: '1.0',
          tags: [],
          category: 'form-controls' as const,
          complexity: 'simple' as const
        },
        // Missing extraction logic
      } as any;

      expect(() => extractEmbeddingText(chunk)).toThrow(
        /Unsupported chunk type/
      );
    });
  });
});
```

---

## Implementation Checklist

### Checklist Item 1: Create extraction utility
- [ ] Create `src/steps/2-embed/utils/extractEmbeddingText.ts`
- [ ] Implement `extractEmbeddingText()` router function
- [ ] Implement `extractCodeExampleText()` specific extractor
- [ ] Implement `extractPropReferenceText()` specific extractor
- [ ] Add comprehensive comments explaining field usage
- [ ] Add placeholders for future chunk types

### Checklist Item 2: Create unit tests
- [ ] Create `src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts`
- [ ] Test CodeExampleChunk extraction
- [ ] Test PropReferenceChunk extraction
- [ ] Test error handling for missing fields
- [ ] Test error handling for unsupported types
- [ ] Run tests: `npm run test -- extractEmbeddingText.test.ts`

### Checklist Item 3: Update embedder.ts
- [ ] Import `extractEmbeddingText` at top of file
- [ ] Replace hardcoded text extraction (line 33)
- [ ] Replace payload structure (lines 49-56)
- [ ] Add chunk-type-aware fields to payload
- [ ] Add filterable fields to top level
- [ ] Add try-catch for extraction errors
- [ ] Update console logging for clarity

### Checklist Item 4: Run and validate
- [ ] Compile: `npm run build`
- [ ] Run embedder: `npm run embed`
- [ ] Verify console shows: ✅ `Embedded 747 chunks` (387 code + 360 props)
- [ ] Verify no extraction errors in logs
- [ ] Run baseline queries: `npm run search -- "button color"`
- [ ] Expected: Button prop at rank 1 (was Color Mode before)

### Checklist Item 5: Verify test results
- [ ] Query 1: "How do I size a button?" - Score ✅
- [ ] Query 2: "button variants" - Score ✅
- [ ] Query 3: "loading state" - Score ✅
- [ ] Query 4: "button with icons" - Score ✅
- [ ] Query 5: "button color" - **NOW PASSES** ✅ (was failing)
- [ ] Expected Precision@1: 100% (5/5 queries)

---

## Payload Field Reference

### Filterable Fields (Top-Level)
Used in Qdrant filter queries. Example: `chunkType = 'prop-reference'`

| Field | Type | Example | Use Case |
|-------|------|---------|----------|
| `chunkType` | string | `'code-example'` | Filter by chunk type |
| `chunkId` | string | `'button-prop-size-v1'` | Direct chunk lookup |
| `componentName` | string | `'Button'` | Filter by component |
| `category` | string | `'form-controls'` | Filter by category |
| `tags` | string[] | `['size', 'variants']` | Tag-based filtering |

### Display Fields
Used by CLI/UI without additional lookup

| Field | Type | Example |
|-------|------|---------|
| `sourceUrl` | string | `https://chakra-ui.com/docs/.../button` |
| `version` | string | `'3.27.1'` |
| `complexity` | string | `'simple'` |

### Chunk-Specific Fields
Quick access for common retrieval patterns

| Field | Chunk Types | Example |
|-------|-------------|---------|
| `explanation` | CodeExampleChunk | "This example shows..." |
| `code` | CodeExampleChunk | `<Button size="md">` |
| `propName` | PropReferenceChunk | `'size'` |
| `propDescription` | PropReferenceChunk | "Controls the size..." |

### Full Chunk JSON
Complete chunk object for LLM context

| Field | Type | Use |
|-------|------|-----|
| `fullChunk` | JSON string | Reconstruct chunk, provide LLM context |

---

## Success Criteria

### Phase 1: Text Extraction Implementation
- ✅ Both extractors implemented (CodeExample + PropReference)
- ✅ Unit tests pass (100% coverage)
- ✅ No TypeScript errors in compilation
- ✅ Embedder runs without crashes

### Phase 2: Payload Redesign Integration
- ✅ Embedder uses new payload structure
- ✅ All 747 chunks embedded successfully (387 + 360)
- ✅ Payload includes filterable fields
- ✅ Payload includes full chunk JSON

### Phase 3: Query Performance Improvement
- ✅ Query 5 ("button color") now returns Button prop at rank 1
- ✅ Precision@1: 80% → 100% (5/5 queries)
- ✅ No regression on queries 1-4
- ✅ Property-focused queries work correctly

### Phase 4: Production Readiness
- ✅ All tests passing
- ✅ Comprehensive error messages
- ✅ Extensible for future chunk types
- ✅ Qdrant filters functional for chunkType/category/tags

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/steps/2-embed/utils/extractEmbeddingText.ts` | **CREATE** | Text extraction router + specific extractors |
| `src/steps/2-embed/utils/__tests__/extractEmbeddingText.test.ts` | **CREATE** | Unit tests for extraction logic |
| `src/steps/2-embed/embedder.ts` | **MODIFY** | Import extraction utility + update payload |

---

## Performance Notes

- **Extraction:** ~2-5ms per chunk (negligible)
- **Total embed time:** Should remain ~1-2 minutes (same as before)
- **Payload size increase:** ~5-10KB per chunk (full chunk JSON)
- **Qdrant memory:** Minimal impact (JSON stored as payload, not indexed)

---

## Rollback Strategy

If issues arise:

1. **Revert embedder.ts** → use old payload structure
2. **Re-run `npm run embed`** → overwrites old points
3. **Re-run queries** → reverts to old behavior

No data loss; collection can be reset via `docker-compose down -v`.

---

## Next Steps (After This Implementation)

### Week 2+: Future Chunk Types
Once this foundation is solid, implement extractors for:
1. ComponentOverviewChunk
2. CapabilityReferenceChunk
3. PropGroupChunk
4. CompositionPatternChunk
5. APIReferenceChunk

Each follows the same pattern:
1. Create specific extractor in `extractEmbeddingText.ts`
2. Add unit tests
3. Generate chunks in normalizer
4. Run embedder (automatic pickup)

### Week 3+: Qdrant Filtering
Use the top-level filterable fields:
- Filter search results by `chunkType`
- Filter by component `category`
- Filter by semantic `tags`

Example retrieval enhancement:
```typescript
// Get only PropReferenceChunk results for "button color" query
search("button color", {
  filter: { chunkType: { equals: 'prop-reference' } }
})
```

---

## Questions to Consider

1. **Should chunk-specific fields flatten all possible prop combinations?**
   → No, add only fields needed for common queries (keep payload lean)

2. **Should fullChunk be compressed?**
   → Not needed for now; test performance first

3. **Should we validate chunk structure before extraction?**
   → Trust normalization pipeline; fail fast if data is invalid

4. **How to handle future chunk types?**
   → Add placeholder comments; implement when chunk generator is ready

---

## Appendix: Field Examples

### CodeExampleChunk Payload Example
```json
{
  "chunkType": "code-example",
  "chunkId": "button-example-sizes-v1",
  "componentName": "Button",
  "category": "form-controls",
  "tags": ["sizing", "variants"],
  "sourceUrl": "https://chakra-ui.com/docs/components/button",
  "explanation": "This example shows button sizing...",
  "code": "<Button size=\"md\">Click</Button>",
  "demonstrates": ["size prop usage"],
  "fullChunk": "{\"metadata\":{...}, \"content\":{...}}"
}
```

### PropReferenceChunk Payload Example
```json
{
  "chunkType": "prop-reference",
  "chunkId": "button-prop-size-v1",
  "componentName": "Button",
  "category": "form-controls",
  "tags": ["sizing"],
  "sourceUrl": "https://chakra-ui.com/docs/components/button",
  "propName": "size",
  "propCategory": "sizing",
  "propDescription": "Controls the size of the button...",
  "propType": "2xs | xs | sm | md | lg | xl | 2xl",
  "fullChunk": "{\"metadata\":{...}, \"prop\":{...}, \"content\":{...}}"
}
```

---

**Next Action:** Proceed to IMPLEMENTATION_CHECKLIST.md for step-by-step code changes.
