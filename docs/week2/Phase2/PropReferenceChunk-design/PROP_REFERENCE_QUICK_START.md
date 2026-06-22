# PropReferenceChunk: Quick Start Guide

**Status:** Ready to implement
**Time:** 4-6 hours
**Impact:** +15-20% query coverage, ~500 new chunks

---

## The Problem

Current embedding only has CodeExampleChunk (387 chunks).

Query: "button color" fails because no PropReferenceChunk exists.

---

## The Solution

Transform component props → semantic chunks answering "What's the X prop?"

```
Raw Input (from artifacts/raw-json/Button.json)
  props: [
    { name: "size", type: "'xs' | 'sm' | 'md' | ...", description: "...", defaultValue: "md" }
  ]

↓ propReferenceTransformer.ts

Output: PropReferenceChunk
  ✅ Answers: "What's the Button size prop?"
  ✅ Tokens: 120-160 (optimal)
  ✅ Embeds well: Rich semantic content
```

---

## Data Flow (One-Pager)

```
┌─────────────────────┐
│   Raw JSON Props    │  ← Available! (already extracted)
│  (name, type, desc) │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────────────────┐
│ 1. Categorize prop              │  ← Simple pattern matching
│    (size → appearance)          │
└──────────┬──────────────────────┘
           │
           ↓
┌─────────────────────────────────┐
│ 2. Parse type                   │  ← Regex extraction
│    ("'xs' | 'sm'" → [xs, sm])   │
└──────────┬──────────────────────┘
           │
           ↓
┌─────────────────────────────────┐
│ 3. Find related props           │  ← From prop name patterns
│    (size → variant, color)      │
└──────────┬──────────────────────┘
           │
           ↓
┌─────────────────────────────────┐
│ 4. Generate NLG                 │  ← Template-based
│    (description, guidance)      │
└──────────┬──────────────────────┘
           │
           ↓
┌──────────────────────────────┐
│ PropReferenceChunk (READY!)  │
│ ✅ Validates ✅ Embeds       │
└──────────────────────────────┘
```

---

## Implementation in 3 Files

### **File 1: propReferenceTransformer.ts** (New - 2 hours)

```typescript
export function transformProp(
  rawProp: Prop,
  componentName: string,
  sourceUrl: string,
  allProps: Prop[]
): PropReferenceChunk {
  // 1. Categorize: size → appearance
  const category = categorizeProp(rawProp.name);

  // 2. Parse type: "'xs' | 'sm'" → {kind: union, options: [xs, sm]}
  const typeInfo = parsePropertyType(rawProp.type);

  // 3. Find related: size → [variant, colorPalette]
  const relatedProps = findRelatedProps(rawProp.name, allProps);

  // 4. Generate NLG
  const content = generatePropContent(rawProp, typeInfo, category);

  // 5. Assemble & return chunk
  return { metadata, prop, content, apiReference };
}
```

**Key functions:**
- `categorizeProp(name)` → appearance | state | events | accessibility | ...
- `parsePropertyType(typeStr)` → {kind, raw, options}
- `findRelatedProps(name, allProps)` → string[]

---

### **File 2: propExplanationGenerator.ts** (New - 1.5 hours)

```typescript
export function generatePropContent(
  rawProp: Prop,
  typeInfo: TypeInfo,
  category: PropCategory
) {
  return {
    description: "Controls the size of the button",
    typeExplanation: "Union of 5 string values: xs, sm, md, lg, xl",
    usageGuidance: "Use 'md' for primary actions",
    defaultBehavior: "Defaults to 'md' if not specified"
  };
}
```

**Key functions:**
- `generateDescription(name, category)` → human-friendly text
- `generateTypeExplanation(typeInfo)` → "Union of 5 values..."
- `generateUsageGuidance(name, category, type)` → best practices
- `formatValue(value)` → quote strings

---

### **File 3: normalizer.ts** (Modify - 0.5 hours)

Add after CodeExampleChunk processing:

```typescript
// Process props for each component
for (const file of filesToProcess) {
  const rawData = JSON.parse(...);

  if (rawData.props?.length > 0) {
    const propChunks = rawData.props.map(prop =>
      transformProp(prop, rawData.componentName, rawData.sourceUrl, rawData.props)
    );

    // Save to {ComponentName}-props.json
    fs.writeFileSync(..., JSON.stringify(propChunks, null, 2));
  }
}
```

---

## Expected Output

**Input:** 50 components × ~10 props each = 500 props
**Output:** `artifacts/normalized/*-props.json`

Example: `Button-props.json`
```json
[
  {
    "metadata": {
      "chunkId": "button-prop-size-v1",
      "chunkType": "prop-reference",
      "componentName": "Button",
      "tags": ["prop", "appearance", "size"],
      "complexity": "simple"
    },
    "prop": {
      "fullName": "size",
      "name": "size",
      "category": "appearance"
    },
    "content": {
      "description": "Controls the size of the button",
      "typeExplanation": "Union of 5 string values: xs, sm, md, lg, xl",
      "usageGuidance": "Use 'md' for primary actions",
      "defaultBehavior": "Defaults to 'md'"
    },
    "apiReference": {
      "type": {
        "kind": "union",
        "raw": "'xs' | 'sm' | 'md' | 'lg' | 'xl'",
        "options": ["xs", "sm", "md", "lg", "xl"]
      },
      "defaultValue": "md",
      "required": false,
      "relatedProps": ["variant", "colorPalette"]
    }
  }
]
```

---

## Token Quality

**Target:** 100-250 tokens per PropReferenceChunk
**Expected avg:** 120-180 tokens

```
description:          "Controls the size..." (40 tokens)
typeExplanation:      "Union of 5 values..." (35 tokens)
usageGuidance:        "Use md for primary..." (25 tokens)
defaultBehavior:      "Defaults to md..." (10 tokens)
─────────────────────────────────────────────
TOTAL:                ~110-130 tokens ✅ OPTIMAL
```

**Why good for embeddings:**
- ✅ Self-contained (answers one question)
- ✅ Semantic richness (type + guidance + usage)
- ✅ Natural language (not structured data)
- ✅ Distinct from examples (different content style)

**🎯 Optimization:**
- Unknown props get **type-aware fallback** descriptions
- Example: `"Configures orientation property (accepts union)"` instead of `"Configures behavior"`
- This boosts embedding distinctiveness for props without explicit descriptions (~5% quality improvement)

---

## Testing Strategy

```bash
# Unit tests for transformation logic
npm run test -- transformers/__tests__/propReferenceTransformer.test.ts

# Unit tests for NLG
npm run test -- generators/__tests__/propExplanationGenerator.test.ts

# Integration: Run full normalization
npm run cli -- 1-normalize

# Verify output
ls artifacts/normalized/*-props.json | wc -l  # ~50 files
cat artifacts/normalized/Button-props.json | jq '.[] | .metadata.chunkId' | wc -l  # ~12 chunks
```

---

## Embedding Integration

After PropReferenceChunk is complete:

```typescript
// In embedding service
const codeExamples = await loadChunks('code-example');      // 387 chunks
const propReferences = await loadChunks('prop-reference');  // ~500 chunks

const allChunks = [...codeExamples, ...propReferences];     // ~900 chunks

// Embed & index all chunks
for (const chunk of allChunks) {
  const embedding = await openai.createEmbedding(chunk.content.text);
  await vectorDb.upsert(chunk.metadata.chunkId, embedding, chunk);
}
```

---

## Query Coverage Improvement

### Before (CodeExample only)
```
Query: "button color"
Top result: ColorMode (WRONG) ❌
Success: 4/5 (80%)
```

### After (CodeExample + PropReference)
```
Query: "button color"
Top result: Button.colorPalette prop (CORRECT!) ✅
Success: 5/5 (100%)
```

---

## Risk Mitigation

| Risk | Solution |
|------|----------|
| Type parsing fails | Fallback to `kind: 'complex'` |
| No prop description | Generate from name |
| Tokens too high | Skip non-essential fields |
| Missing data | Graceful fallback, no crash |

**Confidence:** 🟢 **HIGH** - All data exists, simple logic, proven patterns

---

## Dependencies

✅ All already available:
- Raw props in artifacts/raw-json/*.json (Week 1)
- Zod schemas defined
- Test patterns established
- Config system in place
- Chunk ID generation exists

**No new external dependencies needed!**

---

## Timeline

```
Hour 1-2: Core transformation (categorizeProp, parsePropertyType, findRelatedProps)
Hour 2-3: NLG templates (generateDescription, generateTypeExplanation, etc.)
Hour 3-4: Integration (update normalizer.ts)
Hour 4-5: Testing (write tests, run validation)
Hour 5-6: Polish (README, final checks)
```

Total: **4.5-5 hours** to production-ready

---

## Success Looks Like

✅ ~500 PropReferenceChunks generated
✅ All props correctly categorized (appearance, state, events, etc.)
✅ Token count 100-250 range (average ~130)
✅ Types parsed correctly (95%+)
✅ Related props inferred
✅ Tests passing
✅ Ready to embed

---

## What This Enables

After PropReferenceChunk embeddings:

```
User Query              | Before | After | Handled By
────────────────────────┼────────┼───────┼───────────────────────
"button color"          | ❌     | ✅    | PropReferenceChunk
"What's Button size?"   | ❌     | ✅    | PropReferenceChunk
"size prop options"     | ❌     | ✅    | PropReferenceChunk
"How to size button?"   | ✅     | ✅    | CodeExampleChunk
"button variants"       | ✅     | ✅    | CodeExampleChunk
"loading state"         | ✅     | ✅    | CodeExampleChunk
```

**Coverage increase: 80% → 85-90%** (5-10 percentage point improvement)

---

**Ready to start? See [PROP_REFERENCE_CHUNK_PLAN.md](PROP_REFERENCE_CHUNK_PLAN.md) for full implementation details.**

