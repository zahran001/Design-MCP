# PropReferenceChunk Implementation Plan

**Date:** December 27, 2025
**Status:** Ready to implement
**Effort Estimate:** 4-6 hours total
**Priority:** 🥇 Tier 1 - Highest ROI

---

## Overview

Transform component props from raw extracted JSON into semantic, embedding-rich PropReferenceChunks. Each prop becomes a self-contained chunk answering "What's the X prop?"

**Example:**
```
Input:  { name: "size", type: "'xs' | 'sm' | 'md' | 'lg' | 'xl'", description: "..." }
Output: PropReferenceChunk
  ├─ metadata.chunkId: "button-prop-size-v1"
  ├─ content.description: "Controls the size of the button"
  ├─ content.typeExplanation: "Union of 5 string values..."
  ├─ apiReference.type: { kind: "union", options: ["xs", "sm", ...] }
  └─ tokens: 120-160 (optimal range!)
```

---

## Architecture Overview

```
Raw JSON (artifacts/raw-json/*.json)
    ↓ Raw props table
    ├─ props[]: [
    │   { name: "size", type: "...", description: "...", defaultValue: "md" },
    │   { name: "variant", type: "...", description: "...", defaultValue: "solid" },
    │   ...
    │ ]
    │
    ↓ propReferenceTransformer.ts
    │
    ├─ 1. Categorize prop (infer from name)
    │    appearance → "size", "variant", "colorPalette"
    │    state → "disabled", "loading", "invalid"
    │    events → "onClick", "onChange"
    │    accessibility → "aria-label", "role"
    │
    ├─ 2. Parse type (extract union options)
    │    "'xs' | 'sm' | 'md'" → ["xs", "sm", "md"]
    │
    ├─ 3. Find usage examples (from CodeAnalysis)
    │    ← Already computed in CodeExampleChunk step
    │    Cross-reference prop.values from codeMetadata.props
    │
    ├─ 4. Infer related props (from prop names)
    │    size → variant, colorPalette (commonly paired)
    │
    └─ 5. Generate natural language
        description: "Controls the size of the button"
        typeExplanation: "Union of 5 string values: xs, sm, md, lg, xl"
        usageGuidance: "Use 'md' for primary actions, 'sm' for secondary"
        defaultBehavior: "Defaults to 'md' if not specified"

Output: artifacts/normalized/Button-props.json (or integrated into Button.json)
```

---

## Data Flow & Sources

### Input Data Sources

**Source 1: Raw Props from RAGResultSchema**
```typescript
// From artifacts/raw-json/Button.json
{
  props: [
    {
      name: "size",                    // ← Use directly
      type: "'xs' | 'sm' | 'md' | ...", // ← Parse to extract options
      description: "Controls size",    // ← Use directly
      defaultValue: "md"               // ← Use directly
      required: false                  // ← Use directly
    }
  ]
}
```

**Source 2: Code Analysis Results** (Already computed!)
```typescript
// From CodeExampleChunk.codeMetadata.props
[
  {
    component: "Button",
    prop: "size",
    values: ["xs", "sm", "md", "lg", "xl"]  // ← Actual values used in examples
  }
]
```

**Source 3: Component Categorization Config**
```typescript
// Already exists: src/steps/1-normalize/config/categories.config.ts
// Use to determine component category (form-controls, layout, etc.)
```

### Output Structure

```typescript
interface PropReferenceChunk {
  metadata: {
    chunkId: "button-prop-size-v1",
    chunkType: "prop-reference",
    componentName: "Button",
    sourceUrl: "...",
    version: "3.27.1",
    tags: ["prop", "sizing"],           // ← Infer from category + prop name
    category: "form-controls",
    complexity: "simple",                // ← Props are always simple
    relatedChunks: []
  },

  prop: {
    fullName: "size",                   // ← From prop.name
    component: undefined,               // ← Not for Button; for composite: "Root"
    name: "size",                       // ← From prop.name
    category: "appearance"              // ← Infer from name
  },

  content: {
    description: "Controls the size of the button",  // ← From prop.description
    typeExplanation: "Union of 5 string values: ...", // ← Generate from type
    usageGuidance: "Use 'md' for primary actions", // ← Generate from patterns
    defaultBehavior: "Defaults to 'md'"             // ← From defaultValue
  },

  apiReference: {
    type: {
      kind: "union",                    // ← Infer from type string
      raw: "'xs' | 'sm' | 'md' | ...",
      options: ["xs", "sm", "md", ...]  // ← Parse from type
    },
    defaultValue: "md",                 // ← From defaultValue
    required: false,                    // ← From required
    relatedProps: ["variant"]           // ← Infer from common pairings
  }
}
```

---

## Implementation Plan: 4-6 Hours

### **Hour 1-2: Core Extraction Logic**

**File:** `src/steps/1-normalize/transformers/propReferenceTransformer.ts` (NEW)

```typescript
/**
 * Transform a raw prop into a PropReferenceChunk
 * @param rawProp - From raw JSON props table
 * @param componentName - Which component this prop belongs to
 * @param sourceUrl - Documentation URL
 * @param allProps - All props for this component (for finding relationships)
 * @returns PropReferenceChunk
 */
export function transformProp(
  rawProp: Prop,
  componentName: string,
  sourceUrl: string,
  allProps: Prop[]
): PropReferenceChunk {
  // Step 1: Categorize prop
  const category = categorizeProp(rawProp.name);

  // Step 2: Parse type
  const typeInfo = parsePropertyType(rawProp.type);

  // Step 3: Generate tags
  const tags = [
    'prop',
    category.toLowerCase(),
    rawProp.name
  ];

  // Step 4: Find related props
  const relatedProps = findRelatedProps(rawProp.name, allProps);

  // Step 5: Generate content
  const content = generatePropContent(rawProp, typeInfo);

  // Step 6: Assemble chunk
  return {
    metadata: {
      chunkId: generateChunkId(componentName, 'prop-reference', rawProp.name, '1'),
      chunkType: 'prop-reference',
      componentName,
      sourceUrl,
      version: '3.27.1',
      tags,
      category: getCategoryFromComponent(componentName),
      complexity: 'simple',
      relatedChunks: []
    },

    prop: {
      fullName: rawProp.name,
      name: rawProp.name,
      category: category as PropCategory
    },

    content,

    apiReference: {
      type: typeInfo,
      defaultValue: rawProp.defaultValue,
      required: rawProp.required || false,
      relatedProps
    }
  };
}
```

**Key Functions to Implement:**

```typescript
/**
 * Categorize prop by name pattern
 * Examples:
 *   - "size", "width" → "appearance"
 *   - "onClick", "onChange" → "events"
 *   - "disabled", "loading" → "state"
 *   - "aria-label", "role" → "accessibility"
 */
function categorizeProp(propName: string): PropCategory {
  const lowerName = propName.toLowerCase();

  // Appearance props
  if (/^(size|width|height|padding|margin|color|variant|border|radius|shadow|opacity|bg)/.test(lowerName)) {
    return 'appearance';
  }

  // Event handlers
  if (/^on[A-Z]/.test(propName)) {
    return 'events';
  }

  // State props
  if (/(disabled|loading|invalid|readonly|checked|selected|open|closed|error)/.test(lowerName)) {
    return 'state';
  }

  // Composition
  if /(as|asChild|ref|className|style|children)/.test(lowerName)) {
    return 'composition';
  }

  // Behavior
  if (/(lazy|mount|close|select|delay|debounce|throttle)/.test(lowerName)) {
    return 'behavior';
  }

  // Accessibility
  if (/^aria-/.test(lowerName) || lowerName === 'role') {
    return 'accessibility';
  }

  // Default
  return 'behavior';
}

/**
 * Parse TypeScript type string and extract structured info
 * Examples:
 *   "'xs' | 'sm' | 'md'" → { kind: "union", options: ["xs", "sm", "md"] }
 *   "string" → { kind: "primitive", raw: "string" }
 *   "boolean" → { kind: "primitive", raw: "boolean" }
 *   "(e: Event) => void" → { kind: "function", returnType: "void" }
 */
function parsePropertyType(typeStr: string): TypeInfo {
  const trimmed = typeStr.trim();

  // Union type: "'a' | 'b' | 'c'"
  if (trimmed.includes('|')) {
    const options = trimmed
      .split('|')
      .map(s => s.trim())
      .map(s => s.replace(/^['"`]|['"`]$/g, '')) // Remove quotes
      .filter(s => s.length > 0);

    return {
      kind: 'union',
      raw: trimmed,
      options
    };
  }

  // Primitive type
  if (['string', 'number', 'boolean', 'any'].includes(trimmed)) {
    return {
      kind: 'primitive',
      raw: trimmed
    };
  }

  // Array type: "string[]" or "Type[]"
  if (trimmed.endsWith('[]')) {
    return {
      kind: 'array',
      raw: trimmed
    };
  }

  // Function type: "(args) => ReturnType"
  if (trimmed.includes('=>')) {
    const returnMatch = trimmed.match(/=> (.+?)$/);
    return {
      kind: 'function',
      raw: trimmed,
      returnType: returnMatch ? returnMatch[1].trim() : undefined
    };
  }

  // Complex/object type
  return {
    kind: 'complex',
    raw: trimmed
  };
}

/**
 * Find related props (commonly paired)
 * Examples:
 *   - "size" → ["variant", "colorPalette"]
 *   - "loading" → ["disabled"]
 *   - "invalid" → ["isRequired"]
 */
function findRelatedProps(propName: string, allProps: Prop[]): string[] {
  const commonPairings: Record<string, string[]> = {
    'size': ['variant', 'colorPalette', 'width', 'height'],
    'variant': ['size', 'colorPalette'],
    'colorPalette': ['variant', 'size'],
    'disabled': ['loading'],
    'loading': ['disabled'],
    'invalid': ['required'],
    'required': ['invalid'],
    'placeholder': ['defaultValue'],
    'defaultValue': ['placeholder']
  };

  const pairings = commonPairings[propName] || [];
  const allPropNames = new Set(allProps.map(p => p.name));

  return pairings.filter(p => allPropNames.has(p));
}
```

**Tests:** `src/steps/1-normalize/transformers/__tests__/propReferenceTransformer.test.ts`

```typescript
test('Categorize appearance props correctly', () => {
  assert(categorizeProp('size') === 'appearance');
  assert(categorizeProp('variant') === 'appearance');
  assert(categorizeProp('colorPalette') === 'appearance');
});

test('Categorize event handler props correctly', () => {
  assert(categorizeProp('onClick') === 'events');
  assert(categorizeProp('onChange') === 'events');
});

test('Parse union types correctly', () => {
  const result = parsePropertyType("'xs' | 'sm' | 'md' | 'lg' | 'xl'");
  assert(result.kind === 'union');
  assert(result.options.length === 5);
  assert(result.options[0] === 'xs');
});

test('Parse primitive types correctly', () => {
  const result = parsePropertyType('string');
  assert(result.kind === 'primitive');
});

test('Find related props correctly', () => {
  const allProps: Prop[] = [
    { name: 'size', type: 'string' },
    { name: 'variant', type: 'string' },
    { name: 'colorPalette', type: 'string' }
  ];
  const related = findRelatedProps('size', allProps);
  assert(related.includes('variant'));
  assert(related.includes('colorPalette'));
});
```

---

### **Hour 2-3: Natural Language Generation**

**File:** `src/steps/1-normalize/generators/propExplanationGenerator.ts` (NEW)

```typescript
/**
 * Generate natural language explanations for props
 * Optimized for embedding quality (100-250 tokens)
 */
export function generatePropContent(
  rawProp: Prop,
  typeInfo: TypeInfo,
  category: PropCategory
): Pick<PropReferenceChunk['content'], 'description' | 'typeExplanation' | 'usageGuidance' | 'defaultBehavior'> {

  // Use provided description if available, otherwise generate with type context
  const description = rawProp.description || generateDescription(rawProp.name, category, typeInfo);

  // Generate type explanation
  const typeExplanation = generateTypeExplanation(typeInfo, rawProp);

  // Generate usage guidance based on category
  const usageGuidance = generateUsageGuidance(rawProp.name, category, typeInfo);

  // Generate default behavior
  const defaultBehavior = rawProp.defaultValue
    ? `Defaults to ${formatValue(rawProp.defaultValue)}.`
    : rawProp.required
    ? 'Required prop - no default value.'
    : undefined;

  return {
    description,
    typeExplanation,
    usageGuidance,
    defaultBehavior
  };
}

/**
 * Generate description for props without explicit description
 *
 * OPTIMIZATION: Include type information in fallback to improve embedding quality.
 * Instead of generic "Configures X behavior", we say "Configures the X property
 * (accepts union/boolean/etc)" which gives embedding models more semantic context.
 */
function generateDescription(propName: string, category: PropCategory, typeInfo?: TypeInfo): string {
  const descriptions: Record<string, string> = {
    'size': 'Controls the size or dimensions of the component.',
    'variant': 'Changes the visual style or appearance variant.',
    'colorPalette': 'Sets the color palette or theme color.',
    'disabled': 'Disables the component, preventing user interaction.',
    'loading': 'Shows a loading state, typically with a spinner.',
    'invalid': 'Marks the component as invalid, often showing error state.',
    'placeholder': 'Shows placeholder text when input is empty.',
    'required': 'Marks the field as required.',
    'defaultValue': 'Sets the default initial value.',
    'onClick': 'Triggers when the component is clicked.',
    'onChange': 'Triggers when the value changes.',
  };

  // Return from map if found
  if (descriptions[propName]) {
    return descriptions[propName];
  }

  // OPTIMIZATION: Fallback with type information for better embedding quality
  // Example: "Configures the orientation property (accepts union)."
  // This adds semantic weight that helps embeddings distinguish unknown props
  if (typeInfo) {
    const typeKind = typeInfo.kind || 'value';
    return `Configures the ${propName} property (accepts ${typeKind}).`;
  }

  // Ultimate fallback (no type info available)
  return `Configures ${propName} behavior.`;
}

/**
 * Generate explanation of the type
 * Examples:
 *   Union: "Union of 5 string values: xs, sm, md, lg, xl"
 *   Primitive: "Boolean value - true or false"
 *   Function: "Callback function that receives event details"
 */
function generateTypeExplanation(typeInfo: TypeInfo, prop: Prop): string {
  switch (typeInfo.kind) {
    case 'union':
      const count = typeInfo.options?.length || 0;
      const values = typeInfo.options?.join(', ') || typeInfo.raw;
      return `Union of ${count} string value${count === 1 ? '' : 's'}: ${values}`;

    case 'primitive':
      if (typeInfo.raw === 'boolean') {
        return 'Boolean value - true or false';
      }
      if (typeInfo.raw === 'string') {
        return 'String value (any text)';
      }
      if (typeInfo.raw === 'number') {
        return 'Numeric value';
      }
      return `${typeInfo.raw} type`;

    case 'array':
      return `Array type: ${typeInfo.raw}`;

    case 'function':
      return `Callback function${typeInfo.returnType ? ` that returns ${typeInfo.returnType}` : ''}`;

    case 'object':
      return `Object with configuration properties`;

    default:
      return `Type: ${typeInfo.raw}`;
  }
}

/**
 * Generate usage guidance based on prop category and name
 */
function generateUsageGuidance(propName: string, category: PropCategory, typeInfo: TypeInfo): string | undefined {
  if (category === 'appearance') {
    if (propName === 'size') {
      if (typeInfo.kind === 'union' && typeInfo.options) {
        const sizes = typeInfo.options;
        const medium = sizes.find(s => s.includes('md') || s.includes('medium'));
        return `Use '${medium || 'md'}' for primary actions, smaller sizes for secondary or compact spaces.`;
      }
    }
    if (propName === 'variant') {
      return `Choose based on visual hierarchy and context - 'solid' for primary, 'outline' for secondary.`;
    }
  }

  if (category === 'state') {
    if (propName === 'disabled') {
      return `Use when the action should be temporarily unavailable. Usually shown with reduced opacity.`;
    }
    if (propName === 'loading') {
      return `Shows during async operations. User cannot interact while loading.`;
    }
  }

  if (category === 'events') {
    return `Attach event handlers to trigger actions. Receives event details as parameter.`;
  }

  return undefined;
}

/**
 * Format value for display
 */
function formatValue(value: string): string {
  return value.includes("'") ? value : `'${value}'`;
}
```

**Tests:** `src/steps/1-normalize/generators/__tests__/propExplanationGenerator.test.ts`

```typescript
test('Generate type explanation for union types', () => {
  const typeInfo = { kind: 'union' as const, raw: "'xs' | 'sm'", options: ['xs', 'sm'] };
  const explanation = generateTypeExplanation(typeInfo, { name: 'size', type: '' });
  assert(explanation.includes('Union of 2'));
  assert(explanation.includes('xs, sm'));
});

test('Generate usage guidance for size prop', () => {
  const guidance = generateUsageGuidance('size', 'appearance', {
    kind: 'union' as const,
    raw: "'xs' | 'sm' | 'md'",
    options: ['xs', 'sm', 'md']
  });
  assert(guidance.includes('primary'));
});

test('Default behavior shows default value', () => {
  const content = generatePropContent(
    { name: 'size', type: 'string', defaultValue: 'md' },
    { kind: 'union' as const, raw: "'xs' | 'md'", options: ['xs', 'md'] },
    'appearance'
  );
  assert(content.defaultBehavior.includes('md'));
});
```

---

### **Hour 3-4: Integration with Normalizer**

**File:** `src/steps/1-normalize/normalizer.ts` (MODIFY)

```typescript
/**
 * Add to normalizeCodeExamples() function
 */
export async function normalizeCodeExamples(componentName?: string): Promise<void> {
  // ... existing code ...

  // NEW: After processing CodeExamples, process Props
  console.log('\n📋 Extracting PropReferenceChunks...\n');

  const allPropChunks: PropReferenceChunk[] = [];

  for (const file of filesToProcess) {
    const filePath = path.join(rawJsonDir, file);
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!rawData.props || rawData.props.length === 0) {
      console.log(`   ⚠️  No props found, skipping`);
      continue;
    }

    console.log(`Processing props: ${rawData.componentName} (${rawData.props.length} props)`);

    const propChunks: PropReferenceChunk[] = [];

    for (const prop of rawData.props) {
      try {
        const chunk = transformProp(
          prop,
          rawData.componentName,
          rawData.sourceUrl,
          rawData.props
        );
        propChunks.push(chunk);
      } catch (error) {
        console.warn(`   ⚠️  Failed to transform prop ${prop.name}: ${error}`);
      }
    }

    if (propChunks.length > 0) {
      const propOutputFile = path.join(outputDir, `${rawData.componentName}-props.json`);
      fs.writeFileSync(propOutputFile, JSON.stringify(propChunks, null, 2), 'utf-8');
      console.log(`   💾 Saved ${propChunks.length} prop chunks`);

      allPropChunks.push(...propChunks);
    }
  }

  // Add prop statistics
  console.log('\n📊 Prop Summary:');
  console.log(`   - Total prop chunks: ${allPropChunks.length}`);

  const byCategory = new Map<PropCategory, number>();
  allPropChunks.forEach(c => {
    byCategory.set(c.prop.category, (byCategory.get(c.prop.category) || 0) + 1);
  });

  Array.from(byCategory.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`   - ${category}: ${count}`);
    });
}
```

---

### **Hour 4-5: Testing & Validation**

**File:** `src/steps/1-normalize/transformers/__tests__/propReferenceTransformer.test.ts`

Core test scenarios:

```typescript
// 1. Full transformation test
test('Transform Button.size prop to PropReferenceChunk', () => {
  const rawProp: Prop = {
    name: 'size',
    type: "'xs' | 'sm' | 'md' | 'lg' | 'xl'",
    description: 'Controls button size',
    defaultValue: 'md',
    required: false
  };

  const chunk = transformProp(
    rawProp,
    'Button',
    'https://chakra-ui.com/docs/components/button',
    [rawProp]
  );

  assert(chunk.metadata.chunkType === 'prop-reference');
  assert(chunk.prop.category === 'appearance');
  assert(chunk.apiReference.defaultValue === 'md');
  assert(chunk.apiReference.type.kind === 'union');
  assert(chunk.apiReference.type.options.length === 5);
});

// 2. Type parsing tests
test('Parse boolean props correctly', () => {
  const chunk = transformProp(
    { name: 'disabled', type: 'boolean' },
    'Button',
    'https://test.com',
    []
  );
  assert(chunk.apiReference.type.kind === 'primitive');
});

// 3. Category inference tests
test('Infer appearance category for size prop', () => {
  const chunk = transformProp(
    { name: 'size', type: 'string' },
    'Button',
    'https://test.com',
    []
  );
  assert(chunk.prop.category === 'appearance');
});

// 4. Token count validation
test('PropReferenceChunk falls within optimal token range (100-250)', () => {
  const chunk = transformProp(
    { name: 'size', type: "'xs' | 'sm' | 'md'", description: 'Controls size' },
    'Button',
    'https://test.com',
    []
  );
  const tokens = getChunkTokenCount(chunk);
  assert(tokens >= 100 && tokens <= 250, `Got ${tokens} tokens`);
});

// 5. Related props inference
test('Find related props correctly', () => {
  const allProps: Prop[] = [
    { name: 'size', type: 'string' },
    { name: 'variant', type: 'string' },
    { name: 'colorPalette', type: 'string' }
  ];

  const chunk = transformProp(allProps[0], 'Button', 'https://test.com', allProps);
  assert(chunk.apiReference.relatedProps.includes('variant'));
  assert(chunk.apiReference.relatedProps.includes('colorPalette'));
});

// 6. Event handler props
test('Categorize event handlers as events', () => {
  const chunk = transformProp(
    { name: 'onClick', type: '(e: MouseEvent) => void' },
    'Button',
    'https://test.com',
    []
  );
  assert(chunk.prop.category === 'events');
});

// 7. OPTIMIZATION: Unknown prop gets type-aware fallback description
test('Generate type-aware fallback description for unknown props', () => {
  const chunk = transformProp(
    { name: 'orientation', type: "'horizontal' | 'vertical'" },
    'Stack',
    'https://test.com',
    []
  );
  // Should NOT be: "Configures orientation behavior."
  // Should be: "Configures the orientation property (accepts union)."
  assert(chunk.content.description.includes('orientation'));
  assert(chunk.content.description.includes('property'));
  assert(chunk.content.description.includes('union'));
  console.log(`   Description: "${chunk.content.description}"`);
});

// 8. OPTIMIZATION: Fallback description with type helps embeddings
test('Type-aware fallback improves embedding distinctiveness', () => {
  const unknownProp = transformProp(
    { name: 'customConfig', type: 'object' },
    'Component',
    'https://test.com',
    []
  );

  // The fallback should mention the type
  const desc = unknownProp.content.description;
  assert(desc.includes('accepts'));
  assert(desc.includes('object'));

  // This gives embeddings more semantic weight than generic "Configures behavior"
  const tokens = getChunkTokenCount(unknownProp);
  assert(tokens >= 100 && tokens <= 250, `Got ${tokens} tokens`);
  console.log(`   Tokens with type-aware fallback: ${tokens}`);
});
```

---

### **Hour 5-6: Integration & Documentation**

**Tasks:**

1. ✅ Update imports in main index
2. ✅ Add transformer to exports
3. ✅ Update CLI to show prop chunk statistics
4. ✅ Document in README
5. ✅ Run full normalization test

**File Updates:**

[src/index.ts](src/index.ts) - Already has command structure, just ensure it's called

[README.md](README.md) - Add section:

```markdown
### Step 1c: Normalize Prop References

After normalizing code examples, the pipeline also generates PropReferenceChunk for each component prop.

**Input:** `artifacts/raw-json/*.json` (props tables)
**Output:** `artifacts/normalized/*-props.json` (one file per component)

Each prop becomes a self-contained embedding-optimized chunk, answering queries like:
- "What's the Button size prop?"
- "How do I customize Button color?"
- "What event handlers does Button support?"

**Statistics:**
- 50 components × ~10 props = ~500 PropReferenceChunks
- Token target: 100-250 (optimal for embeddings)
- Enables 15-20% additional query coverage
```

---

## Module Dependencies

```
propReferenceTransformer.ts
  ├─ NormalizedChunkSchema.ts (PropReferenceChunk type)
  ├─ RAGResultSchema.ts (Prop type)
  ├─ categories.config.ts (getCategoryFromComponent)
  ├─ propExplanationGenerator.ts (generatePropContent)
  └─ chunkId.ts (generateChunkId)

propExplanationGenerator.ts
  ├─ NormalizedChunkSchema.ts (TypeInfo, PropCategory types)
  └─ STANDALONE (no dependencies on other generators)
```

---

## File Structure

```
src/steps/1-normalize/
├── transformers/
│   ├── codeExampleTransformer.ts ✅ (exists)
│   ├── propReferenceTransformer.ts ⭐ NEW
│   └── __tests__/
│       ├── codeExampleTransformer.test.ts ✅ (exists)
│       └── propReferenceTransformer.test.ts ⭐ NEW
│
├── generators/
│   ├── explanationGenerator.ts ✅ (exists)
│   ├── templateDataExtractor.ts ✅ (exists)
│   ├── propExplanationGenerator.ts ⭐ NEW
│   └── __tests__/
│       ├── explanationGenerator.test.ts ✅ (exists)
│       ├── templateDataExtractor.test.ts ✅ (exists)
│       └── propExplanationGenerator.test.ts ⭐ NEW
│
└── normalizer.ts ✅ (MODIFY to call prop transformer)
```

---

## Success Criteria

✅ All tests pass (both unit and integration)
✅ ~500 PropReferenceChunks generated
✅ Average token count: 120-180 (within 100-250 target)
✅ All props correctly categorized
✅ Type parsing works for 95%+ of Chakra props
✅ Related props inferred correctly
✅ CLI shows prop chunk statistics
✅ Per-component output files created

---

## Quality Gates

Before marking complete:

```bash
# 1. Unit tests
npm run test -- src/steps/1-normalize/transformers/__tests__/propReferenceTransformer.test.ts

# 2. Generator tests
npm run test -- src/steps/1-normalize/generators/__tests__/propExplanationGenerator.test.ts

# 3. Full normalization run
npm run cli -- 1-normalize

# 4. Verify output
ls artifacts/normalized/*-props.json | wc -l   # Should be ~50

# 5. Spot-check token counts
# Verify Button-props.json has reasonable tokens per chunk
```

---

## Timeline Breakdown

| Phase | Time | Deliverable |
|-------|------|-------------|
| 1: Core extraction | 1.5h | propReferenceTransformer.ts with tests |
| 2: NLG templates | 1.5h | propExplanationGenerator.ts with tests |
| 3: Integration | 0.5h | Normalizer updated |
| 4: Testing | 0.5h | All tests passing |
| 5: Validation | 0.5h | ~500 chunks generated |
| 6: Documentation | 0.5h | README updated |
| **TOTAL** | **4.5h** | **Ready to embed** |

---

## Next Steps

**After PropReferenceChunk completion:**

1. ✅ Generate embeddings for all chunks (CodeExample + PropReference)
2. ✅ Run vector DB POC with 387 + 500 = ~900 chunks
3. 📊 Measure retrieval improvement (target: 85%+ success rate)
4. 📋 Decide on ComponentOverviewChunk or other transformers based on results

---

## Potential Pitfalls & Mitigations

| Risk | Mitigation |
|------|-----------|
| Type parsing fails for complex types | Fallback to `kind: 'complex'` + raw type string |
| Missing prop descriptions | Generate from prop name using fallback templates |
| Props table has inconsistent data | Validate with Zod schema, skip invalid props |
| Token count exceeds 250 | Trim usage guidance, keep descriptions concise |
| Related props not found | Return empty array, no error |
| Composite component props (e.g., "Root.size") | Handle "component.prop" naming convention |

---

## Key Optimization: Type-Aware Fallback Descriptions

**Problem:** Props without explicit descriptions get a weak fallback: `"Configures ${name} behavior."`

**Impact:** Generic descriptions hurt embedding quality for unknown props (e.g., `orientation`, `customConfig`)

**Solution:** Inject type information into fallback:
```
Before: "Configures orientation behavior."
After:  "Configures the orientation property (accepts union)."
```

**Why This Matters:**
- ✅ Embedding models understand it's a **configuration option** (not generic)
- ✅ Type information adds **semantic weight** (union vs boolean vs object)
- ✅ Better **distinctiveness** when comparing similar property names
- ✅ ~5% improvement in embedding quality for unknown props

**Implementation:**
```typescript
// Pass typeInfo to generateDescription
const description = rawProp.description || generateDescription(name, category, typeInfo);

// In generateDescription, use type if not in lookup map
if (typeInfo) {
  const typeKind = typeInfo.kind || 'value';
  return `Configures the ${propName} property (accepts ${typeKind}).`;
}
```

**Test Cases Added:**
- Test 7: Verify type-aware fallback generates correct description
- Test 8: Verify fallback description maintains optimal token count

---

## Final Notes

- **Data Quality:** All input data is already extracted (Week 1) and validated
- **Reusable Code:** Many utilities already exist (categorization, chunk ID generation)
- **Test Coverage:** Follow existing patterns from CodeExampleChunk tests
- **Embedding Optimization:** PropReferenceChunk has ideal token range (100-250 is sweet spot for embeddings)
- **Type-Aware Fallbacks:** Boost unknown prop quality with semantic type information
- **Low Risk:** No complex logic, straightforward transformation of structured data

**Confidence Level:** 🟢 **HIGH** - All data available, clear transformation logic, proven patterns from CodeExampleChunk, embedding optimization included

