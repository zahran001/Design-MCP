PropReferenceChunk Normalizer Integration - Implementation Plan

**Date Created:** 2025-12-28
**Status:** 📋 Ready to Implement
**Prerequisites:** ✅ Phase 1 Complete (37/37 tests) | ✅ Phase 2a Complete (37/37 tests) | ✅ Phase 2b Complete (refactoring)
**Estimated Effort:** 2.75-3.0 hours (under original 3.5h estimate)
**Priority:** 🥇 Tier 1 - Critical Path to Vector DB POC

---

## 🎯 Overview

Integrate Phase 1 (PropReferenceTransformer) and Phase 2a (PropExplanationGenerator) into the normalization pipeline to generate **~500 PropReferenceChunks** from extracted component documentation across 50+ components.

### What This Phase Accomplishes

- ✅ Wire Phase 2a generator into Phase 1 transformer (3 lines of code)
- ✅ Create `normalizePropReferences()` orchestrator function
- ✅ Integrate into CLI pipeline alongside `normalizeCodeExamples()`
- ✅ Generate separate `{ComponentName}-props.json` files
- ✅ Per-prop error handling with Zod validation
- ✅ Statistics collection (category distribution, token counts)

---

## 🏗️ Implementation Strategy

### Design Pattern: Minimal Integration

**Key Decision:** Replicate `normalizeCodeExamples()` pattern exactly for consistency and reliability.

**Why This Approach:**
- ✅ Proven pattern: `normalizeCodeExamples()` is battle-tested
- ✅ Minimal risk: Phase 1 + 2a both production-ready with 74 passing tests
- ✅ Clean separation: Code examples vs prop references
- ✅ Reusable helpers: `findComponentFile()`, `listAvailableComponents()`

---

## 📋 Implementation Steps

### Step 1: Integrate Generator into Transformer (15 min)

**File:** [`src/steps/1-normalize/transformers/propReferenceTransformer.ts`](src/steps/1-normalize/transformers/propReferenceTransformer.ts)

**Change 1 - Add import (after line 21):**
```typescript
import { generatePropContent } from '../generators/propExplanationGenerator.js';
```

**Change 2 - Replace function call (lines 80-87):**
```typescript
// BEFORE (line 81):
const content = generateBasicPropContent(rawProp, typeInfo, category);

// AFTER (lines 80-87):
const content = generatePropContent(
  rawProp.name,
  category,
  typeInfo,
  rawProp.description,
  rawProp.defaultValue,
  rawProp.required,
  componentName
);
```

**Validation:**
```bash
npm run test -- propReferenceTransformer.test.ts
# Expected: 37/37 tests passing
```

**Impact:** Only 3 lines changed in transformer file - minimal risk.

---

### Step 2: Create normalizePropReferences() Function (60 min)

**File:** [`src/steps/1-normalize/normalizer.ts`](src/steps/1-normalize/normalizer.ts)

**Add imports (after line 18):**
```typescript
import { transformProp } from './transformers/propReferenceTransformer.js';
import {
  PropReferenceChunkSchema,
  type PropReferenceChunk,
  type PropCategory,
  getChunkTokenCount
} from '../../schemas/NormalizedChunkSchema.js';
```

**Add function (after `normalizeCodeExamples()`, ~line 292):**

#### Function Signature
```typescript
export async function normalizePropReferences(componentName?: string): Promise<void>
```

#### Key Implementation Details

**Input/Output:**
- **Input:** Read from `artifacts/raw-json/*.json` (same as code examples)
- **Output:** Write to `artifacts/normalized/{ComponentName}-props.json`

**Error Handling Strategy:**
```typescript
for (const prop of rawData.props) {
  try {
    const chunk = transformProp(prop, componentName, sourceUrl, allProps);

    // Zod validation
    const validation = PropReferenceChunkSchema.safeParse(chunk);
    if (!validation.success) {
      console.warn(`   ✗ Validation failed for prop "${prop.name}"`);
      validationErrors++;
      continue;
    }

    propChunks.push(validation.data);
  } catch (error) {
    console.warn(`   ✗ Transform error for prop "${prop.name}"`);
    totalErrors++;
  }
}
```

**Console Output Format:**
```
=================================================================
Prop Reference Normalization Pipeline
=================================================================

📂 Processing single component: Button
   Processing: Button (9 props)
   💾 Saved 9 chunks to Button-props.json
   ✅ Transformed 9/9 props

=================================================================
Summary Statistics
=================================================================

Total Props Processed: 9
Category Distribution:
  - appearance: 3
  - state: 2
  - events: 2
  - composition: 2

Token Statistics:
  - Average: 145 tokens
  - Range: 120-180 tokens
  - Warnings: 0 (all within 100-250 range)

Error Summary:
  - Transform Errors: 0
  - Validation Errors: 0
  - Success Rate: 100%
```

**Statistics to Track:**
1. Total props processed
2. Props per component (Map)
3. Category distribution (appearance, state, events, accessibility, composition, behavior)
4. Token count validation (average, range, warnings for <100 or >250)
5. Error counts (transform errors + validation errors)

**Pattern to Follow:**
- Use exact same structure as `normalizeCodeExamples()` (lines 53-259)
- Reuse `findComponentFile()` helper
- Reuse `listAvailableComponents()` helper
- Per-prop try/catch (one bad prop doesn't stop component)
- Graceful degradation with clear error messages

---

### Step 3: Update CLI Integration (10 min)

**File:** [`src/index.ts`](src/index.ts)

**Change 1 - Update import (line 5):**
```typescript
import { normalizeCodeExamples, normalizePropReferences } from "./steps/1-normalize/normalizer.js";
```

**Change 2 - Update description (line 46):**
```typescript
.description("Normalize code examples and prop references for one or all components")
```

**Change 3 - Update action handler (lines 47-59):**
```typescript
.action(async (component?: string) => {
  console.log();
  try {
    await normalizeCodeExamples(component);
    console.log();
    await normalizePropReferences(component);
    console.log();
    console.log("✅ Normalization completed successfully!");
  } catch (error) {
    console.error();
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ Error during normalization:", errorMessage);
    process.exit(1);
  }
});
```

---

### Step 4: Integration Testing (30 min)

**Test Sequence:**

#### 1. Build Verification
```bash
npm run build
```
**Expected:** No TypeScript errors

#### 2. Unit Tests
```bash
npm run test -- propReferenceTransformer.test.ts  # 37/37
npm run test -- propExplanationGenerator.test.ts   # 37/37
```
**Expected:** All 74 tests passing

#### 3. Single Component Test
```bash
npm run cli -- 1-normalize Button
```

**Expected Output Structure:**
- `artifacts/normalized/Button.json` (code examples - existing)
- `artifacts/normalized/Button-props.json` (props - **NEW**)

#### 4. Verify Output
```bash
# Check chunk count
cat artifacts/normalized/Button-props.json | jq 'length'
# Expected: 9

# Check structure
cat artifacts/normalized/Button-props.json | jq '.[0] | keys'
# Expected: Shows PropReferenceChunk fields
```

#### 5. Full Normalization
```bash
npm run cli -- 1-normalize
```
**Expected:**
- ~50 components processed
- ~500 total props generated
- All chunks pass Zod validation
- Token counts mostly in 100-250 range

**Quality Gates:**
- ✅ Build succeeds with no TypeScript errors
- ✅ All 74 tests pass (37 transformer + 37 generator)
- ✅ `Button-props.json` created with valid structure
- ✅ All chunks pass Zod validation
- ✅ Token counts mostly in 100-250 range (warnings logged for outliers)
- ✅ Category distribution shows all 6 categories
- ✅ Error rate <5%

---

### Step 5: Edge Case Testing (20 min)

**Test Scenarios:**

#### 1. Component with No Props
```bash
npm run cli -- 1-normalize Composition
```
**Expected:** "⚠️ No props found, skipping"

#### 2. Large Union (colorPalette)
**Verify:** Refinement A truncation works correctly
- Check chunks with union types >10 options
- Expected format: "Accepts one of X predefined values: a, b, c, d, e...and X others"

#### 3. Boolean Without Default
**Verify:** Refinement B honest defaults
- Check boolean props without explicit defaults
- Expected: "Optional boolean prop. Refer to component examples for default behavior."

#### 4. Malformed JSON File
**Test:** Create invalid JSON in `artifacts/raw-json/test-invalid.json`
- Expected: Error logged, continue to next file without crashing

---

### Step 6: Documentation (30 min)

**Update:** [`PropReferenceChunk-Docs/PROP_REFERENCE_CHUNK_PLAN.md`](PropReferenceChunk-Docs/PROP_REFERENCE_CHUNK_PLAN.md)

#### Mark Phase 3 Complete
```markdown
| **3a** | `normalizer.ts` (modify) | 1.0h | ✅ **COMPLETE** | ...
```

#### Add Implementation Notes Section

Document:
- Generator integration approach (3 lines changed in transformer)
- Normalizer function structure (~120 lines added)
- CLI integration (sequential execution)
- Output structure (separate `-props.json` files)
- Statistics collected
- Error handling strategy

---

## 📁 Critical Files

### Files to Modify (3 total)

1. **[`src/steps/1-normalize/transformers/propReferenceTransformer.ts`](src/steps/1-normalize/transformers/propReferenceTransformer.ts)**
   - Line 22: Add import
   - Lines 80-87: Replace function call
   - **Changes:** 3 lines

2. **[`src/steps/1-normalize/normalizer.ts`](src/steps/1-normalize/normalizer.ts)**
   - Line 19: Add imports
   - Line 292: Add new function (~120 lines)
   - **Changes:** ~125 lines added

3. **[`src/index.ts`](src/index.ts)**
   - Line 5: Update import
   - Line 46: Update description
   - Lines 47-59: Update action handler
   - **Changes:** 5 lines

4. **[`PropReferenceChunk-Docs/PROP_REFERENCE_CHUNK_PLAN.md`](PropReferenceChunk-Docs/PROP_REFERENCE_CHUNK_PLAN.md)**
   - Update phase tracker table
   - Add implementation notes
   - **Changes:** ~50 lines

### Files to Reference (No Changes)

- [`src/steps/1-normalize/generators/propExplanationGenerator.ts`](src/steps/1-normalize/generators/propExplanationGenerator.ts) - Phase 2a generator
- [`src/steps/1-normalize/config/prop-templates.ts`](src/steps/1-normalize/config/prop-templates.ts) - Template config
- [`src/schemas/NormalizedChunkSchema.ts`](src/schemas/NormalizedChunkSchema.ts) - Validation schemas
- [`src/utils/chunkId.js`](src/utils/chunkId.js) - Chunk ID generation

---

## ✅ Success Metrics

| Metric | Target | Validation |
|--------|--------|------------|
| Chunks generated | ~450-500 | Count props across all components |
| Average tokens | 120-180 | Calculate from `getChunkTokenCount()` |
| Token compliance | >90% | Chunks in 100-250 range |
| Validation success | 100% | All chunks pass Zod schema |
| Category coverage | All 6 | Check distribution report |
| Error rate | <5% | Errors / total props |
| Test pass rate | 100% | 74/74 tests passing |

---

## ⚠️ Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Tests break | Low | High | Only 3 lines change, immediate test validation |
| Schema validation fails | Low | Medium | Phase 1 tests validate structure |
| Token counts out of range | Medium | Low | Log warnings, Refinement A prevents explosion |
| Components with no props | High | Low | Skip gracefully with warning |

**Overall Risk:** 🟢 **LOW** (most work complete and tested)

---

## ⏱️ Timeline

| Step | Time | Complexity |
|------|------|-----------|
| 1. Generator integration | 15 min | Low |
| 2. Normalizer function | 60 min | Medium |
| 3. CLI update | 10 min | Low |
| 4. Integration testing | 30 min | Medium |
| 5. Edge case testing | 20 min | Low |
| 6. Documentation | 30 min | Low |
| **Total** | **2.75 hrs** | **Medium** |
| **Buffer** | **15 min** | - |
| **Total with buffer** | **3.0 hours** | - |

---

## 🎨 Key Design Patterns

### Error Handling
- Per-prop try/catch (one bad prop doesn't stop component)
- Zod validation before saving
- Clear error context (component + prop + error)
- Statistics tracking for errors

### Statistics Collection
- Use Map for per-component counts
- Track category distribution
- Calculate token statistics (avg, min, max)
- Log warnings for outliers

### Console Output
- Same format as `normalizeCodeExamples()`
- Emoji prefixes: 📁 📂 💾 ✅ ❌ ⚠️
- Section headers with `=` separators
- Summary tables for distribution

### File Structure
```
artifacts/normalized/
├── Button.json              # Code examples (existing)
├── Button-props.json        # Props (NEW)
├── Checkbox.json            # Code examples (existing)
├── Checkbox-props.json      # Props (NEW)
└── ...
```

---

## 🚀 Next Steps After Phase 3

**Phase 4: Full Test Suite Validation (30 min)**
- Run all unit tests
- Verify ~500 chunks generated
- Check token statistics (100-250 range)
- Zero validation errors

**Phase 5: Final Documentation Updates (30 min)**
- Update README.md with Phase 3 completion
- Add implementation notes
- Quick reference guide

**Post-Implementation: Vector DB POC**
- Embedding generation for combined chunks (code examples + props)
- Vector store integration
- Basic search implementation

---

## 📝 Implementation Notes

### Critical Decisions

1. **Generator Integration Point:** Line 81 in `propReferenceTransformer.ts`
   - Replace placeholder `generateBasicPropContent()` with production `generatePropContent()`
   - Only 3 lines of code change

2. **Normalizer Pattern:** Follow `normalizeCodeExamples()` exactly
   - Read from `artifacts/raw-json/*.json`
   - Transform with `transformProp()`
   - Validate with `PropReferenceChunkSchema.safeParse()`
   - Write to `artifacts/normalized/{ComponentName}-props.json`

3. **Error Handling:** Per-prop graceful degradation
   - One bad prop doesn't stop component processing
   - Log warnings with context
   - Continue to next prop

4. **Statistics:** Category distribution + token validation
   - Track all 6 categories (appearance, state, events, accessibility, composition, behavior)
   - Calculate token stats (avg, min, max)
   - Warn for outliers (<100 or >250 tokens)

### Testing Strategy

**Unit Tests (existing):**
- 37 transformer tests
- 37 generator tests
- All passing before Phase 3

**Integration Tests (new):**
- Single component test (Button - 9 props)
- Full normalization (~500 props)
- Edge case validation

**Quality Gates:**
- Build succeeds
- All 74 tests pass
- 100% Zod validation success
- >90% token compliance
- <5% error rate

---

## 🎯 Deliverables

After Phase 3 completion, you will have:

- ✅ **~500 PropReferenceChunks** generated across 50+ components
- ✅ **100% Zod validation** success rate
- ✅ **Separate prop files** for each component (`{ComponentName}-props.json`)
- ✅ **Statistics dashboard** showing category distribution and token compliance
- ✅ **Error handling** with graceful degradation (<5% error rate)
- ✅ **CLI integration** with single command for all normalization
- ✅ **Documentation** updated with implementation details

**Ready for Vector DB POC:** Combined code examples + props for embedding and search.

---

## 📞 Support

For questions or issues during implementation:
- Review the detailed plan file at `C:\Users\minha\.claude\plans\glittery-leaping-lake.md`
- Check Phase 1+2a test files for reference patterns
- Review existing `normalizeCodeExamples()` implementation

---

**Status:** 📋 Ready to implement when approved
**Last Updated:** 2025-12-28
**Next Step:** User approval to proceed with Step 1
