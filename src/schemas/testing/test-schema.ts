// =============================================================================
// Schema Test - Demonstrates NormalizedChunkSchema Usage
// =============================================================================
// Run with: npx tsx src/schemas/testing/test-schema.ts
// =============================================================================

import {
  type CodeExampleChunk,
  type ComponentCategory,
  CodeExampleChunkSchema,
  validateChunk,
  getChunkTokenCount,
  estimateTokens
} from '../NormalizedChunkSchema.js';

import { generateChunkId, createDescriptor } from '../../utils/chunkId.js';

console.log('🧪 Testing NormalizedChunkSchema\n');
console.log('='.repeat(80));

// =============================================================================
// Test 1: Create a valid CodeExampleChunk
// =============================================================================

console.log('\n📦 Test 1: Creating a CodeExampleChunk\n');

const sampleChunk: CodeExampleChunk = {
  metadata: {
    chunkId: generateChunkId('Button', 'code-example', 'size-variants', '1'),
    chunkType: 'code-example',
    componentName: 'Button',
    sourceUrl: 'https://chakra-ui.com/docs/components/button',
    version: '3.27.1',
    tags: ['sizing', 'layout', 'button', 'variants'],
    category: 'form-controls' as ComponentCategory,
    complexity: 'simple',
    relatedChunks: [],
  },

  example: {
    title: 'Button Size Variants',
    intent: 'Demonstrate size prop usage',
    difficulty: 'basic'
  },

  content: {
    explanation: 'This example demonstrates how to control button dimensions using the size prop. It shows 5 size variants (xs, sm, md, lg, xl) arranged in a horizontal stack layout.',
    code: `import { Button, HStack } from "@chakra-ui/react"

const Demo = () => {
  return (
    <HStack wrap="wrap" gap="6">
      <Button size="xs">Button (xs)</Button>
      <Button size="sm">Button (sm)</Button>
      <Button size="md">Button (md)</Button>
      <Button size="lg">Button (lg)</Button>
      <Button size="xl">Button (xl)</Button>
    </HStack>
  )
}`,
    demonstrates: [
      'Using the size prop to control button dimensions',
      'HStack component for horizontal layout',
      'All five size variants: xs, sm, md, lg, xl'
    ],
    keyPoints: [
      "The size prop accepts string values: 'xs', 'sm', 'md', 'lg', 'xl'",
      "HStack with gap='6' provides consistent spacing between buttons",
      "wrap='wrap' allows buttons to flow to next line on small screens"
    ]
  },

  codeMetadata: {
    language: 'tsx',
    imports: [
      {
        source: '@chakra-ui/react',
        imports: ['Button', 'HStack'],
        type: 'named'
      }
    ],
    components: ['Button', 'HStack'],
    props: [
      {
        component: 'Button',
        prop: 'size',
        values: ['xs', 'sm', 'md', 'lg', 'xl']
      },
      {
        component: 'HStack',
        prop: 'wrap',
        values: ['wrap']
      },
      {
        component: 'HStack',
        prop: 'gap',
        values: ['6']
      }
    ],
    hasInteractivity: false,
    hasState: false,
    complexity: 7
  }
};

console.log('✅ Created chunk:', sampleChunk.metadata.chunkId);
console.log('   Component:', sampleChunk.metadata.componentName);
console.log('   Type:', sampleChunk.metadata.chunkType);
console.log('   Title:', sampleChunk.example.title);

// =============================================================================
// Test 2: Validate chunk against schema
// =============================================================================

console.log('\n📋 Test 2: Validating against Zod schema\n');

const validationResult = validateChunk(sampleChunk);

if (validationResult.success) {
  console.log('✅ Validation passed!');
  console.log('   Chunk is well-formed and type-safe');
} else {
  console.log('❌ Validation failed:');
  console.error(validationResult.error.format());
}

// =============================================================================
// Test 3: Calculate token count
// =============================================================================

console.log('\n📏 Test 3: Calculating token count\n');

const tokenCount = getChunkTokenCount(sampleChunk);
console.log(`Token count: ${tokenCount} tokens`);

if (tokenCount >= 200 && tokenCount <= 500) {
  console.log('✅ Chunk size is optimal (200-500 tokens)');
} else if (tokenCount < 200) {
  console.log('⚠️  Chunk is small (<200 tokens) - consider adding more detail');
} else {
  console.log('⚠️  Chunk is large (>500 tokens) - consider splitting');
}

// =============================================================================
// Test 4: Test chunk ID utilities
// =============================================================================

console.log('\n🔑 Test 4: Testing chunk ID utilities\n');

const testIds = [
  generateChunkId('Button', 'code-example', 'size-variants', '1'),
  generateChunkId('ColorPicker', 'composition-pattern', 'portal-usage', '1'),
  generateChunkId('Checkbox', 'prop-reference', 'root-size', '1'),
];

console.log('Generated IDs:');
testIds.forEach(id => console.log(`  - ${id}`));

console.log('\nDescriptor generation:');
const testTitles = [
  'Button with Multiple Sizes',
  'Loading States',
  'ColorPicker with Portal'
];
testTitles.forEach(title => {
  const descriptor = createDescriptor(title);
  console.log(`  "${title}" → "${descriptor}"`);
});

// =============================================================================
// Test 5: Schema validation with invalid data
// =============================================================================

console.log('\n❌ Test 5: Testing validation with invalid data\n');

const invalidChunk = {
  ...sampleChunk,
  metadata: {
    ...sampleChunk.metadata,
    chunkType: 'invalid-type' // This should fail
  }
};

const invalidResult = validateChunk(invalidChunk);

if (!invalidResult.success) {
  console.log('✅ Correctly rejected invalid chunk type');
  console.log('   Error:', invalidResult.error.issues[0].message);
} else {
  console.log('❌ Should have rejected invalid data');
}

// =============================================================================
// Summary
// =============================================================================

console.log('\n' + '='.repeat(80));
console.log('\n✅ All tests complete!\n');
console.log('Next steps:');
console.log('  1. Create inference utilities (sectionInferrer.ts, etc.)');
console.log('  2. Create natural language generators');
console.log('  3. Build transformation pipeline');
console.log('  4. Test with real Button.json data\n');
console.log('See NORMALIZATION_GUIDE.md for detailed implementation plan.\n');
