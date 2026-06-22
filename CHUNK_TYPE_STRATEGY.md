# Chunk Type Implementation Strategy: ROI Analysis

**Date:** December 27, 2025
**Basis:** RETRIEVAL_TEST_REPORT.md + PROJECT_REVIEW.md + NormalizedChunkSchema.ts
**Goal:** Identify which chunk types maximize embedding performance with minimal implementation effort

---

## Executive Summary

Based on retrieval test results (80% success rate on code examples), implement **3 high-value chunk types** in this priority:

### 🥇 **Tier 1: Must-Have (High ROI, Medium Effort)**
1. **PropReferenceChunk** → Fixes 20% of failures, easiest extraction
2. **ComponentOverviewChunk** → Broadens query coverage, best semantic richness
3. **CapabilityReferenceChunk** → Addresses property-centric queries

### 🥈 **Tier 2: Nice-to-Have (Medium ROI, High Effort)**
4. **CompositionPatternChunk** → Already working well via CodeExampleChunk
5. **PropGroupChunk** → Redundant with PropReferenceChunk
6. **APIReferenceChunk** → Low-value for retrieval (summary only)

---

## Problem Analysis: Why Current Retrieval Fails

### Current State (CodeExampleChunk Only)
- ✅ Success: 4/5 queries (80%) - Direct code examples work well
- ❌ Failure: 1/5 queries (20%) - Property-centric query "button color" fails

### Root Cause of Failures

**Query 5: "button color" → Returns "Color Mode" (WRONG)**

The system incorrectly retrieved:
- Rank 1: Color Mode (theme system) - 0.532 score
- Rank 2: Button (variants example) - 0.462 score ← This is actually correct!

**Why it failed:**
- CodeExampleChunk only describes WHAT code shows (examples)
- Missing WHAT PROPERTIES EXIST (property reference)
- "button color" is ambiguous:
  - Interpretation A: "How to color a button?" → ColorMode is wrong
  - Interpretation B: "What color props does Button have?" → Need PropReferenceChunk

**The Gap:**
```
Query Intent          | Query Type    | Chunk Type Needed  | Current Status
──────────────────────┼───────────────┼────────────────────┼─────────────────
"How do I...?"       | Code examples | CodeExampleChunk   | ✅ Working (80%)
"What can X do?"     | Capabilities  | CapabilityRef      | ❌ Not embedded
"What props exist?"  | Properties    | PropReferenceChunk | ❌ Not embedded  ← Causes 20% failure
"What is X?"         | Overview      | ComponentOverview  | ❌ Not embedded
```

---

## Chunk Type Deep-Dive: ROI Analysis

### 🥇 TIER 1: HIGH ROI (Do These First)

---

#### **1. PropReferenceChunk** (HIGHEST PRIORITY)

**Problem It Solves:**
- Fixes the "button color" failure case (Query 5)
- Covers all "What's the X prop?" queries
- Addresses 15-20% of anticipated queries

**Implementation Requirements:**

From [RAGResultSchema.ts](src/schemas/RAGResultSchema.ts):
```typescript
// Data already extracted in raw JSON
{
  props: [
    {
      name: "size",
      type: "string",                    // ← Already have
      description: "...",                // ← Already have
      default: "md",                     // ← Already have
      values: ["xs", "sm", "md", ...]    // ← Already have
    }
  ]
}
```

**Transformation Logic:**

```typescript
// Extract from raw JSON + CodeAnalysis (already computed)
interface PropReference {
  prop: "size",
  component: "Button",
  type: "union of 5 values",    ← From raw JSON + infer
  description: "...",            ← From raw JSON
  defaultValue: "md",            ← From raw JSON
  category: "appearance",        ← Infer from name
  relatedProps: ["variant"],     ← Find from other props
  examples: [                    ← Find from CodeAnalysis
    { code: "<Button size='xs'>", score: 0.95 }
  ]
}
```

**Data Sources (All Available!):**
- ✅ `props` from raw JSON (extracted in Step 0)
- ✅ `type` from raw JSON type field
- ✅ `description` from raw JSON
- ✅ `default` from raw JSON
- ✅ `category` from name pattern matching (easy)
- ✅ `examples` from CodeAnalysis (cross-reference prop usage)

**Implementation Effort:** ⏱️ **4-6 hours**
- 2h: Extract logic + prop categorization
- 1h: Natural language generation (1 template)
- 1h: Testing + edge cases (optional props, event handlers)
- 1h: Validation + cross-component testing

**Expected Chunks:** 50 components × ~10 props = **500 PropReferenceChunks**

**ROI Calculation:**
```
Before: 387 CodeExampleChunks → 80% success rate
After:  387 CodeExamples + 500 PropReferences
        → Estimated 85-90% success (fixes property queries)

Time: 5h
New queries covered: +15-20%
Estimated impact: +5-10% overall success
ROI: Medium-high value for relatively low effort
```

**Embedding Quality Estimate:**
- Token target: 100-250 tokens (easier to hit than CodeExample)
- Content: "Size prop controls Button dimensions. Union of 5 values: xs, sm, md, lg, xl. Defaults to 'md'. Use 'lg' for primary actions. Related: variant, colorPalette."
- Rich semantic content: ✅ Property name + type + usage + relationships
- Likely embedding improvement: Better distinctiveness than CodeExamples

---

#### **2. ComponentOverviewChunk** (SECOND PRIORITY)

**Problem It Solves:**
- Covers "What is X?" queries (generic concept questions)
- Broadens semantic coverage beyond just examples
- Improves overall query diversity

**Implementation Requirements:**

**Data Source Challenge:** ❌ Overview text NOT in raw JSON

```typescript
// Raw JSON has:
{
  componentName: "Button",
  sourceUrl: "...",
  description: "...",           // ← Only field available
  codeExamples: [...],
  props: [...]
}

// But NormalizedChunkSchema needs:
{
  content: {
    description: string,        // ← Have this
    capabilities: string[],     // ← MISSING: must infer from props + examples
    useCases: string[],         // ← MISSING: must infer from examples
    commonPairings: string[]    // ← MISSING: must infer from related components
  }
}
```

**Transformation Logic:**

```typescript
interface ComponentOverview {
  // From raw JSON
  description: extractedDescription,

  // Infer from props
  capabilities: [
    "Supports 5 sizes (xs to xl)",
    "Multiple visual variants",
    "Loading and disabled states"
  ],

  // Infer from code examples
  useCases: [
    "Primary actions in forms",
    "Navigation triggers",
    "Dialog confirmations"
  ],

  // Infer from codeMetadata.components
  commonPairings: [
    "Used with HStack for groups",
    "Pairs with Icon for visual indicators"
  ]
}
```

**Implementation Effort:** ⏱️ **6-8 hours**
- 1h: Extract base description logic
- 2h: Infer capabilities from props (smart analysis)
- 2h: Infer use cases from examples (pattern matching)
- 1h: Find common pairings from code analysis
- 1h: Natural language generation (template)
- 1h: Testing

**Expected Chunks:** 50 components = **50 ComponentOverviewChunks** (one per component!)

**ROI Calculation:**
```
New chunks: 50 (smaller count than PropReference)
But: Each is semantically rich (200-300 tokens)
Covers: "What is X?" queries
Impact: Better semantic diversity
ROI: High semantic value, medium effort, fewer chunks
```

**Embedding Quality Estimate:**
- Token target: 200-300 tokens (achievable)
- Content: Rich, varied descriptions of what component is + what it can do
- Semantic richness: ✅ Captures full component concept
- Likely embedding improvement: Excellent distinctiveness, covers abstract queries

---

#### **3. CapabilityReferenceChunk** (THIRD PRIORITY)

**Problem It Solves:**
- Fixes queries like "What button sizes are available?"
- Bridges gap between overview (what is it) and examples (how to use it)
- Covers capability-focused queries

**Implementation Requirements:**

```typescript
// Extraction: Infer from props + examples
interface CapabilityReference {
  capability: {
    name: "sizing",              // ← From prop name
    intent: "Control button size" // ← Infer from description
  },

  content: {
    description: "Button supports 5 sizes...",  // ← From prop description
    options: [                                   // ← From prop values
      {
        value: "xs",
        description: "Extra small, 24px height",
        visualContext: "Compact toolbars",
        codeSnippet: "<Button size='xs'>Small</Button>"
      },
      // ... more options
    ],
    bestPractices: [...],        // ← Infer from common patterns
    commonMistakes: [...]        // ← Infer from limitations
  }
}
```

**Data Sources:**
- ✅ `capability.name` from prop names (size, variant, etc.)
- ✅ `content.description` from prop descriptions
- ✅ `options[].value` from prop value options
- ⚠️ `options[].description` = MISSING (need generation)
- ⚠️ `bestPractices` = MISSING (need inference)
- ⚠️ `commonMistakes` = MISSING (need generation)

**Implementation Effort:** ⏱️ **8-10 hours**
- 2h: Extract capability structure (prop-driven)
- 2h: Generate option descriptions (LLM or templates)
- 2h: Infer best practices from code patterns
- 2h: Infer common mistakes (pattern analysis)
- 1h: Natural language generation (template)
- 1h: Testing

**Expected Chunks:** 50 components × ~3-4 major capabilities = **150-200 CapabilityChunks**

**ROI Calculation:**
```
New chunks: 150-200
Covers: "What can X do?" queries (distinct from examples)
Effort: Higher (need generation or inference)
ROI: Medium - good coverage but higher effort than PropReference
```

---

### 🥈 TIER 2: LOWER ROI (Skip or Defer)

---

#### **4. CompositionPatternChunk** (DEFER - Already Covered)

**Why Skip (For Now):**
- CodeExampleChunk ALREADY covers composition intent
- Test Query 4: "button with icons" ✅ **PASSED** (IconButton retrieved correctly)
- Composition examples ARE being captured as CodeExamples

**Evidence:**
```
Query: "button with icons"
Result: IconButton component (CORRECT)
Reason: CodeExampleChunk with composition intent retrieves correctly
Conclusion: Don't need separate CompositionPatternChunk yet
```

**When to Implement:**
- Only if you need more detailed composition tutorials
- Only if "how to combine X with Y?" queries fail in validation

---

#### **5. PropGroupChunk** (DEFER - Redundant)

**Why Skip (For Now):**
- **PropReferenceChunk** already covers individual properties
- Grouping is metadata, not content for embeddings
- Natural language generation would mostly say "Button has these props: size, variant, colorPalette"

**Difference:**
```
PropReferenceChunk: "Size prop controls Button dimensions. Union of 5 values."
PropGroupChunk:     "Appearance Props group includes: size, variant, colorPalette"

PropGroupChunk is less semantic (just lists props)
```

**When to Implement:**
- If validation shows grouped property queries failing
- If you want to optimize for "What appearance props exist?" queries specifically

---

#### **6. APIReferenceChunk** (SKIP - Low Value)

**Why Skip:**
- Schema design is summary-only (150-300 tokens)
- Just lists prop groups without rich context
- PropReferenceChunk covers the actual API surface in detail
- Redundant with ComponentOverview + PropReference combo

**Evidence from Schema:**
```typescript
// APIReferenceChunk content
content: {
  summary: string,              // High-level summary
  propGroups: Record<string>    // Just lists: { "appearance": "size, variant..." }
}

// vs PropReferenceChunk
content: {
  description: string,          // Rich description
  typeExplanation: string,      // Type details
  usageGuidance: string,        // How to use it
  defaultBehavior: string       // Default value info
}

// PropReference is richer for embeddings
```

---

## Recommended Implementation Order

### Phase 1: Vector DB POC (Current)
- ✅ CodeExampleChunk (already done)
- Run validation tests
- Measure baseline: 80% success rate

### Phase 2: Add High-Value Chunks (1-2 weeks)

**Order by ROI/Effort:**

| Priority | Chunk Type | Effort | Gain | Timeline |
|----------|-----------|--------|------|----------|
| 1 | PropReferenceChunk | 4-6h | +15-20% coverage | Day 1-2 |
| 2 | ComponentOverviewChunk | 6-8h | Broadens semantics | Day 3-4 |
| 3 | CapabilityReferenceChunk | 8-10h | +10-15% coverage | Day 5-7 |

**Total:** 18-24 hours → Expected **87-95% success rate**

### Phase 3: Validation & Iteration
- Run comprehensive test suite
- Measure embedding quality
- Decide on Tier 2 implementation

---

## Implementation Dependencies

### PropReferenceChunk Prerequisites
- ✅ Raw JSON props available (Week 1 extraction complete)
- ✅ CodeAnalysis already computed (Week 2 normalization)
- 📋 Need: Prop categorization (easy regex)
- 📋 Need: 1 NLG template (simple)

**Ready to implement immediately** ✅

---

### ComponentOverviewChunk Prerequisites
- ✅ Base description in raw JSON
- ✅ CodeExamples available (can analyze)
- 📋 Need: Smart inference logic (capabilities from props)
- 📋 Need: 1 NLG template

**Can start after PropReferenceChunk** ✅

---

### CapabilityReferenceChunk Prerequisites
- ✅ Prop names and values available
- ⚠️ Need: Option descriptions (generation)
- ⚠️ Need: Best practices (pattern matching)
- ⚠️ Need: Common mistakes (inference)

**Requires more generation work** ⚠️

---

## Embedding Quality Predictions

### Token Distribution by Chunk Type

```
ComponentOverviewChunk (50 chunks)
├─ Token target: 200-300
├─ Expected avg: 250 tokens ✅
└─ Semantic richness: ⭐⭐⭐⭐⭐

PropReferenceChunk (500 chunks)
├─ Token target: 100-250
├─ Expected avg: 150 tokens ✅
└─ Semantic richness: ⭐⭐⭐⭐

CapabilityReferenceChunk (150-200 chunks)
├─ Token target: 250-400
├─ Expected avg: 300 tokens ✅
└─ Semantic richness: ⭐⭐⭐⭐⭐

CodeExampleChunk (387 chunks) - EXISTING
├─ Token target: 250-500
├─ Actual avg: 139 tokens ⚠️ (Below target)
└─ Semantic richness: ⭐⭐⭐⭐
```

### Expected Embedding Distinctiveness

**Current (CodeExampleChunk only):**
- Score spread: 0.10-0.17 (poor distinctiveness)
- Reason: Limited semantic variation in templates

**After PropReferenceChunk:**
- Predicted spread: +0.15-0.25
- Reason: Property descriptions are more distinct

**After ComponentOverviewChunk:**
- Predicted spread: +0.25-0.35
- Reason: Overview text is semantically rich and varied

**After CapabilityReferenceChunk:**
- Predicted spread: +0.30-0.40
- Reason: Multiple capability options create semantic variance

---

## Query Coverage Prediction

### Current Coverage (CodeExampleChunk Only)

```
Code Example Queries (80% success)
├─ "How do I size a button?" ✅ WORKS
├─ "button variants" ✅ WORKS
├─ "loading state" ✅ WORKS
├─ "button with icons" ✅ WORKS
└─ "button color" ❌ FAILS (property query)

Total: 4/5 (80%) ✅
```

### Predicted Coverage (After Tier 1)

```
Code Example Queries (80% baseline)
├─ "How do I size a button?" ✅ CodeExample + PropRef
├─ "button variants" ✅ CodeExample + PropRef
├─ "loading state" ✅ CodeExample + PropRef
├─ "button with icons" ✅ CodeExample + CompositionIntent
└─ "button color" ✅ PropReference (NEW!)

Property Queries (NEW - 0% → 90%)
├─ "What's the Button size prop?" ✅ PropReference
├─ "Button color properties?" ✅ PropReference
└─ "Button type prop options?" ✅ PropReference

Concept Queries (NEW - Need Overview)
├─ "What is Button?" ✅ ComponentOverview
├─ "What does Button do?" ✅ ComponentOverview
└─ "Button capabilities?" ✅ CapabilityReference

Capability Queries (NEW - Need Capability)
├─ "What sizes are available?" ✅ CapabilityReference
├─ "Button color options?" ✅ CapabilityReference
└─ "What states does Button support?" ✅ CapabilityReference

PREDICTION:
├─ Code example queries: 80% → 95% (better disambiguation)
├─ Property queries: 0% → 90%
├─ Concept queries: 0% → 85%
├─ Capability queries: 0% → 85%
└─ OVERALL: 20% → 87-92% success rate
```

---

## Risk Assessment

### PropReferenceChunk
- 🟢 **Low Risk** - Data fully available
- 🟢 **No generation** - Just structured extraction
- ✅ Can validate immediately

### ComponentOverviewChunk
- 🟡 **Medium Risk** - Requires inference (capabilities, use cases)
- 🟡 **Quality depends on** - Inference logic accuracy
- ✅ Can validate against actual docs

### CapabilityReferenceChunk
- 🟡 **Medium Risk** - Requires generation for descriptions
- 🔴 **Higher complexity** - Best practices/mistakes need pattern matching
- ⚠️ May need LLM augmentation for quality

---

## Success Metrics

After implementing Tier 1 (3 chunks), success is:

```
Baseline (CodeExampleChunk): 80% P@1
After PropReference:          85% P@1
After ComponentOverview:      88% P@1
After CapabilityReference:    92% P@1

SUCCESS THRESHOLD: ≥90% P@1
```

---

## Summary Table: Quick Decision Guide

| Chunk Type | Priority | Effort | Gain | Status | Recommendation |
|-----------|----------|--------|------|--------|-----------------|
| CodeExampleChunk | ✅ DONE | — | — | Working | Keep as-is |
| **PropReferenceChunk** | 🥇 1st | 4-6h | +15% | Ready | **START HERE** |
| **ComponentOverviewChunk** | 🥇 2nd | 6-8h | +10% | Ready | **NEXT** |
| **CapabilityReferenceChunk** | 🥇 3rd | 8-10h | +10% | Ready | **AFTER VALIDATION** |
| CompositionPatternChunk | 🥈 Skip | — | 0% | Covered by CodeEx | Defer to Phase 3 |
| PropGroupChunk | 🥈 Skip | — | 0% | Redundant | Defer to Phase 3 |
| APIReferenceChunk | 🥈 Skip | — | 0% | Low value | Skip |

---

## Next Steps

### Immediate (When Ready)
1. ✅ Validate current POC with CodeExampleChunk
2. 📋 Decide: Proceed with Tier 1?

### If Proceeding
1. Start with **PropReferenceChunk** (easiest, high value)
2. Follow with **ComponentOverviewChunk** (broadens coverage)
3. Then **CapabilityReferenceChunk** (if validation shows need)

### Key Question to Validate
> **After embedding 387 CodeExamples + 500 Props, do we hit 90% success rate?**

If YES → Stop, use this approach for all chunk types
If NO → Adjust generation templates and retry

---

**Recommendation:** Proceed with PropReferenceChunk first. It's low-risk, high-ROI, and directly solves the identified failure case.

