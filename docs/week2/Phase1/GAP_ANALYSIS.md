# Week 2 Normalization: Gap Analysis

**Created:** 2025-10-22
**Purpose:** Document the gap between raw extracted data (Week 1) and normalized schema requirements (Week 2)
**Status:** ✅ Analysis Complete - Ready for POC Implementation

---

## Executive Summary

**Finding:** README.md describes the **correct** Week 2 approach. The advanced normalization schema (7 chunk types, dual content strategy) is well-designed and supported by extracted data, but requires significant transformation.

**Key Insight:** Raw extracts provide the **raw materials** (code, props, descriptions). Normalization will add the **intelligence layer** (inference, classification, natural language generation).

---

## Document Comparison

### README.md (✅ CORRECT - Actual Implementation)
- **7 specialized chunk types** for intent-based retrieval
- **Dual content strategy:** Natural language (embedding) + Structured (LLM accuracy)
- **Inference engine** for metadata extraction
- **Natural language generation** for explanations
- **Intent-based design** mapping to user question patterns
- **Target:** 200-500 tokens per chunk

### PROJECT_PLAN.md (❌ OUTDATED - Original Simple Proposal)
- **4 basic chunk types** (description, prop, code_example, accessibility)
- **Single content strategy:** Just strings
- **No inference** or NLG mentioned
- **Target:** 400-800 tokens per chunk
- **Simpler approach** that was superseded

### Implemented Schema (NormalizedChunkSchema.ts)
- **Matches README.md** exactly
- **7 chunk types** defined with Zod validation
- **Rich metadata:** tags, category, complexity, relatedChunks
- **Supporting types:** ImportStatement, PropUsage, TypeInfo
- **Type guards** and validation helpers included

---

## Data Source Analysis

### Week 1 Extracted Files (artifacts/raw-json/)

Analyzed 3 sample components:
- [Button-2025-10-22T04-24-22-997Z.json](../../artifacts/raw-json/Button-2025-10-22T04-24-22-997Z.json) - 16 code examples
- [Checkbox-2025-10-22T04-24-30-329Z.json](../../artifacts/raw-json/Checkbox-2025-10-22T04-24-30-329Z.json) - 16 code examples
- [Color-Picker-2025-10-22T04-24-38-740Z.json](../../artifacts/raw-json/Color-Picker-2025-10-22T04-24-38-740Z.json) - 18 code examples

#### Available Fields (ComponentDoc Schema)

```typescript
interface ComponentDoc {
  componentName: string;              // ✅ Direct use
  sourceUrl: string;                  // ✅ Direct use
  description: string;                // ✅ Direct use

  codeExamples: Array<{
    code: string;                     // ✅ Direct use
    score: number;                    // ✅ Can use for filtering
    complexity: 'trivial' | 'basic' | 'intermediate' | 'advanced';  // ✅ Direct use
    section?: string;                 // ⚠️ 60% missing - needs inference
    language?: string;                // ✅ Direct use (mostly 'tsx')
  }>;

  props: Array<{
    name: string;                     // ✅ Direct use
    type: string;                     // ✅ Needs parsing (union types, objects)
    defaultValue?: string;            // ✅ Direct use
    description?: string;             // ✅ Direct use
  }>;

  relatedComponents: string[];        // ✅ Direct use

  importPatterns: Array<{
    source: string;                   // ✅ Direct use
    imports: string[];                // ✅ Direct use
    type: string;                     // ✅ Direct use
    isChakra: boolean;                // ✅ Direct use
  }>;
}
```

---

## Gap Analysis by Schema Requirement

### 1. CodeExampleChunk Requirements

| Field | Source | Transformation | Difficulty | Strategy |
|-------|--------|----------------|------------|----------|
| **chunkId** | N/A | Generate from componentName + intent + version | Easy | `{component}-example-{intent}-v1` |
| **componentName** | `componentName` | Direct copy | Easy | ✅ Available |
| **sourceUrl** | `sourceUrl` | Direct copy | Easy | ✅ Available |
| **tags** | N/A | Infer from intent + components + props | Medium | Pattern matching |
| **category** | N/A | Infer from componentName | Medium | Lookup table + patterns |
| **complexity** | `codeExamples[].complexity` | Map to enum | Easy | ✅ Available |
| **example.title** | `codeExamples[].section` | **Infer from code patterns** | Medium | **Critical** - 60% missing |
| **example.intent** | N/A | **Classify from props + patterns** | Medium | **Pattern matching** |
| **example.difficulty** | `codeExamples[].complexity` | Map enum | Easy | ✅ Available |
| **content.explanation** | N/A | **Generate from templates** | Hard | **NLG required** |
| **content.code** | `codeExamples[].code` | Direct copy | Easy | ✅ Available |
| **content.demonstrates** | N/A | **Extract from code analysis** | Medium | **Parse props + components** |
| **content.keyPoints** | N/A | **Generate teaching moments** | Hard | **NLG required** |
| **codeMetadata.imports** | N/A | Parse from code | Medium | Regex extraction |
| **codeMetadata.components** | N/A | Parse JSX tags from code | Medium | Regex extraction |
| **codeMetadata.props** | N/A | **Extract prop usage** | Medium | **Parse `prop={value}` patterns** |
| **codeMetadata.hooks** | N/A | Parse from code | Easy | Regex: `use[A-Z]\w+` |
| **codeMetadata.hasInteractivity** | N/A | Detect event handlers | Easy | Check for `onClick`, etc. |
| **codeMetadata.hasState** | N/A | Detect hooks | Easy | Check for `useState`, etc. |
| **codeMetadata.complexity** | `codeExamples[].score` | Direct copy | Easy | ✅ Available |

**Key Gaps:**
1. 🔴 **Section Inference** (60% missing) - Pattern matching needed
2. 🔴 **Intent Classification** - Analyze props/patterns
3. 🔴 **Natural Language Generation** - Templates or LLM
4. 🟡 **Prop Usage Extraction** - Parse code for `prop={value}`
5. 🟡 **Code Analysis** - Extract imports, components, hooks

---

### 2. PropReferenceChunk Requirements

| Field | Source | Transformation | Difficulty | Strategy |
|-------|--------|----------------|------------|----------|
| **prop.name** | `props[].name` | Direct copy | Easy | ✅ Available |
| **prop.category** | N/A | **Classify prop type** | Medium | **Pattern matching** |
| **content.description** | `props[].description` | Copy or enhance | Easy | ✅ Available (most props) |
| **content.typeExplanation** | `props[].type` | **Parse and explain** | Hard | **Type parsing + NLG** |
| **content.usageGuidance** | N/A | **Generate from examples** | Hard | **Optional - NLG** |
| **content.defaultBehavior** | `props[].defaultValue` | Template: "Defaults to X" | Easy | ✅ Available |
| **apiReference.type** | `props[].type` | **Parse TypeScript type** | Hard | **Critical - Type parser** |
| **apiReference.defaultValue** | `props[].defaultValue` | Direct copy | Easy | ✅ Available |
| **apiReference.required** | N/A | Infer from type | Easy | Check for `| undefined` |
| **apiReference.relatedProps** | N/A | **Find related props** | Medium | **Semantic analysis** |

**Key Gaps:**
1. 🔴 **Type Parsing** - Parse union types, objects, functions
2. 🔴 **Type Explanation** - Generate human-readable type descriptions
3. 🟡 **Prop Categorization** - Classify appearance/state/events/composition
4. 🟡 **Related Props** - Find semantically related props

**Example Type Parsing Challenges:**
```typescript
// Input (raw string)
type: "'gray' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'cyan' | 'purple' | 'pink'"

// Output (parsed structure)
{
  kind: "union",
  raw: "...",
  options: ["gray", "red", "orange", "yellow", "green", "teal", "blue", "cyan", "purple", "pink"]
}

// Type Explanation (generated)
"Union type with 10 color palette options: gray, red, orange, yellow, green, teal, blue, cyan, purple, pink"
```

---

### 3. CapabilityReferenceChunk Requirements

| Field | Source | Transformation | Difficulty | Strategy |
|-------|--------|----------------|------------|----------|
| **capability.name** | N/A | **Synthesize from props** | Hard | **Infer from prop names** |
| **capability.intent** | N/A | **Generate intent** | Medium | **Template-based** |
| **content.description** | N/A | **Generate overview** | Hard | **NLG required** |
| **content.options[]** | `props[].type` + code examples | **Extract + enhance** | Hard | **Parse types + examples** |
| **content.bestPractices** | N/A | **Infer from examples** | Hard | **Optional - NLG** |
| **reference.propNames** | N/A | Map capability → props | Medium | **Reverse lookup** |

**Key Gaps:**
1. 🔴 **Capability Synthesis** - Identify capabilities from props
2. 🔴 **Option Extraction** - Combine type info + code examples
3. 🔴 **Natural Language Descriptions** - Generate capability explanations

**Example Capability Synthesis:**
```typescript
// From Props:
{ name: "size", type: "'xs' | 'sm' | 'md' | 'lg' | 'xl'" }
{ name: "variant", type: "'solid' | 'outline' | 'ghost'" }

// Synthesized Capabilities:
[
  {
    name: "sizing",
    intent: "Control button size and dimensions",
    options: ["xs", "sm", "md", "lg", "xl"]
  },
  {
    name: "variants",
    intent: "Change button visual appearance style",
    options: ["solid", "outline", "ghost"]
  }
]
```

---

### 4. ComponentOverviewChunk Requirements

| Field | Source | Transformation | Difficulty | Strategy |
|-------|--------|----------------|------------|----------|
| **content.description** | `description` | Direct copy | Easy | ✅ Available |
| **content.capabilities** | N/A | **Synthesize list** | Medium | **From props + examples** |
| **content.useCases** | N/A | **Infer from examples** | Hard | **Pattern matching** |
| **content.commonPairings** | `relatedComponents` | **Convert to sentences** | Medium | **Template-based** |
| **quickReference.hasSubcomponents** | N/A | **Detect composite** | Easy | **Check for dot notation** |
| **quickReference.subcomponents** | `props[].name` | Extract "Root.", "Item." | Easy | **Regex extraction** |
| **quickReference.propCount** | `props.length` | Count | Easy | ✅ Available |
| **quickReference.exampleCount** | `codeExamples.length` | Count | Easy | ✅ Available |

**Key Gaps:**
1. 🟡 **Capability List** - High-level capabilities
2. 🟡 **Use Cases** - Infer from code patterns
3. 🟡 **Common Pairings** - Convert components to sentences
4. 🟢 **Composite Detection** - Simple pattern matching

---

### 5. PropGroupChunk Requirements

| Field | Source | Transformation | Difficulty | Strategy |
|-------|--------|----------------|------------|----------|
| **group.category** | N/A | **Group props** | Medium | **Categorize appearance/state/events** |
| **group.title** | N/A | Generate from category | Easy | **Template: "X Props"** |
| **content.overview** | N/A | **Generate summary** | Medium | **Template + count** |
| **content.props[]** | `props[]` | **Transform + group** | Medium | **Filter by category** |
| **reference.commonPatterns** | N/A | **Extract from examples** | Hard | **Pattern detection** |

**Key Gaps:**
1. 🟡 **Prop Grouping** - Categorize props semantically
2. 🟡 **Group Summaries** - Generate category overviews
3. 🟡 **Pattern Extraction** - Find common usage patterns

---

### 6. CompositionPatternChunk Requirements

| Field | Source | Transformation | Difficulty | Strategy |
|-------|--------|----------------|------------|----------|
| **pattern.name** | N/A | **Detect pattern** | Hard | **From relatedComponents** |
| **pattern.intent** | N/A | **Generate intent** | Medium | **Template-based** |
| **content.explanation** | N/A | **Generate guide** | Hard | **NLG required** |
| **content.steps** | N/A | **Extract from code** | Hard | **Code analysis** |
| **content.code** | `codeExamples[]` | Select best example | Medium | **Filter by pattern** |
| **involves.components** | `relatedComponents` | Direct copy | Easy | ✅ Available |

**Key Gaps:**
1. 🔴 **Pattern Detection** - Identify composition patterns
2. 🔴 **Step Extraction** - Break down code into steps
3. 🟡 **Example Selection** - Choose best representative

---

### 7. APIReferenceChunk Requirements

| Field | Source | Transformation | Difficulty | Strategy |
|-------|--------|----------------|------------|----------|
| **content.summary** | N/A | **Generate overview** | Medium | **Template + counts** |
| **content.propGroups** | `props[]` | **Group + describe** | Medium | **Categorize + template** |
| **props** | N/A | Reference prop chunk IDs | Easy | **After prop chunks created** |

**Key Gaps:**
1. 🟡 **Summary Generation** - High-level API overview
2. 🟡 **Prop Grouping** - Same as PropGroupChunk

---

## Transformation Strategies

### 1. Deterministic Transformations (✅ Can Implement Now)

**Direct Copy:**
- componentName, sourceUrl, description
- code, complexity, language
- prop name, type, defaultValue, description
- relatedComponents, importPatterns

**Simple Parsing:**
- Extract imports from code (regex)
- Extract JSX components from code (regex)
- Extract hooks from code (regex: `use[A-Z]\w+`)
- Detect event handlers (check for `onClick`, `onChange`, etc.)
- Detect state usage (check for `useState`, `useReducer`)
- Count props, examples, subcomponents

**Pattern Matching:**
- Composite detection (check for "Root.", "Item." in prop names)
- Prop categorization (simple rules: ends with `Palette` → appearance, starts with `on` → events)
- Basic section inference (check for `size=` → "Size Variants")

---

### 2. Inference-Based Transformations (⚠️ Need Patterns/Logic)

**Section Title Inference:**
```typescript
// Priority-ordered pattern matching
if (code.includes('size="') || code.includes("size='")) return "Size Variants";
if (code.includes('variant="') || code.includes("variant='")) return "Visual Variants";
if (code.includes('loading') || code.includes('isLoading')) return "Loading States";
if (code.includes('disabled') || code.includes('isDisabled')) return "Disabled State";
if (code.includes('<Icon')) return `${componentName} with Icons`;
if (code.includes('onClick') || code.includes('useState')) return "Interactive Example";
// ... more patterns
return section || "Usage Example";  // Fallback
```

**Intent Classification:**
```typescript
// Analyze prop usage patterns
const intents = {
  sizing: code.match(/\bsize=/),
  variants: code.match(/\bvariant=/),
  theming: code.match(/\bcolorPalette=|\bcolorScheme=/),
  states: code.match(/\b(disabled|loading|invalid|readOnly)=/),
  composition: relatedComponents.length > 2,
  interaction: code.match(/\bon[A-Z]\w+=/),
  forms: code.match(/\b(Form|Input|Checkbox|onSubmit)/)
};
return Object.keys(intents).find(key => intents[key]) || "usage";
```

**Component Category Inference:**
```typescript
// Map component names to categories
const categoryMap = {
  'Button|IconButton|CloseButton': 'form-controls',
  'Box|Container|Stack|Grid|Flex': 'layout',
  'Heading|Text|Code|Link': 'typography',
  'Badge|Card|Stat|Table': 'data-display',
  'Alert|Toast|Progress|Spinner': 'feedback',
  'Modal|Drawer|Popover|Menu': 'overlay',
  'Accordion|Tabs|Disclosure': 'disclosure',
  'Breadcrumb|Stepper|Pagination': 'navigation',
  'Image|Avatar|Icon': 'media'
};
```

---

### 3. Generation-Based Transformations (🔴 Need NLG)

**Template-Based Generation (Recommended for POC):**
```typescript
// Explanation templates
const templates = {
  sizing: `This example demonstrates how to control ${componentName} dimensions using the size prop. ` +
          `The size prop accepts ${propValues.join(', ')} values, each providing different visual scales.`,

  variants: `This example shows the different visual styles available for ${componentName}. ` +
            `The variant prop supports ${propValues.join(', ')} options, each with distinct appearance.`,

  composition: `This example demonstrates how ${componentName} can be combined with ${components.join(', ')} ` +
               `to create more complex UI patterns.`
};
```

**LLM-Based Generation (Future Enhancement):**
- Use Groq API to generate natural language explanations
- Provide code + metadata as context
- Request: explanation, key points, usage guidance
- More flexible but adds latency and cost

---

## Implementation Recommendations

### Phase 1 POC: CodeExampleChunk Only (4-6 hours)

**Scope:** Transform 5 Button examples to prove the pipeline

**Implementation Priority:**

1. **High Priority (Must Have):**
   - ✅ Section title inference with patterns
   - ✅ Intent classification
   - ✅ Template-based explanation generation
   - ✅ Prop usage extraction (parse `prop={value}`)
   - ✅ Import/component extraction

2. **Medium Priority (Should Have):**
   - ✅ Key points generation (extract 2-3 teaching moments)
   - ✅ Demonstrates list (convert structured data to bullets)
   - ✅ Tag generation

3. **Low Priority (Nice to Have):**
   - ⚠️ LLM-based explanation enhancement
   - ⚠️ Advanced pattern recognition
   - ⚠️ Confidence scoring

**Success Criteria:**
- 5/5 examples transform successfully
- 4/5 inferred sections are semantic (not fallback)
- All explanations are accurate and informative
- Schema validation passes
- Chunk sizes are 200-500 tokens

---

### Phase 2: Add CapabilityReference + PropReference (Next)

**After POC Success:**
1. Implement type parser for union types
2. Add prop categorization logic
3. Create capability synthesis from props
4. Generate type explanations

---

### Phase 3: Complete All 7 Chunk Types (Final)

**After Phases 1-2 Success:**
1. Add remaining transformers
2. Implement full pipeline orchestration
3. Process all 50 components
4. Quality validation

---

## Risk Assessment

### High Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Section inference accuracy <90%** | Poor retrieval quality | Add more patterns, manual review fallback |
| **Generated explanations are generic** | Low embedding quality | Use specific details from code, manual review |
| **Type parsing fails on complex types** | Missing API reference data | Start with simple unions, add complexity incrementally |

### Medium Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Chunk sizes too variable** | Embedding quality issues | Add size validation, split/merge chunks |
| **Prop categorization errors** | Incorrect grouping | Conservative rules, manual review |
| **Pattern detection false positives** | Incorrect intents | Test on diverse examples, adjust thresholds |

### Low Risk

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Missing relatedComponents** | Incomplete composition patterns | Optional field, graceful degradation |
| **Import parsing edge cases** | Missing metadata | Non-critical, best-effort extraction |

---

## Next Steps

### Immediate (Day 1)

1. ✅ **Complete this analysis** - Document complete
2. ✅ **Review with stakeholders** - Get alignment on approach
3. ⏭️ **Create POC branch** - `git checkout -b week2-poc-code-examples`
4. ⏭️ **Implement section inferrer** - Start with high-confidence patterns

### Day 2-3

5. ⏭️ **Implement NLG templates** - Template-based explanation generation
6. ⏭️ **Create transformer** - Orchestrate inference + generation
7. ⏭️ **Test on 5 examples** - Validate quality

### Day 4-7

8. ⏭️ **Manual review** - Verify accuracy
9. ⏭️ **Iterate on patterns** - Improve inference
10. ⏭️ **Decision: Proceed or pivot** - Based on POC results

---

## Appendix: Sample Transformations

### Example 1: Size Variants

**Input (Button.json codeExamples[1]):**
```json
{
  "code": "import { Button, HStack } from \"@chakra-ui/react\"\n\nconst Demo = () => {\n  return (\n    <HStack wrap=\"wrap\" gap=\"6\">\n      <Button size=\"xs\">Button (xs)</Button>\n      <Button size=\"sm\">Button (sm)</Button>\n      <Button size=\"md\">Button (md)</Button>\n      <Button size=\"lg\">Button (lg)</Button>\n      <Button size=\"xl\">Button (xl)</Button>\n    </HStack>\n  )\n}",
  "score": 8,
  "complexity": "intermediate"
}
```

**Output (CodeExampleChunk):**
```json
{
  "metadata": {
    "chunkId": "button-example-size-variants-v1",
    "chunkType": "code-example",
    "componentName": "Button",
    "sourceUrl": "https://chakra-ui.com/docs/components/button",
    "tags": ["sizing", "layout", "button", "variants"],
    "category": "form-controls",
    "complexity": "intermediate"
  },
  "example": {
    "title": "Size Variants",
    "intent": "sizing",
    "difficulty": "basic"
  },
  "content": {
    "explanation": "This example demonstrates how to control Button dimensions using the size prop. The size prop accepts 'xs', 'sm', 'md', 'lg', 'xl' values, each providing different visual scales. HStack with gap='6' provides consistent spacing between buttons.",
    "code": "...",
    "demonstrates": [
      "Using the size prop to control button dimensions",
      "Rendering multiple button sizes for comparison",
      "Using HStack for horizontal layout with consistent spacing"
    ],
    "keyPoints": [
      "The size prop accepts string values: 'xs', 'sm', 'md', 'lg', 'xl'",
      "HStack with gap='6' provides consistent spacing between buttons",
      "Each size value corresponds to specific height and padding values"
    ]
  },
  "codeMetadata": {
    "language": "tsx",
    "imports": [
      {
        "source": "@chakra-ui/react",
        "imports": ["Button", "HStack"],
        "type": "named"
      }
    ],
    "components": ["Button", "HStack"],
    "props": [
      {
        "component": "Button",
        "prop": "size",
        "values": ["xs", "sm", "md", "lg", "xl"]
      },
      {
        "component": "HStack",
        "prop": "wrap",
        "values": ["wrap"]
      },
      {
        "component": "HStack",
        "prop": "gap",
        "values": ["6"]
      }
    ],
    "hasInteractivity": false,
    "hasState": false,
    "complexity": 8
  }
}
```

---

### Example 2: Missing Section Title

**Input (Checkbox.json codeExamples[1]):**
```json
{
  "code": "<Checkbox.Root>\n  <Checkbox.HiddenInput />\n  <Checkbox.Control>\n    <Checkbox.Indicator />\n  </Checkbox.Control>\n  <Checkbox.Label />\n</Checkbox.Root>",
  "section": "Usage",
  "score": 5,
  "complexity": "basic"
}
```

**Output (CodeExampleChunk):**
```json
{
  "metadata": {
    "chunkId": "checkbox-example-basic-structure-v1",
    "chunkType": "code-example",
    "componentName": "Checkbox",
    "tags": ["composition", "structure", "checkbox"],
    "category": "form-controls",
    "complexity": "basic"
  },
  "example": {
    "title": "Basic Checkbox Structure",
    "intent": "composition",
    "difficulty": "basic"
  },
  "content": {
    "explanation": "This example shows the basic composition structure of Checkbox component. It demonstrates the required subcomponents (Root, HiddenInput, Control, Indicator, Label) and how they nest to create a fully functional checkbox.",
    "code": "...",
    "demonstrates": [
      "Checkbox composition with subcomponents",
      "Using Checkbox.Root as the container",
      "Including Checkbox.HiddenInput for form submission",
      "Structuring Checkbox.Control with Checkbox.Indicator",
      "Adding Checkbox.Label for accessibility"
    ]
  },
  "codeMetadata": {
    "components": ["Checkbox.Root", "Checkbox.HiddenInput", "Checkbox.Control", "Checkbox.Indicator", "Checkbox.Label"],
    "hasInteractivity": false,
    "hasState": false,
    "complexity": 5
  }
}
```

---

**Status:** ✅ Analysis Complete - Ready for POC Implementation
**Next:** Create POC branch and implement section inferrer
