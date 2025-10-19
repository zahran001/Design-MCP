# Data Normalization Guide: Phase 1 Implementation

**Status:** 🎯 Ready to Start
**Phase:** Week 2 - Milestone 2A.1 (Advanced Normalization)
**Duration:** Days 8-9 (16 hours estimated)
**Prerequisites:** ✅ Week 1 Complete (50 components in `artifacts/raw-json/`)

---

## Executive Summary

This guide implements an **expert-level normalization strategy** optimized for LLM retrieval quality. Unlike the basic chunking approach in [WEEK2_IMPLEMENTATION.md](WEEK2_IMPLEMENTATION.md), this approach creates **semantically rich, intent-based chunks** that maximize embedding effectiveness.

### What This Achieves

Transform raw extracted data → **500-1500 semantically meaningful chunks** optimized for:
- ✅ Intent-based retrieval ("How do I make a button larger?")
- ✅ Natural language embeddings (not just structured data dumps)
- ✅ Self-contained context (each chunk answers one question completely)
- ✅ Optimal chunk sizes (200-500 tokens for embedding models)
- ✅ Inferred metadata (fixing 60% missing section labels)

### Key Innovation: Dual Content Strategy

```typescript
// For embedding (natural language)
content: {
  description: "Button size prop accepts 7 values from 2xs to 2xl, controlling button height and padding"
}

// For LLM accuracy (structured reference)
apiReference: {
  type: { kind: "union", options: ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"] }
}
```

---

## Success Criteria (Transparent Goals)

### Phase 1: Foundation & Validation (Week 1-2)

**Goal:** Build CodeExampleChunk transformation for Button component

#### Success Metrics

| Metric | Target | Measurement | Priority |
|--------|--------|-------------|----------|
| **Chunk Quality** | 95%+ chunks have inferred sections | Manual review of 20 Button examples | 🔴 Critical |
| **Natural Language** | All chunks have human-readable explanations | Automated: check `content.explanation` exists | 🔴 Critical |
| **Inference Accuracy** | 90%+ section titles are semantic | Compare inferred vs manual titles | 🔴 Critical |
| **Chunk Size** | 90%+ chunks are 200-500 tokens | Automated: `estimateTokens(content)` | 🟡 Important |
| **Intent Classification** | 85%+ intents correctly identified | Manual review of intent tags | 🟡 Important |
| **Prop Extraction** | 100% props extracted from code | Automated: compare to pattern matches | 🟢 Nice to have |

#### Deliverables

- [x] **Schema Definition** (`src/schemas/NormalizedChunkSchema.ts`)
  - ✅ TypeScript interfaces for 7 chunk types
  - ✅ Zod validation schemas
  - ✅ Supporting types (ImportStatement, PropUsage, TypeInfo)

- [x] **Inference Engine** (`src/steps/1-normalize/inference/`)
  - ✅ `sectionInferrer.ts` - Generate section titles from code patterns
  - ✅ `intentClassifier.ts` - Classify intent (sizing, variants, states, etc.)
  - ✅ `codeAnalyzer.ts` - Extract imports, components, prop usage
  - ✅ `difficultyScorer.ts` - Calculate basic/intermediate/advanced

- [x] **Natural Language Generator** (`src/steps/1-normalize/generators/`)
  - ✅ `explanationGenerator.ts` - Generate content.explanation
  - ✅ `keyPointsGenerator.ts` - Generate content.keyPoints
  - ✅ `demonstratesGenerator.ts` - Generate content.demonstrates

- [x] **Transform Pipeline** (`src/steps/1-normalize/transformers/`)
  - ✅ `codeExampleTransformer.ts` - Main transformation orchestrator

- [x] **Integration** (`src/steps/1-normalize/normalizer.ts`)
  - ✅ CLI command: `npm run cli -- 1-normalize-code-examples`
  - ✅ Output: `artifacts/normalized/Button-code-examples.json`

#### Validation Checkpoints

**Day 3 Checkpoint:**
```bash
# Test section inference on 5 Button examples
npm run test:inference

# Expected output:
# ✅ Example 1: "Size Variants" (inferred from size= prop)
# ✅ Example 2: "Visual Variants" (inferred from variant= prop)
# ✅ Example 3: "Loading States" (inferred from loading prop)
# ✅ Example 4: "Button with Icons" (inferred from Icon component)
# ✅ Example 5: "Interactive Example" (inferred from onClick/useState)
```

**Day 7 Checkpoint:**
```bash
# Transform Button component end-to-end
npm run cli -- 1-normalize-code-examples Button

# Manual validation:
# 1. Open artifacts/normalized/Button-code-examples.json
# 2. For 3 random chunks, verify:
#    - Explanation accurately describes code
#    - Key points are factually correct
#    - Inferred section is semantic
#    - Intent classification is accurate
#    - Chunk size is 200-500 tokens
```

---

### Phase 2: Expand Coverage (Week 3-4)

**Goal:** Add CapabilityReferenceChunk and PropReferenceChunk, process 5 components

#### Success Metrics

| Metric | Target | Measurement | Priority |
|--------|--------|-------------|----------|
| **Capability Extraction** | 5-7 capabilities per component | Count capabilities for Button, Checkbox, Input | 🔴 Critical |
| **Type Parsing** | 100% type unions parsed correctly | Validate `typeInfo.options` arrays | 🔴 Critical |
| **Prop Categorization** | 90%+ props correctly categorized | Manual review of appearance/state/events | 🟡 Important |
| **Natural Language Types** | All props have `typeExplanation` | Automated: check field exists | 🟡 Important |
| **Components Processed** | 5 components (Button, Checkbox, Input, Heading, Field) | Count normalized files | 🟢 Nice to have |

#### Deliverables

- [x] **Capability Extraction** (`src/steps/1-normalize/extractors/capabilityExtractor.ts`)
  - Synthesize capabilities from props + examples
  - Generate natural language descriptions
  - Extract option values and defaults

- [x] **Prop Transformation** (`src/steps/1-normalize/transformers/propTransformer.ts`)
  - Parse type unions, objects, functions
  - Categorize props (appearance, state, events, composition)
  - Generate natural language type explanations

- [x] **Batch Processing** (`src/steps/1-normalize/batch.ts`)
  - Process multiple components in one run
  - Progress reporting
  - Error handling and recovery

#### Validation Checkpoints

**Week 3 End:**
```bash
# Process 5 components
npm run cli -- 1-normalize-batch Button Checkbox Input Heading Field

# Validation queries (manual):
# Query: "What sizes does Button support?"
# Expected: Retrieve CapabilityReferenceChunk with 7 size options
#
# Query: "What's the type of the size prop?"
# Expected: Retrieve PropReferenceChunk with union type explanation
```

---

### Phase 3: Complete & Scale (Week 5-6)

**Goal:** Add remaining chunk types, process all 50 components

#### Success Metrics

| Metric | Target | Measurement | Priority |
|--------|--------|-------------|----------|
| **Total Chunks** | 500-1500 chunks | Count in final output | 🔴 Critical |
| **Chunk Type Distribution** | All 7 types represented | Breakdown by chunkType | 🔴 Critical |
| **Processing Speed** | <5 minutes for 50 components | Time batch processing | 🟡 Important |
| **Error Rate** | <5% components fail | Error logs during batch run | 🟡 Important |
| **Retrieval Quality** | 80%+ precision on test queries | Manual evaluation (see below) | 🔴 Critical |

#### Deliverables

- [x] **All Chunk Types** (`src/steps/1-normalize/transformers/`)
  - `componentOverviewTransformer.ts`
  - `propGroupTransformer.ts`
  - `compositionPatternTransformer.ts`
  - `apiReferenceTransformer.ts`

- [x] **Full Pipeline** (`src/steps/1-normalize/pipeline.ts`)
  - Orchestrate all transformers
  - Handle component type detection (simple vs composite)
  - Error recovery and logging

- [x] **Quality Metrics** (`src/steps/1-normalize/quality.ts`)
  - Token size distribution
  - Chunk type counts
  - Inference confidence scores
  - Coverage reports

#### Final Validation

**Test Query Evaluation:**

Run 15 test queries and measure precision@10 (manually):

```typescript
const testQueries = [
  // Intent-based queries
  "How do I make a button larger?",
  "Show me a disabled checkbox",
  "How to add icons to buttons?",
  "What button variants are available?",
  "How to show loading state on button?",

  // Prop discovery queries
  "What props does ColorPicker accept?",
  "What's the default size for Button?",

  // Pattern/composition queries
  "How to group buttons together?",
  "How to use Checkbox in forms?",

  // State/variant queries
  "How to handle checkbox indeterminate state?",
  "What are the Heading size options?",

  // API reference queries
  "What events does Input support?",
  "What's the type of onValueChange?",

  // Edge cases
  "How to make ColorPicker inline?",
  "Button composition with other components?"
];
```

**Expected Results:**
```
Precision@10 Target: ≥80%
- Query returns 10 chunks
- Count how many are truly relevant
- Average across all 15 queries
- Should be ≥8/10 relevant on average
```

---

## Technical Architecture

### Chunk Type Strategy

```
User Question → Chunk Type Mapping

"What is X?" → ComponentOverviewChunk
"What can X do?" → CapabilityReferenceChunk
"How do I...?" → CodeExampleChunk
"What props...?" → PropReferenceChunk or PropGroupChunk
"How to combine...?" → CompositionPatternChunk
"Complete API reference?" → APIReferenceChunk
```

### Transformation Pipeline Flow

```
Raw Extract (Button.json)
    ↓
Component Type Detection
    ↓
For each applicable transformer:
    ↓
├─ ComponentOverviewTransformer
│   ├─ Extract: componentName, description
│   ├─ Infer: category, capabilities, useCases
│   └─ Generate: natural language content
│
├─ CapabilityReferenceTransformer (×5-7 per component)
│   ├─ Analyze: props + code examples
│   ├─ Infer: capability name, intent
│   ├─ Extract: option values, defaults
│   └─ Generate: natural language descriptions
│
├─ CodeExampleTransformer (×12 per component avg)
│   ├─ Infer: section title, intent, difficulty
│   ├─ Extract: imports, components, prop usage
│   ├─ Generate: explanation, demonstrates, keyPoints
│   └─ Validate: chunk size (200-500 tokens)
│
├─ PropReferenceTransformer (×9 per component avg)
│   ├─ Parse: type structure (unions, objects, functions)
│   ├─ Categorize: appearance, state, events, etc.
│   ├─ Generate: type explanation, usage guidance
│   └─ Extract: related props
│
├─ PropGroupTransformer (×3 per component avg)
│   ├─ Group: props by category
│   ├─ Generate: category overview
│   └─ Format: natural language prop summaries
│
├─ CompositionPatternTransformer (×2 per component avg)
│   ├─ Detect: patterns from relatedComponents + examples
│   ├─ Extract: steps, variations, common issues
│   └─ Generate: pattern explanation
│
└─ APIReferenceTransformer (×1 per component)
    ├─ Aggregate: all prop chunks
    ├─ Generate: complete API summary
    └─ Group: by category with natural language
    ↓
Output: 33 chunks per component avg
    ↓
Save: artifacts/normalized/{ComponentName}-chunks.json
```

### Data Flow Example: Button Size Variants

```typescript
// INPUT: Button.json codeExamples[1]
{
  code: "import { Button, HStack } from '@chakra-ui/react'...",
  section: undefined  // ❌ Missing (60% of examples)
}

// TRANSFORMATION STEPS:

// 1. Section Inference
inferSectionTitle(code, undefined)
→ Detects: code.includes('size=')
→ Returns: "Size Variants"

// 2. Intent Classification
classifyIntent(code)
→ Detects: size prop usage
→ Returns: "sizing"

// 3. Code Analysis
extractPropUsage(code)
→ Finds: <Button size="xs">, <Button size="sm">, ...
→ Returns: { component: "Button", prop: "size", values: ["xs", "sm", "md", "lg", "xl"] }

// 4. Natural Language Generation
generateExplanation(code, { intent: "sizing", ... })
→ Returns: "This example demonstrates how to control button dimensions using the size prop..."

generateKeyPoints(code, ...)
→ Returns: [
    "The size prop accepts string values: 'xs', 'sm', 'md', 'lg', 'xl'",
    "HStack with gap='6' provides consistent spacing between buttons"
  ]

// OUTPUT: CodeExampleChunk
{
  metadata: {
    chunkId: "button-example-size-variants-v1",
    chunkType: "code-example",
    componentName: "Button",
    tags: ["sizing", "layout", "button"],
    complexity: "basic"
  },

  example: {
    title: "Size Variants",  // ✅ Inferred
    intent: "sizing",        // ✅ Inferred
    difficulty: "basic"      // ✅ Calculated
  },

  content: {
    explanation: "This example demonstrates...",  // ✅ Generated
    code: "...",
    demonstrates: ["Using the size prop...", ...],  // ✅ Generated
    keyPoints: ["The size prop accepts...", ...]   // ✅ Generated
  },

  codeMetadata: {
    imports: [{ source: "@chakra-ui/react", imports: ["Button", "HStack"] }],
    props: [{ component: "Button", prop: "size", values: ["xs", "sm", "md", "lg", "xl"] }],
    hasInteractivity: false,
    complexity: 7  // From getCompositionScore
  }
}
```

---

## Implementation Phases

### Phase 1: Days 1-7 (CodeExampleChunk Only)

**Day 1: Schema Definition (2-3 hours)**

```bash
# Create schema file
touch src/schemas/NormalizedChunkSchema.ts

# Implement:
# - ChunkMetadata interface (base for all chunks)
# - CodeExampleChunk interface
# - Supporting types: ImportStatement, PropUsage
# - Zod validation schemas

# Test:
npm run build  # Should compile without errors
```

**Day 2-3: Inference Engine (6-8 hours)**

```bash
# Create inference directory
mkdir -p src/steps/1-normalize/inference

# Implement (in order):
# 1. sectionInferrer.ts
#    - Pattern matching: size= → "Size Variants"
#    - Pattern matching: variant= → "Visual Variants"
#    - Pattern matching: loading → "Loading States"
#    - Pattern matching: Icon component → "Button with Icons"
#    - Fallback: return existing section or "Usage Example"
#
# 2. codeAnalyzer.ts
#    - extractImports(code) → parse import statements
#    - extractComponentTags(code) → find JSX components
#    - extractPropUsage(code) → find all prop={value} patterns
#
# 3. intentClassifier.ts
#    - Classify into: sizing, variants, states, composition, interaction
#
# 4. difficultyScorer.ts
#    - Map composition score to basic/intermediate/advanced

# Test each function individually:
npx tsx test-inference.ts
```

**Day 4: Natural Language Generator (4-6 hours)**

```bash
mkdir -p src/steps/1-normalize/generators

# Implement:
# - explanationGenerator.ts (template-based)
# - keyPointsGenerator.ts (extract teaching moments)
# - demonstratesGenerator.ts (convert structured → natural language)

# Test with Button example:
npx tsx test-generator.ts
```

**Day 5: Transform Pipeline (4-6 hours)**

```bash
mkdir -p src/steps/1-normalize/transformers

# Implement codeExampleTransformer.ts:
export async function transformCodeExample(
  rawExample: CodeExample,
  componentName: string,
  sourceUrl: string
): Promise<CodeExampleChunk>

# Orchestrates all previous utilities
```

**Day 6-7: Integration & Validation (6-8 hours)**

```bash
# Create normalizer.ts
touch src/steps/1-normalize/normalizer.ts

# Implement CLI command
# Update src/index.ts

# Test end-to-end:
npm run cli -- 1-normalize-code-examples Button

# Manual validation:
# - Check 20 chunks
# - Verify explanations are accurate
# - Verify sections are semantic
# - Verify chunk sizes are appropriate
```

---

### Phase 2: Days 8-14 (CapabilityReference + PropReference)

**See WEEK2_IMPLEMENTATION.md for detailed breakdown**

Key additions:
- Capability extraction from props + examples
- Type parsing (unions, objects, functions)
- Prop categorization
- Natural language type explanations

---

### Phase 3: Days 15-21 (Remaining Chunks + Scale)

**See WEEK2_IMPLEMENTATION.md for detailed breakdown**

Key additions:
- Component overview chunks
- Prop group chunks
- Composition pattern detection
- API reference aggregation
- Batch processing for all 50 components

---

## File Structure

```
src/
├── schemas/
│   └── NormalizedChunkSchema.ts          # NEW - All chunk type definitions
│
├── steps/
│   └── 1-normalize/
│       ├── inference/                    # NEW - Inference utilities
│       │   ├── sectionInferrer.ts
│       │   ├── intentClassifier.ts
│       │   ├── codeAnalyzer.ts
│       │   └── difficultyScorer.ts
│       │
│       ├── generators/                   # NEW - Natural language generators
│       │   ├── explanationGenerator.ts
│       │   ├── keyPointsGenerator.ts
│       │   └── demonstratesGenerator.ts
│       │
│       ├── transformers/                 # NEW - Chunk transformers
│       │   ├── codeExampleTransformer.ts        # Phase 1
│       │   ├── capabilityReferenceTransformer.ts # Phase 2
│       │   ├── propReferenceTransformer.ts      # Phase 2
│       │   ├── componentOverviewTransformer.ts  # Phase 3
│       │   ├── propGroupTransformer.ts          # Phase 3
│       │   ├── compositionPatternTransformer.ts # Phase 3
│       │   └── apiReferenceTransformer.ts       # Phase 3
│       │
│       ├── extractors/                   # NEW - Phase 2
│       │   └── capabilityExtractor.ts
│       │
│       ├── normalizer.ts                 # NEW - Main orchestrator
│       ├── pipeline.ts                   # NEW - Phase 3
│       ├── batch.ts                      # NEW - Phase 2
│       └── quality.ts                    # NEW - Phase 3
│
└── utils/
    ├── chunkId.ts                        # NEW - Stable ID generation
    └── tokenEstimator.ts                 # NEW - Token counting

artifacts/
└── normalized/                           # NEW - Output directory
    ├── Button-code-examples.json         # Phase 1 output
    ├── Button-chunks.json                # Phase 3 output (all types)
    └── ...                               # More components

tests/
└── normalization/                        # NEW - Test suite
    ├── inference.test.ts
    ├── generators.test.ts
    └── transformers.test.ts
```

---

## Quality Assurance

### Automated Checks

```typescript
// Token size distribution
function validateChunkSizes(chunks: NormalizedChunk[]) {
  const stats = {
    tooSmall: chunks.filter(c => c.metadata.tokens < 100).length,
    optimal: chunks.filter(c => c.metadata.tokens >= 200 && c.metadata.tokens <= 500).length,
    tooLarge: chunks.filter(c => c.metadata.tokens > 800).length
  };

  console.log(`Optimal size: ${stats.optimal}/${chunks.length} (${(stats.optimal/chunks.length*100).toFixed(1)}%)`);

  // Target: 90%+ in optimal range
  return stats.optimal / chunks.length >= 0.9;
}

// Natural language coverage
function validateNaturalLanguage(chunks: CodeExampleChunk[]) {
  const missing = chunks.filter(c =>
    !c.content.explanation ||
    c.content.explanation.length < 50
  );

  // Target: 100% have explanations
  return missing.length === 0;
}

// Section inference success
function validateSectionInference(chunks: CodeExampleChunk[]) {
  const semantic = chunks.filter(c =>
    isSemanticSection(c.example.title)
  );

  // Target: 95%+ have semantic sections
  return semantic.length / chunks.length >= 0.95;
}

function isSemanticSection(title: string): boolean {
  const nonSemantic = [
    /^example \d+$/i,
    /^usage$/i,
    /^the .* jumps over .*/i  // Heading component demo text
  ];

  return !nonSemantic.some(pattern => pattern.test(title));
}
```

### Manual Review Checklist

For 20 randomly selected chunks:

```
✓ Explanation accurately describes what the code does
✓ Key points are factually correct (no hallucinations)
✓ Inferred section title is meaningful and semantic
✓ Intent classification matches the code's purpose
✓ Demonstrates list is comprehensive
✓ Chunk size is appropriate (not too verbose, not too terse)
✓ Natural language is grammatically correct
✓ Imports are correctly extracted
✓ Prop usage is complete and accurate
```

---

## Risk Mitigation

### Risk 1: Inference Quality

**Problem:** Section/intent inference may be inaccurate

**Mitigation:**
- Start with high-confidence patterns (size=, variant=, etc.)
- Build regression test suite with known examples
- Track confidence scores, flag low-confidence for manual review
- Iterate on patterns based on validation results

### Risk 2: Natural Language Generation

**Problem:** Generated explanations may be generic or inaccurate

**Mitigation:**
- Use template-based generation with variable substitution
- Extract specific details from code (prop values, components used)
- Manual review of first 50 generations
- Consider LLM-assisted generation in Phase 2 if templates insufficient

### Risk 3: Token Size Variability

**Problem:** Some chunks may be too small or too large

**Mitigation:**
- Set hard limits (100 min, 800 max)
- Split oversized chunks into multiple parts
- Combine undersized chunks where semantically appropriate
- Monitor size distribution in quality metrics

### Risk 4: Scope Creep

**Problem:** Trying to perfect too many things at once

**Mitigation:**
- Stick to ONE chunk type in Phase 1 (CodeExampleChunk)
- Time-box each step (1-2 days max)
- Use feature flags to enable/disable inference logic
- "Good enough" > "perfect" in early phases

---

## Next Steps

### Start Today (Day 1)

```bash
# 1. Create schema file
touch src/schemas/NormalizedChunkSchema.ts

# 2. Copy schema definition from this guide (see Technical Architecture)

# 3. Compile and verify
npm run build

# Expected: TypeScript compiles without errors
```

### Tomorrow (Day 2)

```bash
# 1. Create inference utilities
mkdir -p src/steps/1-normalize/inference
touch src/steps/1-normalize/inference/sectionInferrer.ts

# 2. Implement simplest inference first (section titles)

# 3. Test with one Button example
npx tsx test-inference.ts
```

### By End of Week (Day 7)

```bash
# Transform Button component end-to-end
npm run cli -- 1-normalize-code-examples Button

# Validate quality
# Expected: 18 Button examples → ~12-15 high-quality chunks
```

---

## Success Definition

**Phase 1 is successful when:**

✅ 12+ Button code example chunks generated
✅ 95%+ chunks have inferred section titles
✅ 100% chunks have natural language explanations
✅ 90%+ chunks are 200-500 tokens
✅ Manual review confirms accuracy
✅ Can retrieve correct chunk for query: "How do I make a button larger?"

**This unlocks Phase 2 and demonstrates:**
- Inference engine works
- Natural language generation works
- Transformation pipeline works
- Schema design is solid

---

## Questions or Blockers?

If you encounter issues:

1. **Schema questions:** Refer to "Technical Architecture" section above
2. **Implementation questions:** See step-by-step guide in "Implementation Phases"
3. **Quality concerns:** Use validation checklists above
4. **Scope questions:** Stick to Phase 1 deliverables, defer others to Phase 2/3

**Remember:** The goal is to prove the approach with ONE chunk type first. Don't try to build everything at once.

---

**Ready to start?** Begin with schema definition (Day 1) and let the results guide the next steps.
