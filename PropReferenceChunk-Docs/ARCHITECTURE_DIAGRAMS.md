# PropReferenceChunk Architecture & Flow Diagrams

---

## 1. Data Transformation Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│                    RAW JSON (Week 1 Extraction)              │
│  artifacts/raw-json/Button.json                             │
│  ├─ componentName: "Button"                                 │
│  ├─ sourceUrl: "https://..."                                │
│  ├─ description: "..."                                      │
│  ├─ codeExamples: [...]                                     │
│  └─ props: [                                                │
│     { name: "size", type: "...", description: "...", ...}   │
│     { name: "variant", type: "...", ... }                   │
│     { name: "onClick", type: "(e) => void", ... }           │
│     { name: "disabled", type: "boolean", ... }              │
│     ... (10-15 props per component)                         │
│  ]                                                          │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ↓
        ┌──────────────────────────────────────────┐
        │    PROP REFERENCE TRANSFORMER            │
        │  propReferenceTransformer.ts             │
        └──────────────────────────────────────────┘
                               │
        ┌──────────┬──────────┬┴────────┬──────────┐
        ↓          ↓          ↓         ↓          ↓
    ┌───────┐ ┌────────┐ ┌──────┐ ┌────────┐ ┌──────────┐
    │ Step  │ │ Step   │ │ Step │ │ Step   │ │ Step     │
    │ 1:    │ │ 2:     │ │ 3:   │ │ 4:     │ │ 5:       │
    │ Categ │ │ Parse  │ │ Find │ │ Gener  │ │ Assemble │
    │ orize │ │ Type   │ │ Rela │ │ ate    │ │          │
    │       │ │        │ │ ted  │ │ NLG    │ │          │
    └───┬───┘ └────┬───┘ └───┬──┘ └───┬────┘ └────┬─────┘
        │          │         │       │            │
        ↓          ↓         ↓       ↓            ↓
    │name:size│  │type:   │ │relate│ │content: │ │Prop      │
    │  →      │  │union   │ │d:    │ │descrip │ │Reference │
    │appearan│  │['xs',  │ │[vari │ │tion,   │ │Chunk ✅  │
    │ce      │  │'sm']   │ │ant]  │ │type,   │ │          │
    │        │  │        │ │      │ │usage   │ │metadata: │
    │        │  │        │ │      │ │        │ │...,      │
    │        │  │        │ │      │ │        │ │apiRef:..│
    └────────┘  └────────┘ └──────┘ └────────┘ └──────────┘
                               │
                               ↓
        ┌──────────────────────────────────────────┐
        │    NORMALIZED OUTPUT (Embedding Ready)   │
        │  artifacts/normalized/Button-props.json  │
        │  [                                       │
        │    {                                     │
        │      "metadata": { ... },                │
        │      "prop": { name: "size", ... },      │
        │      "content": {                        │
        │        "description": "...",             │
        │        "typeExplanation": "...",         │
        │        "usageGuidance": "...",           │
        │        "defaultBehavior": "..."          │
        │      },                                  │
        │      "apiReference": { ... }             │
        │    },                                    │
        │    { ... 11 more prop chunks ... },      │
        │  ]                                       │
        │  ✅ Ready to embed (~130 tokens avg)    │
        └──────────────────────────────────────────┘
```

---

## 2. Step 1: Categorization

```
Input: Prop Name
       │
       ├─→ /^(size|width|height|padding|color|variant|border|radius)/
       │   YES ✅ → Category: "appearance"
       │
       ├─→ /^on[A-Z]/
       │   YES ✅ → Category: "events"
       │
       ├─→ /(disabled|loading|invalid|readonly|checked)/
       │   YES ✅ → Category: "state"
       │
       ├─→ /(as|asChild|ref|className|style|children)/
       │   YES ✅ → Category: "composition"
       │
       ├─→ /^aria-/ or name === 'role'
       │   YES ✅ → Category: "accessibility"
       │
       └─→ DEFAULT → Category: "behavior"

Examples:
  "size"          → appearance
  "variant"       → appearance
  "disabled"      → state
  "loading"       → state
  "onClick"       → events
  "onChange"      → events
  "aria-label"    → accessibility
  "role"          → accessibility
  "as"            → composition
  "ref"           → composition
```

---

## 3. Step 2: Type Parsing

```
Input: TypeScript Type String
       │
       ├─→ Has '|' (pipe)
       │   YES → Kind: "union"
       │        Extract options: "'xs' | 'sm' | 'md'"
       │                      → ["xs", "sm", "md"]
       │   EXAMPLE:
       │   Input:  "'xs' | 'sm' | 'md' | 'lg' | 'xl'"
       │   Output: {
       │     kind: "union",
       │     raw: "'xs' | 'sm' | 'md' | 'lg' | 'xl'",
       │     options: ["xs", "sm", "md", "lg", "xl"]
       │   }
       │
       ├─→ Is 'string', 'number', 'boolean', 'any'
       │   YES → Kind: "primitive"
       │   EXAMPLE:
       │   Input:  "boolean"
       │   Output: {
       │     kind: "primitive",
       │     raw: "boolean"
       │   }
       │
       ├─→ Ends with '[]'
       │   YES → Kind: "array"
       │   EXAMPLE:
       │   Input:  "string[]"
       │   Output: {
       │     kind: "array",
       │     raw: "string[]"
       │   }
       │
       ├─→ Contains '=>'
       │   YES → Kind: "function"
       │   EXAMPLE:
       │   Input:  "(event: Event) => void"
       │   Output: {
       │     kind: "function",
       │     raw: "(event: Event) => void",
       │     returnType: "void"
       │   }
       │
       └─→ DEFAULT → Kind: "complex"
           EXAMPLE:
           Input:  "{ width: string, height: string }"
           Output: {
             kind: "complex",
             raw: "{ width: string, height: string }"
           }
```

---

## 4. Step 3: Related Props Inference

```
Input: Current Prop Name + All Component Props
       │
       ├─ "size" → Check pairing list
       │          ├─ variant (exists?) → ✅ add
       │          ├─ colorPalette (exists?) → ✅ add
       │          ├─ width (exists?) → ✅ add
       │          └─ height (exists?) → ✅ add
       │
       ├─ "variant" → Check pairing list
       │             ├─ size → ✅ add
       │             └─ colorPalette → ✅ add
       │
       ├─ "disabled" → Check pairing list
       │              └─ loading → ✅ add
       │
       ├─ "loading" → Check pairing list
       │             └─ disabled → ✅ add
       │
       ├─ "placeholder" → Check pairing list
       │                 └─ defaultValue → ✅ add
       │
       └─ "customProp" → Not in pairing list
                        → Return []

Common Pairings:
  size ←→ [variant, colorPalette, width, height]
  variant ←→ [size, colorPalette]
  disabled ←→ [loading]
  loading ←→ [disabled]
  placeholder ←→ [defaultValue]
  required ←→ [invalid]
```

---

## 5. Step 4: Natural Language Generation

```
Input: Prop Data + Category + Type Info
       │
       ├─→ description
       │   Source: rawProp.description (or generate fallback)
       │   Examples:
       │   ✅ Provided: "Controls the size of the button"
       │   ⚠️  Generated: "Controls size or dimensions of the component"
       │
       ├─→ typeExplanation
       │   Format: "${typeKind}${details}"
       │   Examples:
       │   Union:     "Union of 5 string values: xs, sm, md, lg, xl"
       │   Primitive: "Boolean value - true or false"
       │   Function:  "Callback function that receives event details"
       │   Array:     "Array type: string[]"
       │
       ├─→ usageGuidance
       │   Based on: category + prop name
       │   Examples:
       │   appearance → "Use 'md' for primary actions, smaller for secondary"
       │   state      → "Use when action should be temporarily unavailable"
       │   events     → "Attach to trigger actions on user interaction"
       │   (null if no specific guidance)
       │
       └─→ defaultBehavior
           Source: rawProp.defaultValue
           Examples:
           ✅ Has default: "Defaults to 'md' if not specified"
           ✅ Required:    "Required prop - no default value"
           ⚠️  None:       (undefined/null)

Token Count Result:
  description:       ~40 tokens
  typeExplanation:   ~35 tokens
  usageGuidance:     ~25 tokens
  defaultBehavior:   ~10 tokens
  ────────────────────────────
  TOTAL:             ~110 tokens ✅ Optimal
```

---

## 6. Prop Categorization by Examples

```
┌─────────────────────────────────────────┐
│         APPEARANCE (200+ props)         │
├─────────────────────────────────────────┤
│ size, variant, colorPalette            │
│ width, height, padding, margin         │
│ border, borderRadius, shadow           │
│ opacity, backgroundColor               │
│ borderColor, textDecoration            │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           STATE (100+ props)            │
├─────────────────────────────────────────┤
│ disabled, loading, invalid             │
│ readOnly, checked, selected            │
│ open, closed, error, isRequired        │
│ isDisabled, isInvalid, isReadonly      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│           EVENTS (80+ props)            │
├─────────────────────────────────────────┤
│ onClick, onChange, onSubmit            │
│ onFocus, onBlur, onKeyDown, onKeyUp    │
│ onMouseEnter, onMouseLeave, onHover    │
│ onSelect, onDrag, onDrop               │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│       ACCESSIBILITY (40+ props)         │
├─────────────────────────────────────────┤
│ aria-label, aria-labelledby            │
│ aria-describedby, aria-hidden          │
│ aria-disabled, aria-live, aria-atomic  │
│ role, tabIndex                         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│        COMPOSITION (80+ props)          │
├─────────────────────────────────────────┤
│ as, asChild, ref, className, style     │
│ children, key, id, data-*              │
└─────────────────────────────────────────┘
```

---

## 7. Complete Example: Button.size

```
RAW INPUT (from Button.json)
────────────────────────────────────────
{
  name: "size",
  type: "'xs' | 'sm' | 'md' | 'lg' | 'xl'",
  description: "Controls the size of the button",
  defaultValue: "md",
  required: false
}


TRANSFORMATION PIPELINE
────────────────────────────────────────

Step 1: Categorize
  "size" matches /^size/ → Category: "appearance" ✅

Step 2: Parse Type
  "'xs' | 'sm' | 'md' | 'lg' | 'xl'"
    has '|' → Kind: "union"
    extract options → ["xs", "sm", "md", "lg", "xl"]

Step 3: Find Related Props
  "size" in pairing list:
    ✅ variant exists
    ✅ colorPalette exists
    ❌ width missing
  Related: ["variant", "colorPalette"]

Step 4: Generate NLG
  description: "Controls the size of the button" (from raw)
  typeExplanation: "Union of 5 string values: xs, sm, md, lg, xl"
  usageGuidance: "Use 'md' for primary actions, smaller sizes for secondary"
  defaultBehavior: "Defaults to 'md' if not specified"

Step 5: Assemble
  Generate chunkId: "button-prop-size-v1"
  Determine complexity: "simple" (all props are simple)
  Create tags: ["prop", "appearance", "size"]


PROPRERENCECHUNK OUTPUT
────────────────────────────────────────
{
  metadata: {
    chunkId: "button-prop-size-v1",
    chunkType: "prop-reference",
    componentName: "Button",
    sourceUrl: "https://chakra-ui.com/docs/components/button",
    version: "3.27.1",
    tags: ["prop", "appearance", "size"],
    category: "form-controls",
    complexity: "simple",
    relatedChunks: []
  },

  prop: {
    fullName: "size",
    component: undefined,
    name: "size",
    category: "appearance"
  },

  content: {
    description: "Controls the size of the button",
    typeExplanation: "Union of 5 string values: xs, sm, md, lg, xl",
    usageGuidance: "Use 'md' for primary actions, smaller sizes for secondary or compact spaces",
    defaultBehavior: "Defaults to 'md' if not specified"
  },

  apiReference: {
    type: {
      kind: "union",
      raw: "'xs' | 'sm' | 'md' | 'lg' | 'xl'",
      options: ["xs", "sm", "md", "lg", "xl"]
    },
    defaultValue: "md",
    required: false,
    relatedProps: ["variant", "colorPalette"]
  }
}

METRICS
────────────────────────────────────────
✅ chunkId format: button-prop-size-v1
✅ Tokens: ~130 (within 100-250 target)
✅ Content fields: all present
✅ Type info: union correctly parsed
✅ Related props: correctly inferred
✅ Categories: correctly assigned
✅ Ready for embedding! 🚀
```

---

## 8. Aggregation: All Button Props

```
Button.json Input
├─ 16 props total
│
└─ Generate 16 PropReferenceChunks
   │
   ├─ button-prop-size-v1
   │  ├─ type: appearance | tokens: 130
   │  └─ options: [xs, sm, md, lg, xl]
   │
   ├─ button-prop-variant-v1
   │  ├─ type: appearance | tokens: 120
   │  └─ options: [solid, outline, ghost]
   │
   ├─ button-prop-colorpalette-v1
   │  ├─ type: appearance | tokens: 115
   │  └─ options: [gray, red, blue, green, ...]
   │
   ├─ button-prop-onclick-v1
   │  ├─ type: events | tokens: 95
   │  └─ signature: (event: MouseEvent) => void
   │
   ├─ button-prop-disabled-v1
   │  ├─ type: state | tokens: 100
   │  └─ default: false
   │
   ├─ button-prop-loading-v1
   │  ├─ type: state | tokens: 105
   │  └─ default: false
   │
   ├─ button-prop-arialabel-v1
   │  ├─ type: accessibility | tokens: 90
   │  └─ required: false
   │
   ├─ ... 9 more props ...
   │
   └─ TOTAL: 16 chunks, ~1,700 tokens combined
      Average per chunk: ~106 tokens ✅


Output File: Button-props.json
──────────────────────────────
[
  { propReferenceChunk for size },
  { propReferenceChunk for variant },
  { propReferenceChunk for colorPalette },
  { propReferenceChunk for onClick },
  { propReferenceChunk for disabled },
  { propReferenceChunk for loading },
  { propReferenceChunk for aria-label },
  ... 9 more ...
]

Size: ~50KB JSON
Chunks: 16
Status: ✅ Ready to embed
```

---

## 9. Full Pipeline: 50 Components

```
Input: artifacts/raw-json/
  ├─ Button.json (16 props) → Button-props.json (16 chunks)
  ├─ Input.json (18 props) → Input-props.json (18 chunks)
  ├─ Checkbox.json (14 props) → Checkbox-props.json (14 chunks)
  ├─ Stack.json (12 props) → Stack-props.json (12 chunks)
  ├─ Box.json (20 props) → Box-props.json (20 chunks)
  ├─ Text.json (8 props) → Text-props.json (8 chunks)
  ├─ Heading.json (8 props) → Heading-props.json (8 chunks)
  ├─ Badge.json (6 props) → Badge-props.json (6 chunks)
  ├─ Avatar.json (10 props) → Avatar-props.json (10 chunks)
  ├─ Card.json (5 props) → Card-props.json (5 chunks)
  ├─ ... 40 more components ...
  │
  └─ TOTALS:
     ├─ Components: 50
     ├─ Total Props: ~520
     ├─ PropReferenceChunks: ~520
     ├─ Total Tokens: ~65,000 tokens
     ├─ Avg per chunk: ~125 tokens ✅
     └─ Output files: 50 JSON files


Integration with CodeExamples
──────────────────────────────
artifact/normalized/
├─ Button.json (16 CodeExampleChunks, ~2,200 tokens)
├─ Button-props.json (16 PropReferenceChunks, ~1,700 tokens)
├─ Input.json (18 CodeExampleChunks)
├─ Input-props.json (18 PropReferenceChunks)
├─ ... 48 more components ...
│
└─ COMBINED TOTALS:
   ├─ CodeExampleChunks: 387
   ├─ PropReferenceChunks: 520
   ├─ Total chunks: 907 ✅
   ├─ Total tokens: ~115,000
   ├─ Avg per chunk: ~127 tokens (optimal!)
   └─ Ready to embed into vectors! 🚀
```

---

## 10. Embedding Integration

```
VECTOR DB PIPELINE
──────────────────────────────────────

Step 1: Load All Chunks
  codeExamples = load("normalized/*-code-examples.json")   // 387
  propReferences = load("normalized/*-props.json")          // 520
  allChunks = codeExamples + propReferences                 // 907 total

Step 2: Extract Embedding Text
  For each chunk:
    if CodeExampleChunk:
      text = explanation + demonstrates.join(' ') + keyPoints.join(' ')
      example: "This example demonstrates... Using size prop... Consistent spacing..."
    if PropReferenceChunk:
      text = description + typeExplanation + usageGuidance + defaultBehavior
      example: "Controls the size... Union of 5 values... Use md for primary..."

Step 3: Generate Embeddings
  embedding = openai.embed(text)           // 1536 dimensions
  batch process (50 chunks at a time)

Step 4: Upsert to Qdrant
  for chunk, embedding in pairs:
    qdrant.upsert(
      id: chunk.metadata.chunkId,
      vector: embedding,
      payload: {
        chunk,
        type: chunk.metadata.chunkType,      // code-example | prop-reference
        component: chunk.metadata.componentName,
        category: chunk.metadata.category
      }
    )

Step 5: Validate & Search
  query = "button color"
  query_embedding = openai.embed(query)
  results = qdrant.search(
    vector: query_embedding,
    limit: 5,
    filters: { category: "form-controls" }
  )

  EXPECTED RESULT:
  ✅ Rank 1: Button.colorPalette PropReferenceChunk (0.65 score)
            ← This was failing before! Now works!

Query Coverage Improvement:
  Before: "button color" ❌ failed
  After:  "button color" ✅ returns prop chunk

  Before: 4/5 queries (80%)
  After:  5/5 queries (100%) ✅
```

---

**These diagrams show the complete flow from raw JSON → PropReferenceChunk → Vector embeddings**
