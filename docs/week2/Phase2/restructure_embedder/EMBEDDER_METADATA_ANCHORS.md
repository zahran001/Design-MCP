# Embedder Metadata Anchors Design

## Problem: The Ambiguity Trap

In a design system with polymorphic concepts (size, variant, colorScheme), multiple components have identical semantic fields:

```
Button.size:   "Controls the size of the button..."
Input.size:    "Controls the size of the input..."
Checkbox.size: "Controls the size of the checkbox..."
```

Without metadata anchors, these produce **nearly identical vectors** because embedding models see the semantic core ("Controls the size...") as identical. This creates dangerous vector space collisions.

### Risk Scenario
User searches: **"How to size an input"**

**WITHOUT anchors:**
- Query vector embeds "size input"
- Matches: Button.size (score 0.87), Input.size (score 0.86), Checkbox.size (score 0.85)
- User gets the wrong component docs

**WITH anchors:**
- Query vector embeds "size input"
- Matches: Input.size (score 0.92), Button.size (score 0.71), Checkbox.size (score 0.68)
- User gets the correct component docs

## Solution: Metadata Anchors ⚓

Explicitly prepend metadata fields to the embedding text before vectorization. This creates distinct semantic spaces for polymorphic concepts.

### For CodeExampleChunk

**Before:**
```
"This example shows how to use different button sizes... size prop usage responsive design..."
```

**After:**
```
"Component: Button. Title: Sizing. This example shows how to use different button sizes... size prop usage..."
```

**Effect:**
- Vector space is anchored to the "Button" concept
- Multiple Button examples have distinct vectors due to title differentiation
- Button sizing examples are separated from Input/Checkbox sizing

### For PropReferenceChunk

**Before:**
```
"Controls the size of the button... Union type with 7 options: 2xs, xs, sm, md, lg, xl, 2xl"
```

**After:**
```
"Component: Button. Prop: size. Controls the size of the button... Union type with 7 options: 2xs, xs, sm, md, lg, xl, 2xl"
```

**Effect:**
- Vector space is doubly anchored: "Component: Button" + "Prop: size"
- Button.size vector is mathematically distinct from Input.size vector
- Cross-component confusion becomes nearly impossible

## Implementation Details

### File: `src/steps/2-embed/utils/extractEmbeddingText.ts`

#### Changes to `extractCodeExampleText()`

```typescript
function extractCodeExampleText(chunk: CodeExampleChunk): string {
  const parts: string[] = [];

  // METADATA ANCHORS: Add component name and title
  const componentName = chunk.metadata?.componentName;
  const title = chunk.example?.title || 'Example';

  if (componentName) {
    parts.push(`Component: ${componentName}.`);
  }

  parts.push(`Title: ${title}.`);

  // ... rest of content fields (explanation, demonstrates, keyPoints)
}
```

**Anchors Added:**
1. `Component: {componentName}`  - Semantic anchor to the component
2. `Title: {title}` - Semantic anchor to the specific example

#### Changes to `extractPropReferenceText()`

```typescript
function extractPropReferenceText(chunk: PropReferenceChunk): string {
  const parts: string[] = [];

  // METADATA ANCHORS: Add component and prop names
  const componentName = chunk.metadata?.componentName;
  const propName = chunk.prop?.fullName || chunk.prop?.name || 'unknown';

  if (componentName) {
    parts.push(`Component: ${componentName}.`);
  }

  parts.push(`Prop: ${propName}.`);

  // ... rest of content fields (description, typeExplanation, usageGuidance, defaultBehavior)
}
```

**Anchors Added:**
1. `Component: {componentName}` - Semantic anchor to the component
2. `Prop: {propName}` - Semantic anchor to the specific prop

### Data Flow

```
NormalizedChunk (JSON)
    ↓
extractEmbeddingText()
    ↓ (adds metadata anchors)
Embedding Text String
    ↓
EmbeddingService.embedText()
    ↓
OpenAI text-embedding-3-small API
    ↓
Vector (1536 dims) with metadata anchor semantics
    ↓
Qdrant.upsertPoints()
    ↓
Vector Store (with clear semantic boundaries)
```

## Examples

### Example 1: Button Code Examples

**Button - Sizing Example:**
```
Component: Button. Title: Sizing. This example shows how to use different button sizes... size prop usage... Button is flexible...
```

**Button - Variants Example:**
```
Component: Button. Title: Variants. This example demonstrates all button variants... variant prop usage... Solid, outline, and ghost variants...
```

→ These have different titles, so their vectors are clearly separated even though both are Button examples.

### Example 2: Prop References Across Components

**Button.size:**
```
Component: Button. Prop: size. Controls the size of the button... Union type with 7 options: 2xs, xs, sm, md, lg, xl, 2xl. Use md for primary actions...
```

**Input.size:**
```
Component: Input. Prop: size. The size of the component. Accepts one of: 2xs, xs, sm, md, lg, xl, 2xl. Use "md" for standard/primary actions...
```

**Checkbox.size:**
```
Component: Checkbox. Prop: size. Controls the checkbox size... Supports sizes: sm, md, lg. Use md for most layouts...
```

→ Despite identical semantic core ("Controls the size"), the explicit metadata anchors create distinct vector spaces:
- Button vector space ≠ Input vector space ≠ Checkbox vector space

## Benefits

1. **Eliminates Cross-Component Confusion**
   - Polymorphic concepts (size, variant, colorScheme) no longer produce colliding vectors
   - User queries for specific components get correct results

2. **Maintains Semantic Richness**
   - Full content fields (explanation, description, etc.) still embedded
   - Anchors don't replace semantic content, only disambiguate

3. **Improves Retrieval Quality**
   - Top-k results more likely to match user intent
   - Reduces need for aggressive filtering

4. **Minimal Performance Impact**
   - Text additions are small (~50 chars per chunk)
   - No change to embedding model or Qdrant configuration
   - Vectors remain 1536-dimensional

5. **Future-Proof Design**
   - Works with other chunk types (ComponentOverviewChunk, CapabilityReferenceChunk, etc.)
   - Extractors for future types should follow same pattern

## Anchor Format Design

### Why This Format?

```
Component: {name}. Prop: {name}.
```

1. **Explicit Field Names** - "Component:", "Prop:" make the metadata clear to the embedding model
2. **Sentence Boundary** - Period after each anchor signals concept boundary
3. **Natural Language** - Not a special token format, works well with text embeddings
4. **Consistent Order** - Component first, then detail (prop/title), then content

### Alternative Formats Considered

❌ **Special Tokens** (e.g., `[COMPONENT:Button]`)
- Less natural to embedding models
- May not work well with general-purpose text embeddings

❌ **Prefixes Only** (e.g., `Button.size:...`)
- Less explicit about field structure
- Harder to parse for downstream uses

✅ **Sentence Format** (chosen)
- Natural language that embeddings understand well
- Explicit field naming
- Clear concept boundaries

## Testing & Validation

### Manual Verification
```bash
# Show extracted text with metadata anchors
node -e "
const { extractEmbeddingText } = require('./dist/steps/2-embed/utils/extractEmbeddingText.js');
const data = JSON.parse(fs.readFileSync('artifacts/normalized/Button.json'));
console.log(extractEmbeddingText(data[0]));
"
```

**Expected Output:**
```
Component: Button. Title: Usage Example. This example demonstrates...
```

### Embedding Quality Validation
After re-running embedder:
```bash
npm run embed
```

Expected results:
- All chunks successfully embedded
- Vector scores in Qdrant reflect anchor-separated spaces
- Cross-component queries return correct component results

## Future Enhancements

### 1. Anchor Weighting
Could increase anchor weight in embedding (if model supports):
```
Component: Button [WEIGHT: 2.0]. Title: Sizing [WEIGHT: 1.5]. This example...
```

### 2. Structured Metadata
For future versions with field-aware embedding:
```json
{
  "metadata_anchors": {
    "component": "Button",
    "title": "Sizing"
  },
  "content": "This example..."
}
```

### 3. Additional Anchors
For other future chunk types:
```
Component: Button. Capability: sizing. Options: xs, sm, md...
Component: Checkbox. PropGroup: appearance. Props include: size, variant...
```

## Rollout Plan

### Phase 1: Current (Implemented)
- ✅ Add anchors to CodeExampleChunk extraction
- ✅ Add anchors to PropReferenceChunk extraction
- ✅ Build and verify compilation
- ✅ Update comments/documentation

### Phase 2: Deployment
- [ ] Re-run embedder: `npm run embed`
- [ ] Verify Qdrant collection updated with new vectors
- [ ] Test search with cross-component queries
- [ ] Monitor retrieval quality metrics

### Phase 3: Future Chunk Types
- [ ] Implement extractors for remaining 5 chunk types
- [ ] Apply same metadata anchor pattern
- [ ] Update Qdrant collection

## Questions & Answers

**Q: Will this break existing searches?**
A: Yes, vectors will change. Need to re-run embedder after this change.

**Q: What about embedding cost?**
A: Minimal - only 50-100 extra characters per chunk. Same API calls to OpenAI.

**Q: Can we add more anchors?**
A: Yes, but follow the principle: only add anchors that prevent confusion between chunks.

**Q: What if componentName is missing?**
A: Code handles gracefully - skips the anchor if missing (though this shouldn't happen with normalized data).

## References

- [Ambiguity Trap Discussion](../EMBEDDER_PAYLOAD_REDESIGN.md#critical-flaw-the-ambiguity-trap)
- [Chunk Schema](src/schemas/NormalizedChunkSchema.ts)
- [Extraction Logic](src/steps/2-embed/utils/extractEmbeddingText.ts)
- [Embedder Main](src/steps/2-embed/embedder.ts)
