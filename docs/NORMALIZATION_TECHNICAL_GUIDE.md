# Week 2 Normalization - Technical Deep-Dive

**Phase:** Week 2 Phase 2A - CodeExampleChunk Normalization
**Status:** ✅ COMPLETE - Production-Ready Transformer
**Last Updated:** 2025-11-04

**Implementation Status:**
- ✅ **CodeExampleChunk**: Fully implemented (1/7 chunk types)
- ❌ ComponentOverviewChunk, CapabilityReferenceChunk, PropReferenceChunk: Not started
- ❌ PropGroupChunk, CompositionPatternChunk, APIReferenceChunk: Not started

**Quality Metrics:**
- 470 tests passing across 15 test suites
- 387 normalized chunks from 50 components
- Configuration-driven architecture (categories, patterns, behavior)

---

## Overview

The normalization pipeline transforms raw extracted JSON (Week 1) into semantically rich, embedding-optimized chunks for vector search. This guide provides technical implementation details for the **CodeExampleChunk** transformation pipeline.

**Key Innovation:** Adds an **intelligence layer** on top of raw data through:
- Inference (section titles, intents via pattern matching)
- Classification (6 intent types, 10 component categories)
- Natural language generation (template-based explanations, key points)

---

## Architecture

### Data Flow Pipeline

```
Raw JSON (artifacts/raw-json/*.json)
         ↓
    normalizer.ts (orchestrator)
         ↓ for each component
         ↓ for each code example
         ↓
    codeExampleTransformer.ts
         ↓
    ┌────────────────────────────────┐
    │ 1. analyzeCode()               │ → Extract structure
    │ 2. inferSectionTitle()         │ → Semantic title
    │ 3. classifyIntent()            │ → Categorize purpose
    │ 4. extractTemplateData()       │ → Prepare for templates
    │ 5. generateContent()           │ → Natural language
    │ 6. Assemble chunk              │ → Complete CodeExampleChunk
    └────────────────────────────────┘
         ↓
    CodeExampleChunk (normalized)
         ↓
    Aggregate all chunks
         ↓
Output: artifacts/normalized/{ComponentName}.json (one file per component)
```

**Note:** Output changed from single aggregated file to per-component files for easier inspection and incremental processing.

### Module Organization

```
src/steps/1-normalize/
├── config/                          # 📋 Configuration system
│   ├── categories.config.ts         # Component category mappings (JSON-based)
│   ├── patterns.config.ts           # Pattern detection rules (externalized)
│   └── transformer.config.ts        # Behavior settings (thresholds, logging)
│
├── transformers/
│   └── codeExampleTransformer.ts    # ✅ Transform ONE example → ONE chunk
│
├── generators/
│   ├── templateDataExtractor.ts     # Extract data for templates
│   └── explanationGenerator.ts      # Generate natural language (6 templates)
│
├── inference/
│   ├── codeAnalyzer.ts              # Analyze code structure
│   ├── sectionInferrer.ts           # Infer section titles (12 patterns)
│   ├── intentClassifier.ts          # Classify intent (6 types)
│   └── patternMatchers.ts           # Reusable pattern matching utilities
│
├── utils/                           # Error handling & metrics
│   ├── fallbackChunks.ts            # Graceful degradation
│   ├── transformerErrors.ts         # Custom error types
│   ├── transformationContext.ts     # Metrics tracking
│   └── transformationMetrics.ts     # JSONL logging
│
├── schemas/
│   └── RawCodeExampleSchema.ts      # Input validation (Zod)
│
└── normalizer.ts                    # Main orchestrator
```

---

## Module Implementation Details

### 1. Code Analyzer (`codeAnalyzer.ts`)

**Purpose:** Extract structural metadata from raw code strings

**Location:** [src/steps/1-normalize/inference/codeAnalyzer.ts](../src/steps/1-normalize/inference/codeAnalyzer.ts)

**Key Function:**
```typescript
export function analyzeCode(code: string): CodeAnalysis
```

**Extraction Logic:**

#### Import Extraction
```typescript
// Pattern: import { A, B } from "package"
const importRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([@\w/-]+)['"]/g;

// Returns: ImportStatement[]
// Example: { source: "@chakra-ui/react", imports: ["Button", "HStack"] }
```

#### Component Extraction
```typescript
// Pattern: <ComponentName or Component.SubComponent
const componentRegex = /<([A-Z][A-Za-z0-9]*(?:\.[A-Z][A-Za-z0-9]*)*)/g;

// Handles: <Button>, <Checkbox.Root>, <Icon.Check>
// Returns: string[] (deduplicated)
```

#### Prop Usage Extraction
```typescript
// Pattern: component="value" or component='value'
const propRegex = /([a-zA-Z][a-zA-Z0-9]*)\s*=\s*[{"']([^"'}]+)["}']?/g;

// Groups prop values by component.prop
// Returns: PropUsage[]
// Example: { component: "Button", prop: "size", values: ["xs", "sm", "md"] }
```

#### Hook Detection
```typescript
// Pattern: use[A-Z]\w+
const hookRegex = /\b(use[A-Z]\w+)\b/g;

// Detects: useState, useEffect, useCustomHook
// Returns: string[]
```

#### Event Handler Detection
```typescript
// Pattern: onClick, onChange, onSubmit, etc.
const eventHandlerRegex = /\b(on[A-Z]\w+)\s*=/g;

// Returns: string[]
```

**Flags:**
- `hasInteractivity`: `eventHandlers.length > 0`
- `hasState`: `hooks.some(h => h === 'useState' || h === 'useReducer')`

**Test Coverage:** [13 tests](../src/steps/1-normalize/inference/__tests__/codeAnalyzer.test.ts)

---

### 2. Section Inferrer (`sectionInferrer.ts`)

**Purpose:** Infer semantic section titles from code patterns

**Location:** [src/steps/1-normalize/inference/sectionInferrer.ts](../src/steps/1-normalize/inference/sectionInferrer.ts)

**Key Function:**
```typescript
export function inferSectionTitle(
  code: string,
  existingSection?: string,
  componentName?: string
): SectionInference
```

**Pattern Matching Priority (High → Low Confidence):**

| Priority | Pattern | Title | Confidence |
|----------|---------|-------|------------|
| 1 | Multiple size values (≥2) | "Size Variants" | 0.95 |
| 2 | Multiple variant values (≥2) | "Visual Variants" | 0.95 |
| 3 | Multiple color values (≥3) | "Color Palettes" | 0.95 |
| 4 | Loading indicator | "Loading State" | 0.90 |
| 5 | Disabled prop | "Disabled State" | 0.90 |
| 6 | Error/invalid prop | "Error State" | 0.85 |
| 7 | Icon usage | "{Component} with Icons" | 0.85 |
| 8 | onClick + useState | "Interactive Example" | 0.80 |
| 9 | Form submission | "{Component} in Forms" | 0.80 |
| 10 | Subcomponent composition | "Composition Structure" | 0.75 |
| 11 | Existing non-generic section | Use existing | 0.60 |
| 12 | Fallback | "Usage Example" | 0.30 |

**Implementation Pattern:**
```typescript
// Example: Size Variants Detection
const sizeMatches = code.match(/size\s*=\s*["']([^"']+)["']/g);
if (sizeMatches && sizeMatches.length >= 2) {
  return {
    title: 'Size Variants',
    confidence: 0.95,
    method: 'pattern_match',
    matchedPattern: 'multiple_size_values'
  };
}
```

**Test Coverage:** [27 tests](../src/steps/1-normalize/inference/__tests__/sectionInferrer.test.ts)

---

### 3. Intent Classifier (`intentClassifier.ts`)

**Purpose:** Classify code examples by primary intent for template selection

**Location:** [src/steps/1-normalize/inference/intentClassifier.ts](../src/steps/1-normalize/inference/intentClassifier.ts)

**Key Function:**
```typescript
export function classifyIntent(
  code: string,
  analysis: CodeAnalysis,
  sectionTitle: string
): IntentClassification
```

**Intent Types (Priority-Ordered):**

| Intent | Detection Logic | Confidence |
|--------|----------------|------------|
| **sizing** | Multiple size prop values (≥2) | 0.95 |
| **variants** | Multiple variant prop values (≥2) | 0.95 |
| **states** | State props (loading, disabled, error, invalid) | 0.90 |
| **composition** | Multiple components (≥3) OR subcomponents (≥2) | 0.80-0.85 |
| **interaction** | Event handlers + state hooks | 0.65-0.80 |
| **generic** | Fallback | 0.40 |

**Composition Detection:**
```typescript
// Subcomponent pattern: Component.SubComponent
const hasSubcomponents = analysis.components.some(c => c.includes('.'));
const subcomponentCount = analysis.components.filter(c => c.includes('.')).length;

if (hasSubcomponents && subcomponentCount >= 2) {
  return {
    intent: 'composition',
    confidence: 0.85,
    indicators: ['multiple_subcomponents']
  };
}
```

**Interaction Detection:**
```typescript
// Requires BOTH event handlers AND state
const hasEventHandlers = analysis.eventHandlers.length > 0;
const hasStateManagement = analysis.hasState;

if (hasEventHandlers && hasStateManagement) {
  return {
    intent: 'interaction',
    confidence: 0.80,
    indicators: ['event_handlers', 'state_management']
  };
}
```

**Test Coverage:** [16 tests](../src/steps/1-normalize/inference/__tests__/intentClassifier.test.ts)

---

### 4. Template Data Extractor (`templateDataExtractor.ts`)

**Purpose:** Extract structured data from code analysis for template population

**Location:** [src/steps/1-normalize/generators/templateDataExtractor.ts](../src/steps/1-normalize/generators/templateDataExtractor.ts)

**Key Function:**
```typescript
export function extractTemplateData(
  intent: string,
  analysis: CodeAnalysis,
  componentName: string
): TemplateData
```

**Intent-Specific Extractors:**

#### Sizing Data
```typescript
interface SizingData {
  component: string;
  sizes: string[];           // Extracted from size prop values
  sizeCount: number;
  layoutComponent?: string;  // HStack, VStack, etc.
  layoutProps?: Record<string, string>;
}

// Example extraction:
// Input: <Button size="xs">, <Button size="lg">
// Output: { component: "Button", sizes: ["xs", "lg"], sizeCount: 2 }
```

#### Variants Data
```typescript
interface VariantsData {
  component: string;
  variants: string[];        // Extracted from variant prop values
  variantCount: number;
  otherProps: Array<{ prop: string; values: string[] }>;
}
```

#### States Data
```typescript
interface StatesData {
  component: string;
  states: Array<{ prop: string; description: string }>;
  stateCount: number;
}

// Maps state props to descriptions:
// loading → "loading indicator"
// disabled → "disabled and non-interactive"
```

#### Composition Data
```typescript
interface CompositionData {
  component: string;
  subcomponents: string[];   // e.g., ["Checkbox.Root", "Checkbox.Control"]
  pattern: string;           // "dot-notation composition"
  componentCount: number;
}
```

#### Interaction Data
```typescript
interface InteractionData {
  component: string;
  hooks: string[];           // useState, useEffect, etc.
  handlers: string[];        // onClick, onChange, etc.
  hasStateManagement: boolean;
}
```

**Defensive Programming:**
- Handles missing data gracefully
- Returns fallback values instead of throwing errors
- Always returns valid TemplateData structure

**Test Coverage:** [15 tests](../src/steps/1-normalize/generators/__tests__/templateDataExtractor.test.ts)

---

### 5. Explanation Generator (`explanationGenerator.ts`)

**Purpose:** Generate natural language content using hardcoded templates

**Location:** [src/steps/1-normalize/generators/explanationGenerator.ts](../src/steps/1-normalize/generators/explanationGenerator.ts)

**Key Function:**
```typescript
export function generateContent(templateData: TemplateData): GeneratedContent
```

**Template Structure:**

Each template generates 3 outputs:
1. **explanation**: 1-3 sentence natural language description
2. **demonstrates**: 3-5 bullet points (what the code shows)
3. **keyPoints**: 2-4 bullet points (teaching moments)

**Template Examples:**

#### Sizing Template
```typescript
function generateSizingContent(data: SizingData): GeneratedContent {
  const explanation =
    `This example demonstrates how to control ${data.component} dimensions ` +
    `using the size prop, showing ${data.sizeCount} available size options. ` +
    `The size prop accepts ${data.sizes.map(s => `"${s}"`).join(', ')} values...`;

  const demonstrates = [
    `Using the size prop to control ${data.component} dimensions`,
    `Available size values: ${data.sizes.map(s => `"${s}"`).join(', ')}`,
    // ... more points
  ];

  const keyPoints = [
    `The size prop accepts: ${data.sizes.map(s => `"${s}"`).join(', ')}`,
    // ... more points
  ];

  return { explanation, demonstrates, keyPoints };
}
```

#### Composition Template
```typescript
function generateCompositionContent(data: CompositionData): GeneratedContent {
  const explanation =
    `This example demonstrates the composition pattern for ${data.component}, ` +
    `showing how to use ${data.componentCount} subcomponents to build the complete component.`;

  const demonstrates = [
    `${data.component} composition with subcomponents`,
    ...data.subcomponents.map(sub => `Using ${sub} subcomponent`)
  ];

  return { explanation, demonstrates, keyPoints };
}
```

**Why Hardcoded Templates for POC:**
- ✅ Fast to implement (3-4 hours vs 1-2 days for LLM integration)
- ✅ No API costs
- ✅ Deterministic (same inputs = same outputs)
- ✅ Easy to test (simple string assertions)
- ✅ Sufficient to prove pipeline architecture

**Test Coverage:** [18 tests](../src/steps/1-normalize/generators/__tests__/explanationGenerator.test.ts)

---

### 6. Code Example Transformer (`codeExampleTransformer.ts`)

**Purpose:** Orchestrate transformation from raw example to CodeExampleChunk

**Location:** [src/steps/1-normalize/transformers/codeExampleTransformer.ts](../src/steps/1-normalize/transformers/codeExampleTransformer.ts)

**Key Function:**
```typescript
export function transformCodeExample(
  rawExample: RawCodeExample,
  componentName: string,
  sourceUrl: string
): CodeExampleChunk
```

**Transformation Steps:**

```typescript
// 1. Code Analysis
const analysis = analyzeCode(rawExample.code);

// 2. Section Inference
const sectionInference = inferSectionTitle(
  rawExample.code,
  rawExample.section,
  componentName
);

// 3. Intent Classification
const intentClassification = classifyIntent(
  rawExample.code,
  analysis,
  sectionInference.title
);

// 4. Template Data Extraction
const templateData = extractTemplateData(
  intentClassification.intent,
  analysis,
  componentName
);

// 5. Content Generation
const content = generateContent(templateData);

// 6. Chunk Assembly
const chunk: CodeExampleChunk = {
  metadata: {
    chunkId: generateChunkId(componentName, 'code-example', descriptor),
    chunkType: 'code-example',
    componentName,
    sourceUrl,
    tags: [intentClassification.intent],
    category: getCategoryFromComponent(componentName),
    complexity: rawExample.complexity || 'intermediate',
    relatedChunks: []
  },
  example: {
    title: sectionInference.title,
    intent: intentClassification.intent,
    difficulty: rawExample.complexity || 'intermediate'
  },
  content: {
    explanation: content.explanation,
    code: rawExample.code,
    demonstrates: content.demonstrates,
    keyPoints: content.keyPoints
  },
  codeMetadata: {
    language: rawExample.language || 'tsx',
    imports: analysis.imports.map(imp => ({ ...imp, type: 'named' as const })),
    components: analysis.components,
    props: analysis.props,
    hooks: analysis.hooks.length > 0 ? analysis.hooks : undefined,
    hasInteractivity: analysis.hasInteractivity,
    hasState: analysis.hasState,
    complexity: rawExample.score || 5
  }
};

return chunk;
```

**Category Mapping:**
```typescript
function getCategoryFromComponent(componentName: string): ComponentCategory {
  if (/Button|Input|Checkbox|Radio|Select|Switch|Slider|Textarea/i.test(componentName)) {
    return 'form-controls';
  }
  if (/Stack|Box|Container|Flex|Grid|Center|Spacer/i.test(componentName)) {
    return 'layout';
  }
  if (/Text|Heading|Code|Link|List/i.test(componentName)) {
    return 'typography';
  }
  // ... 6 more categories
  return 'other'; // Fallback
}
```

**Design Decisions:**
- **Complexity/Difficulty:** Reuse raw JSON complexity for both fields (POC simplicity)
- **Tags:** Single tag from intent only (simple, sufficient)
- **Category:** Smart defaults via regex (90%+ accuracy)
- **Related Chunks:** Empty array for POC (requires relationship graph)

---

### 7. Normalizer (`normalizer.ts`)

**Purpose:** Main orchestrator - file I/O + batch processing

**Location:** [src/steps/1-normalize/normalizer.ts](../src/steps/1-normalize/normalizer.ts)

**Key Function:**
```typescript
export async function normalizeCodeExamples(componentName?: string): Promise<void>
```

**Orchestration Flow:**

```typescript
// 1. Find input files
const rawJsonDir = path.join(process.cwd(), 'artifacts', 'raw-json');
const files = fs.readdirSync(rawJsonDir)
  .filter(f => f.endsWith('.json'))
  .filter(f => !componentName || f.startsWith(componentName));

// 2. Process each component
const allChunks: CodeExampleChunk[] = [];
for (const file of files) {
  const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Transform each code example
  for (const example of rawData.codeExamples || []) {
    try {
      const chunk = transformCodeExample(
        example,
        rawData.componentName,
        rawData.sourceUrl
      );
      allChunks.push(chunk);
    } catch (error) {
      // Log warning, continue processing
      console.warn(`⚠️  Failed to transform example: ${errorMessage}`);
    }
  }
}

// 3. Save aggregated output
const outputPath = path.join(
  process.cwd(),
  'artifacts',
  'normalized',
  'all-code-examples.json'
);
fs.writeFileSync(outputPath, JSON.stringify(allChunks, null, 2));

// 4. Generate statistics
logStatistics(allChunks);
```

**Error Handling Strategy:**
- Log warnings and continue processing
- One bad example doesn't block entire component
- Maximize chunk output for testing
- Statistics show error count

**Statistics Logging:**
```typescript
function logStatistics(chunks: CodeExampleChunk[]): void {
  // Intent distribution
  const intentCounts = countBy(chunks, c => c.example.intent);

  // Section quality (non-fallback titles)
  const semanticSections = chunks.filter(c => c.example.title !== 'Usage Example');
  const semanticPercentage = (semanticSections.length / chunks.length) * 100;

  // Token distribution
  const tokens = chunks.map(c => estimateChunkTokens(c.content));
  const avgTokens = tokens.reduce((a, b) => a + b, 0) / tokens.length;

  // Log compact report
  console.log(`\n📊 Quality Metrics:`);
  console.log(`  Semantic Sections: ${semanticPercentage.toFixed(1)}%`);
  console.log(`  Specific Intents: ${specificPercentage.toFixed(1)}%`);
  console.log(`  Average Tokens: ${Math.round(avgTokens)}`);
}
```

---

## Schema Mappings

### Raw JSON → CodeExampleChunk

| Raw Field | Transformation | Chunk Field | Module |
|-----------|---------------|-------------|---------|
| `componentName` | Direct copy | `metadata.componentName` | transformer |
| `sourceUrl` | Direct copy | `metadata.sourceUrl` | transformer |
| `codeExamples[].code` | Direct copy | `content.code` | transformer |
| `codeExamples[].complexity` | Direct copy | `metadata.complexity`, `example.difficulty` | transformer |
| `codeExamples[].section` | Infer or use | `example.title` | sectionInferrer |
| N/A | **Infer from code** | `example.intent` | intentClassifier |
| N/A | **Generate from template** | `content.explanation` | explanationGenerator |
| N/A | **Generate from template** | `content.demonstrates` | explanationGenerator |
| N/A | **Generate from template** | `content.keyPoints` | explanationGenerator |
| N/A | **Parse from code** | `codeMetadata.imports` | codeAnalyzer |
| N/A | **Parse from code** | `codeMetadata.components` | codeAnalyzer |
| N/A | **Parse from code** | `codeMetadata.props` | codeAnalyzer |
| N/A | **Parse from code** | `codeMetadata.hooks` | codeAnalyzer |
| N/A | **Detect from code** | `codeMetadata.hasInteractivity` | codeAnalyzer |
| N/A | **Detect from code** | `codeMetadata.hasState` | codeAnalyzer |

**Key Insight:** ~50% of chunk data is **inferred or generated** (not direct copies). This is the "intelligence layer."

---

## Design Patterns

### Pattern 1: Priority-Ordered Classification

**Used in:** sectionInferrer.ts, intentClassifier.ts

**Pattern:**
```typescript
// Check high-confidence patterns first, fallback to low-confidence
if (highConfidencePattern) return { confidence: 0.95, ... };
if (mediumConfidencePattern) return { confidence: 0.8, ... };
if (lowConfidencePattern) return { confidence: 0.6, ... };
return fallback; // confidence: 0.3
```

**Benefits:**
- Deterministic (first match wins)
- Confidence scores guide quality metrics
- Easy to add new patterns

### Pattern 2: Pure Functions + Orchestration

**Used in:** codeExampleTransformer.ts

**Pattern:**
```typescript
// Pure functions (no side effects)
const analysis = analyzeCode(code);
const section = inferSectionTitle(code, section, component);
const intent = classifyIntent(code, analysis, section);

// Orchestrator composes pure functions
export function transform(raw: Raw): Chunk {
  const step1 = pureFunction1(raw);
  const step2 = pureFunction2(step1);
  const step3 = pureFunction3(step2);
  return assembleChunk(step1, step2, step3);
}
```

**Benefits:**
- Easy to test (no mocks needed)
- Easy to understand (linear flow)
- Easy to modify (swap implementations)

### Pattern 3: Template Method Pattern

**Used in:** explanationGenerator.ts

**Pattern:**
```typescript
export function generateContent(data: TemplateData): GeneratedContent {
  // Dispatch to intent-specific generator
  switch (data.intent) {
    case 'sizing': return generateSizingContent(data.data);
    case 'variants': return generateVariantsContent(data.data);
    // ... more cases
    default: return generateGenericContent(data.data);
  }
}

// Each generator follows same structure
function generateSizingContent(data: SizingData): GeneratedContent {
  return {
    explanation: buildExplanation(data),
    demonstrates: buildDemonstrates(data),
    keyPoints: buildKeyPoints(data)
  };
}
```

**Benefits:**
- Consistent output structure
- Easy to add new templates
- Separation of concerns

### Pattern 4: Defensive Data Extraction

**Used in:** templateDataExtractor.ts

**Pattern:**
```typescript
function extractSizingData(analysis: CodeAnalysis, componentName: string): SizingData {
  // Find size prop, handle missing gracefully
  const sizeProp = analysis.props.find(p => p.prop === 'size');
  const sizes = sizeProp?.values || [];

  // Find layout component, handle missing gracefully
  const layoutComponent = analysis.components.find(c => /Stack|Grid|Flex/.test(c));

  // Always return valid structure
  return {
    component: componentName,
    sizes: sizes,
    sizeCount: sizes.length,
    layoutComponent: layoutComponent,
    layoutProps: layoutComponent ? extractLayoutProps(analysis, layoutComponent) : undefined
  };
}
```

**Benefits:**
- Never throws on missing data
- Always returns valid TemplateData
- Downstream code doesn't need null checks

---

## Performance Characteristics

| Module | Complexity | Bottleneck |
|--------|-----------|------------|
| codeAnalyzer | O(n) | Regex matching on code length |
| sectionInferrer | O(1) | Fixed number of pattern checks |
| intentClassifier | O(1) | Fixed number of checks |
| templateDataExtractor | O(m) | Iterate over props/components |
| explanationGenerator | O(1) | String concatenation |
| codeExampleTransformer | O(n + m) | Sum of analysis + extraction |
| normalizer | O(k * (n + m)) | k components, each with n+m cost |

**Measured Performance (Button.json - 16 examples):**
- Total time: ~500ms
- Per-example average: ~31ms
- No performance issues for POC scale (50 components × 15 examples ≈ 750 chunks)

**Bottleneck:** File I/O (reading JSON) dominates over processing time.

---

## Technical Debt & Future Enhancements

### High Priority

1. **Difficulty Scoring** (2-3 hours)
   - Separate code complexity from learning difficulty
   - Combine both factors for accurate difficulty rating
   - See [POC_NORMALIZATION_DECISIONS.md](week2/Phase1/POC_NORMALIZATION_DECISIONS.md#difficulty-scoring)

2. **Tag Generation** (2-3 hours)
   - Derive multiple tags from code patterns
   - Add feature tags (responsive, icons, forms, etc.)
   - See [POC_NORMALIZATION_DECISIONS.md](week2/Phase1/POC_NORMALIZATION_DECISIONS.md#tag-generation)

3. **Chunk Relationships** (4-6 hours)
   - Link related chunks (example → prop reference, progression, composition)
   - Enable "explore related" features
   - See [POC_NORMALIZATION_DECISIONS.md](week2/Phase1/POC_NORMALIZATION_DECISIONS.md#chunk-relationships)

### Medium Priority

4. **Category Mapping Config** (1-2 hours)
   - Move regex patterns to configuration file
   - 100% accuracy vs current ~90%
   - See [POC_NORMALIZATION_DECISIONS.md](week2/Phase1/POC_NORMALIZATION_DECISIONS.md#category-mapping-1)

5. **Type Parser** (6-8 hours)
   - Parse TypeScript types (unions, objects, functions)
   - Required for PropReferenceChunk implementation
   - See [GAP_ANALYSIS.md](week2/Phase1/GAP_ANALYSIS.md#2-propreferencechunk-requirements)

### Low Priority

6. **Quality Scoring** (6-8 hours)
   - ML-based natural language quality assessment
   - Rank search results by quality
   - See [POC_NORMALIZATION_DECISIONS.md](week2/Phase1/POC_NORMALIZATION_DECISIONS.md#quality-scoring)

7. **LLM Generation** (1-2 days)
   - Replace hardcoded templates with LLM API calls
   - More flexible but adds latency and cost
   - Optional enhancement (templates work well)

---

## Code Reference Index

### Core Modules
- [codeAnalyzer.ts](../src/steps/1-normalize/inference/codeAnalyzer.ts:1) - Code structure extraction
- [sectionInferrer.ts](../src/steps/1-normalize/inference/sectionInferrer.ts:1) - Section title inference
- [intentClassifier.ts](../src/steps/1-normalize/inference/intentClassifier.ts:1) - Intent classification
- [templateDataExtractor.ts](../src/steps/1-normalize/generators/templateDataExtractor.ts:1) - Template data extraction
- [explanationGenerator.ts](../src/steps/1-normalize/generators/explanationGenerator.ts:1) - Natural language generation
- [codeExampleTransformer.ts](../src/steps/1-normalize/transformers/codeExampleTransformer.ts:1) - Transformation orchestration
- [normalizer.ts](../src/steps/1-normalize/normalizer.ts:1) - Main pipeline orchestrator

### Utilities
- [chunkId.ts](../src/utils/chunkId.ts:1) - Chunk ID generation with collision handling
- [tokenEstimator.ts](../src/utils/tokenEstimator.ts:1) - Token estimation utilities

### Schemas
- [NormalizedChunkSchema.ts](../src/schemas/NormalizedChunkSchema.ts:1) - 7 chunk types defined

### Tests
- [codeAnalyzer.test.ts](../src/steps/1-normalize/inference/__tests__/codeAnalyzer.test.ts:1) - 13 tests
- [sectionInferrer.test.ts](../src/steps/1-normalize/inference/__tests__/sectionInferrer.test.ts:1) - 27 tests
- [intentClassifier.test.ts](../src/steps/1-normalize/inference/__tests__/intentClassifier.test.ts:1) - 16 tests
- [templateDataExtractor.test.ts](../src/steps/1-normalize/generators/__tests__/templateDataExtractor.test.ts:1) - 15 tests
- [explanationGenerator.test.ts](../src/steps/1-normalize/generators/__tests__/explanationGenerator.test.ts:1) - 18 tests

---

## Version History

- **v2.0.0** (2025-11-04) - Week 2 Phase 2A Complete
  - CodeExampleChunk transformation pipeline production-ready
  - Configuration system implemented (categories, patterns, transformer config)
  - Error handling & fallback generation
  - Metrics tracking & JSONL logging
  - **470 tests passing** across 15 test suites
  - Successfully processed **50 components** (387 normalized chunks)
  - Per-component output files for easier inspection

- **v1.0.0** (2025-10-23) - POC Phase 1 Complete
  - Initial CodeExampleChunk transformation pipeline
  - 88 tests passing
  - Successfully processed Button component (16 examples)
  - 75% semantic sections, 75% specific intents

---

## Next Steps

**Immediate:** Vector DB POC (Step 2)
- Embedding generation for CodeExampleChunk
- Qdrant vector store integration
- Basic search implementation
- Validate retrieval quality

**After POC:** Expand based on retrieval results
- Evaluate which chunk types are needed
- Implement prioritized transformers
- Extend normalization pipeline

**Documentation:**
- See [NORMALIZATION_USAGE_GUIDE.md](NORMALIZATION_USAGE_GUIDE.md) for usage & testing
- See [README.md](../README.md) for project overview & CLI commands
