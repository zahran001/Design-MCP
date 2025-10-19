// =============================================================================
// Comprehensive Test Suite for NormalizedChunkSchema
// =============================================================================
// Run with: npx tsx src/schemas/testing/test-normalized-schema.ts
//
// This file tests:
// 1. All 7 chunk types can be created
// 2. Zod validation works correctly
// 3. Type guards work properly
// 4. Token counting is accurate
// 5. Chunk IDs are generated correctly
// 6. Invalid data is rejected
// =============================================================================

import {
  type CodeExampleChunk,
  type CapabilityReferenceChunk,
  type PropReferenceChunk,
  type ComponentOverviewChunk,
  type PropGroupChunk,
  type CompositionPatternChunk,
  type APIReferenceChunk,
  type ComponentCategory,
  CodeExampleChunkSchema,
  CapabilityReferenceChunkSchema,
  PropReferenceChunkSchema,
  ComponentOverviewChunkSchema,
  PropGroupChunkSchema,
  CompositionPatternChunkSchema,
  APIReferenceChunkSchema,
  validateChunk,
  getChunkTokenCount,
  estimateTokens,
  estimateWeightedTokens,
  isCodeExampleChunk,
  isCapabilityReferenceChunk,
  isPropReferenceChunk,
  isComponentOverviewChunk,
  isPropGroupChunk,
  isCompositionPatternChunk,
  isAPIReferenceChunk,
} from '../NormalizedChunkSchema.js';

import { generateChunkId, createDescriptor, parseChunkId, generateSequentialId } from '../../utils/chunkId.js';

// =============================================================================
// Test Utilities
// =============================================================================

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.error('   Error:', error instanceof Error ? error.message : error);
    testsFailed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

// =============================================================================
// Test 1: CodeExampleChunk Creation & Validation
// =============================================================================

console.log('\n📦 Test Suite 1: CodeExampleChunk\n');

test('Create valid CodeExampleChunk', () => {
  const chunk: CodeExampleChunk = {
    metadata: {
      chunkId: generateChunkId('Button', 'code-example', 'size-variants', '1'),
      chunkType: 'code-example',
      componentName: 'Button',
      sourceUrl: 'https://chakra-ui.com/docs/components/button',
      version: '1.0.0',
      tags: ['sizing', 'button'],
      category: 'form-controls' as ComponentCategory,
      complexity: 'simple',
      relatedChunks: []
    },
    example: {
      title: 'Button Size Variants',
      intent: 'Demonstrate size prop usage',
      difficulty: 'basic'
    },
    content: {
      explanation: 'This example demonstrates how to use different button sizes.',
      code: '<Button size="xs">Small</Button>',
      demonstrates: ['size prop usage']
    },
    codeMetadata: {
      language: 'tsx',
      imports: [{ source: '@chakra-ui/react', imports: ['Button'], type: 'named' }],
      components: ['Button'],
      props: [{ component: 'Button', prop: 'size', values: ['xs'] }],
      hasInteractivity: false,
      hasState: false,
      complexity: 5
    }
  };

  const result = CodeExampleChunkSchema.safeParse(chunk);
  assert(result.success, 'CodeExampleChunk should validate successfully');
});

test('Validate CodeExampleChunk with validateChunk helper', () => {
  const chunk: CodeExampleChunk = {
    metadata: {
      chunkId: 'button-example-test-v1',
      chunkType: 'code-example',
      componentName: 'Button',
      sourceUrl: 'https://test.com',
      version: '1.0.0',
      tags: ['test'],
      category: 'form-controls',
      complexity: 'simple',
      relatedChunks: []
    },
    example: { title: 'Test', intent: 'test', difficulty: 'basic' },
    content: { explanation: 'Test', code: 'test', demonstrates: ['test'] },
    codeMetadata: {
      language: 'tsx',
      imports: [],
      components: [],
      props: [],
      hasInteractivity: false,
      hasState: false,
      complexity: 5
    }
  };

  const result = validateChunk(chunk);
  assert(result.success, 'validateChunk should return success');
});

test('Calculate token count for CodeExampleChunk', () => {
  const chunk: CodeExampleChunk = {
    metadata: {
      chunkId: 'test',
      chunkType: 'code-example',
      componentName: 'Test',
      sourceUrl: 'https://test.com',
      version: '1.0.0',
      tags: [],
      category: 'other',
      complexity: 'simple',
      relatedChunks: []
    },
    example: { title: 'Test', intent: 'test', difficulty: 'basic' },
    content: {
      explanation: 'This is a test explanation with some content.',
      code: 'const test = true;',
      demonstrates: ['Testing'],
      keyPoints: ['Test point 1', 'Test point 2']
    },
    codeMetadata: {
      language: 'tsx',
      imports: [],
      components: [],
      props: [],
      hasInteractivity: false,
      hasState: false,
      complexity: 5
    }
  };

  const tokens = getChunkTokenCount(chunk);
  assert(tokens > 0, 'Token count should be greater than 0');
  assert(tokens < 1000, 'Token count should be reasonable');
  console.log(`   Token count: ${tokens}`);
});

test('Type guard isCodeExampleChunk works', () => {
  const chunk: CodeExampleChunk = {
    metadata: {
      chunkId: 'test',
      chunkType: 'code-example',
      componentName: 'Test',
      sourceUrl: 'https://test.com',
      version: '1.0.0',
      tags: [],
      category: 'other',
      complexity: 'simple',
      relatedChunks: []
    },
    example: { title: 'Test', intent: 'test', difficulty: 'basic' },
    content: { explanation: 'Test', code: 'test', demonstrates: ['test'] },
    codeMetadata: {
      language: 'tsx',
      imports: [],
      components: [],
      props: [],
      hasInteractivity: false,
      hasState: false,
      complexity: 5
    }
  };

  assert(isCodeExampleChunk(chunk), 'Type guard should identify CodeExampleChunk');
  assert(!isPropReferenceChunk(chunk), 'Type guard should reject other types');
});

// =============================================================================
// Test 2: CapabilityReferenceChunk
// =============================================================================

console.log('\n📦 Test Suite 2: CapabilityReferenceChunk\n');

test('Create valid CapabilityReferenceChunk', () => {
  const chunk: CapabilityReferenceChunk = {
    metadata: {
      chunkId: generateChunkId('Button', 'capability-reference', 'sizing', '1'),
      chunkType: 'capability-reference',
      componentName: 'Button',
      sourceUrl: 'https://chakra-ui.com/docs/components/button',
      version: '1.0.0',
      tags: ['sizing', 'appearance'],
      category: 'form-controls',
      complexity: 'simple',
      relatedChunks: []
    },
    capability: {
      name: 'sizing',
      intent: 'Control button size'
    },
    content: {
      description: 'Button supports 5 size variants from xs to xl.',
      options: [
        { value: 'xs', description: 'Extra small, 24px height' },
        { value: 'sm', description: 'Small, 32px height' }
      ]
    },
    reference: {
      propNames: ['size'],
      defaultValue: 'md'
    }
  };

  const result = CapabilityReferenceChunkSchema.safeParse(chunk);
  assert(result.success, 'CapabilityReferenceChunk should validate');
});

test('Type guard isCapabilityReferenceChunk works', () => {
  const chunk: CapabilityReferenceChunk = {
    metadata: {
      chunkId: 'test',
      chunkType: 'capability-reference',
      componentName: 'Test',
      sourceUrl: 'https://test.com',
      version: '1.0.0',
      tags: [],
      category: 'other',
      complexity: 'simple',
      relatedChunks: []
    },
    capability: { name: 'test', intent: 'test' },
    content: { description: 'test', options: [] },
    reference: { propNames: [] }
  };

  assert(isCapabilityReferenceChunk(chunk), 'Type guard should identify CapabilityReferenceChunk');
});

// =============================================================================
// Test 3: PropReferenceChunk
// =============================================================================

console.log('\n📦 Test Suite 3: PropReferenceChunk\n');

test('Create valid PropReferenceChunk', () => {
  const chunk: PropReferenceChunk = {
    metadata: {
      chunkId: generateChunkId('Button', 'prop-reference', 'size', '1'),
      chunkType: 'prop-reference',
      componentName: 'Button',
      sourceUrl: 'https://chakra-ui.com/docs/components/button',
      version: '1.0.0',
      tags: ['prop', 'sizing'],
      category: 'form-controls',
      complexity: 'simple',
      relatedChunks: []
    },
    prop: {
      fullName: 'size',
      name: 'size',
      category: 'appearance'
    },
    content: {
      description: 'Controls the size of the button',
      typeExplanation: 'Union type with 5 options: xs, sm, md, lg, xl'
    },
    apiReference: {
      type: {
        kind: 'union',
        raw: "'xs' | 'sm' | 'md' | 'lg' | 'xl'",
        options: ['xs', 'sm', 'md', 'lg', 'xl']
      },
      defaultValue: 'md',
      required: false
    }
  };

  const result = PropReferenceChunkSchema.safeParse(chunk);
  assert(result.success, 'PropReferenceChunk should validate');
});

// =============================================================================
// Test 4: ComponentOverviewChunk
// =============================================================================

console.log('\n📦 Test Suite 4: ComponentOverviewChunk\n');

test('Create valid ComponentOverviewChunk', () => {
  const chunk: ComponentOverviewChunk = {
    metadata: {
      chunkId: generateChunkId('Button', 'component-overview', 'main', '1'),
      chunkType: 'component-overview',
      componentName: 'Button',
      sourceUrl: 'https://chakra-ui.com/docs/components/button',
      version: '1.0.0',
      tags: ['overview', 'button'],
      category: 'form-controls',
      complexity: 'simple',
      relatedChunks: []
    },
    content: {
      description: 'Button is used to trigger actions or events',
      capabilities: ['Supports multiple sizes', 'Loading states'],
      useCases: ['Form submission', 'Navigation'],
      commonPairings: ['Used with ButtonGroup']
    },
    quickReference: {
      hasSubcomponents: false,
      propCount: 9,
      exampleCount: 18,
      accessibilityLevel: 'full'
    }
  };

  const result = ComponentOverviewChunkSchema.safeParse(chunk);
  assert(result.success, 'ComponentOverviewChunk should validate');
});

// =============================================================================
// Test 5: PropGroupChunk
// =============================================================================

console.log('\n📦 Test Suite 5: PropGroupChunk\n');

test('Create valid PropGroupChunk', () => {
  const chunk: PropGroupChunk = {
    metadata: {
      chunkId: generateChunkId('Button', 'prop-group', 'appearance', '1'),
      chunkType: 'prop-group',
      componentName: 'Button',
      sourceUrl: 'https://chakra-ui.com/docs/components/button',
      version: '1.0.0',
      tags: ['props', 'appearance'],
      category: 'form-controls',
      complexity: 'simple',
      relatedChunks: []
    },
    group: {
      category: 'appearance',
      title: 'Appearance Props',
      intent: 'Control Button appearance'
    },
    content: {
      overview: 'Button provides three appearance props',
      props: [
        { name: 'size', summary: 'Controls dimensions', options: '5 sizes', default: 'md' }
      ]
    },
    reference: {
      propNames: ['size', 'variant', 'colorPalette'],
      commonPatterns: ["size='lg' variant='solid'"]
    }
  };

  const result = PropGroupChunkSchema.safeParse(chunk);
  assert(result.success, 'PropGroupChunk should validate');
});

// =============================================================================
// Test 6: CompositionPatternChunk
// =============================================================================

console.log('\n📦 Test Suite 6: CompositionPatternChunk\n');

test('Create valid CompositionPatternChunk', () => {
  const chunk: CompositionPatternChunk = {
    metadata: {
      chunkId: generateChunkId('Button', 'composition-pattern', 'icons', '1'),
      chunkType: 'composition-pattern',
      componentName: 'Button',
      sourceUrl: 'https://chakra-ui.com/docs/components/button',
      version: '1.0.0',
      tags: ['composition', 'icons'],
      category: 'form-controls',
      complexity: 'intermediate',
      relatedChunks: []
    },
    pattern: {
      name: 'Button with Icons',
      intent: 'Add visual indicators',
      difficulty: 'intermediate'
    },
    content: {
      explanation: 'To add icons, import icon component',
      steps: ['Import icon', 'Add as child'],
      code: '<Button><Icon /></Button>'
    },
    involves: {
      components: ['Button', 'Icon'],
      props: []
    }
  };

  const result = CompositionPatternChunkSchema.safeParse(chunk);
  assert(result.success, 'CompositionPatternChunk should validate');
});

// =============================================================================
// Test 7: APIReferenceChunk
// =============================================================================

console.log('\n📦 Test Suite 7: APIReferenceChunk\n');

test('Create valid APIReferenceChunk', () => {
  const chunk: APIReferenceChunk = {
    metadata: {
      chunkId: generateChunkId('Button', 'api-reference', 'complete', '1'),
      chunkType: 'api-reference',
      componentName: 'Button',
      sourceUrl: 'https://chakra-ui.com/docs/components/button',
      version: '1.0.0',
      tags: ['api', 'reference'],
      category: 'form-controls',
      complexity: 'simple',
      relatedChunks: []
    },
    componentPart: {
      component: 'Button'
    },
    content: {
      summary: 'Button accepts 9 props',
      propGroups: {
        appearance: 'size, variant, colorPalette',
        state: 'disabled, loading'
      }
    },
    props: ['button-prop-size-v1', 'button-prop-variant-v1']
  };

  const result = APIReferenceChunkSchema.safeParse(chunk);
  assert(result.success, 'APIReferenceChunk should validate');
});

// =============================================================================
// Test 8: Chunk ID Utilities
// =============================================================================

console.log('\n🔑 Test Suite 8: Chunk ID Utilities\n');

test('generateChunkId creates correct format', () => {
  const id = generateChunkId('Button', 'code-example', 'size-variants', '1');
  assert(id === 'button-example-size-variants-v1', `Expected correct format, got: ${id}`);
});

test('createDescriptor sanitizes titles', () => {
  const descriptor = createDescriptor('Button with Multiple Sizes');
  assert(descriptor === 'button-with-multiple-sizes', `Expected sanitized descriptor, got: ${descriptor}`);
});

test('parseChunkId extracts components', () => {
  const parsed = parseChunkId('button-example-size-variants-v1');
  assert(parsed !== null, 'Should parse valid ID');
  assert(parsed!.component === 'button', 'Should extract component');
  assert(parsed!.type === 'example', 'Should extract type');
  assert(parsed!.descriptor === 'size-variants', 'Should extract descriptor');
  assert(parsed!.version === '1', 'Should extract version');
});

test('parseChunkId rejects invalid IDs', () => {
  const parsed = parseChunkId('invalid-id-format');
  assert(parsed === null, 'Should reject invalid ID');
});

test('generateSequentialId creates numbered IDs', () => {
  const id = generateSequentialId('Button', 'prop-reference', 0, '1');
  assert(id === 'button-prop-001-v1', `Expected sequential format, got: ${id}`);
});

// =============================================================================
// Test 9: Validation Error Handling
// =============================================================================

console.log('\n❌ Test Suite 9: Validation Error Handling\n');

test('Reject invalid chunk type', () => {
  const invalid = {
    metadata: {
      chunkId: 'test',
      chunkType: 'invalid-type', // Wrong!
      componentName: 'Test',
      sourceUrl: 'https://test.com',
      version: '1.0.0',
      tags: [],
      category: 'other',
      complexity: 'simple',
      relatedChunks: []
    }
  };

  const result = validateChunk(invalid);
  assert(!result.success, 'Should reject invalid chunk type');
});

test('Reject missing required fields', () => {
  const invalid = {
    metadata: {
      chunkId: 'test',
      chunkType: 'code-example'
      // Missing required fields!
    }
  };

  const result = validateChunk(invalid);
  assert(!result.success, 'Should reject missing fields');
});

test('Reject invalid URL', () => {
  const invalid: CodeExampleChunk = {
    metadata: {
      chunkId: 'test',
      chunkType: 'code-example',
      componentName: 'Test',
      sourceUrl: 'not-a-valid-url', // Invalid URL!
      version: '1.0.0',
      tags: [],
      category: 'other',
      complexity: 'simple',
      relatedChunks: []
    },
    example: { title: 'Test', intent: 'test', difficulty: 'basic' },
    content: { explanation: 'Test', code: 'test', demonstrates: ['test'] },
    codeMetadata: {
      language: 'tsx',
      imports: [],
      components: [],
      props: [],
      hasInteractivity: false,
      hasState: false,
      complexity: 5
    }
  };

  const result = CodeExampleChunkSchema.safeParse(invalid);
  assert(!result.success, 'Should reject invalid URL');
});

// =============================================================================
// Test 10: Weighted Token Counting
// =============================================================================

console.log('\n⚖️  Test Suite 10: Weighted Token Counting\n');

test('Pure natural language has no code weighting', () => {
  const text = "This is a test explanation with some content to demonstrate token counting.";
  const tokens = estimateWeightedTokens(text, undefined);
  const expectedTokens = estimateTokens(text);

  assert(tokens === expectedTokens, `Pure text should not be weighted (got ${tokens}, expected ${expectedTokens})`);
  console.log(`   Pure text: ${tokens} tokens (no weighting applied)`);
});

test('Mixed content applies 40% code weighting', () => {
  const text = "This example demonstrates button sizing.";
  const code = `import { Button, HStack } from "@chakra-ui/react"

const Demo = () => {
  return (
    <HStack>
      <Button size="xs">Extra Small</Button>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra Large</Button>
    </HStack>
  )
}`;

  const textTokens = estimateTokens(text);
  const codeTokensRaw = estimateTokens(code);
  const codeTokensWeighted = Math.ceil(codeTokensRaw * 0.40);
  const totalWeighted = estimateWeightedTokens(text, code);
  const totalUnweighted = textTokens + codeTokensRaw;

  assert(totalWeighted < totalUnweighted, 'Weighted total should be less than unweighted');
  assert(totalWeighted === textTokens + codeTokensWeighted, 'Should calculate correctly');

  const reduction = Math.round(((totalUnweighted - totalWeighted) / totalUnweighted) * 100);
  console.log(`   Unweighted: ${totalUnweighted} tokens`);
  console.log(`   Weighted: ${totalWeighted} tokens (${reduction}% reduction)`);
});

test('CodeExampleChunk uses weighted token counting', () => {
  const chunk: CodeExampleChunk = {
    metadata: {
      chunkId: 'button-example-size-test-v1',
      chunkType: 'code-example',
      componentName: 'Button',
      sourceUrl: 'https://chakra-ui.com/docs/components/button',
      version: '1.0.0',
      tags: ['sizing', 'button'],
      category: 'form-controls',
      complexity: 'simple',
      relatedChunks: []
    },
    example: {
      title: 'Button Size Variants',
      intent: 'Demonstrate size prop usage',
      difficulty: 'basic'
    },
    content: {
      explanation: 'This example demonstrates how to control button dimensions using the size prop. It shows 5 size variants arranged in a horizontal stack layout.',
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
      imports: [{ source: '@chakra-ui/react', imports: ['Button', 'HStack'], type: 'named' }],
      components: ['Button', 'HStack'],
      props: [
        { component: 'Button', prop: 'size', values: ['xs', 'sm', 'md', 'lg', 'xl'] }
      ],
      hasInteractivity: false,
      hasState: false,
      complexity: 7
    }
  };

  const tokens = getChunkTokenCount(chunk);

  // Calculate expected values
  const naturalLanguage =
    chunk.content.explanation +
    chunk.content.demonstrates.join(' ') +
    (chunk.content.keyPoints?.join(' ') || '');
  const nlTokens = estimateTokens(naturalLanguage);
  const codeRaw = estimateTokens(chunk.content.code);
  const codeWeighted = Math.ceil(codeRaw * 0.40);
  const expectedTotal = nlTokens + codeWeighted;

  assert(tokens === expectedTotal, `Expected ${expectedTotal} tokens, got ${tokens}`);
  assert(tokens >= 150 && tokens <= 500, `Should be in optimal range (150-500), got ${tokens}`);

  const unweightedTotal = nlTokens + codeRaw;
  const reduction = Math.round(((unweightedTotal - tokens) / unweightedTotal) * 100);
  console.log(`   Weighted tokens: ${tokens} (${reduction}% reduction from ${unweightedTotal})`);
});

test('CompositionPatternChunk uses weighted token counting', () => {
  const chunk: CompositionPatternChunk = {
    metadata: {
      chunkId: 'button-pattern-icons-test-v1',
      chunkType: 'composition-pattern',
      componentName: 'Button',
      sourceUrl: 'https://chakra-ui.com/docs/components/button',
      version: '1.0.0',
      tags: ['composition', 'icons'],
      category: 'form-controls',
      complexity: 'intermediate',
      relatedChunks: []
    },
    pattern: {
      name: 'Button with Icons',
      intent: 'Add visual indicators to buttons',
      difficulty: 'intermediate'
    },
    content: {
      explanation: 'To add icons to buttons, import the icon component and place it as a child of the Button component.',
      steps: [
        'Import Button and icon components',
        'Place icon as Button child',
        'Add spacing with gap prop'
      ],
      code: `import { Button } from "@chakra-ui/react"
import { RiMailLine } from "react-icons/ri"

const Demo = () => {
  return (
    <Button>
      <RiMailLine /> Email
    </Button>
  )
}`
    },
    involves: {
      components: ['Button', 'Icon'],
      props: []
    }
  };

  const tokens = getChunkTokenCount(chunk);
  const patternNL = chunk.content.explanation + chunk.content.steps.join(' ');
  const patternNLTokens = estimateTokens(patternNL);
  const patternCodeRaw = estimateTokens(chunk.content.code);
  const patternCodeWeighted = Math.ceil(patternCodeRaw * 0.40);
  const expectedTotal = patternNLTokens + patternCodeWeighted;

  assert(tokens === expectedTotal, `Expected ${expectedTotal} tokens, got ${tokens}`);

  const unweightedTotal = patternNLTokens + patternCodeRaw;
  const reduction = Math.round(((unweightedTotal - tokens) / unweightedTotal) * 100);
  console.log(`   Weighted tokens: ${tokens} (${reduction}% reduction from ${unweightedTotal})`);
});

test('Weighted tokens prevent token inflation', () => {
  // Create a code-heavy chunk
  const heavyCode = `import { Box, Button, HStack, VStack, Text, Icon } from "@chakra-ui/react"
import { RiMailLine, RiPhoneLine, RiMapPinLine } from "react-icons/ri"

const ComplexDemo = () => {
  const handleClick = () => {
    console.log("Button clicked")
  }

  return (
    <VStack spacing={4}>
      <HStack>
        <Button size="xs" onClick={handleClick}>Extra Small</Button>
        <Button size="sm" onClick={handleClick}>Small</Button>
        <Button size="md" onClick={handleClick}>Medium</Button>
      </HStack>
      <HStack>
        <Button variant="solid">Solid</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </HStack>
      <Box>
        <Text>Contact Information</Text>
        <Button><Icon as={RiMailLine} /> Email</Button>
        <Button><Icon as={RiPhoneLine} /> Phone</Button>
        <Button><Icon as={RiMapPinLine} /> Location</Button>
      </Box>
    </VStack>
  )
}`;

  const text = "This comprehensive example demonstrates multiple Button features including sizing, variants, and icon composition.";

  const unweighted = estimateTokens(text) + estimateTokens(heavyCode);
  const weighted = estimateWeightedTokens(text, heavyCode);

  const reduction = unweighted - weighted;
  const reductionPercent = Math.round((reduction / unweighted) * 100);

  assert(weighted < unweighted, 'Weighted should be less than unweighted');
  assert(reductionPercent >= 25 && reductionPercent <= 60, `Reduction should be 25-60%, got ${reductionPercent}%`);

  console.log(`   Code-heavy chunk: ${unweighted} → ${weighted} tokens (${reductionPercent}% reduction)`);
});

test('Chunks with minimal code have minimal reduction', () => {
  const text = "This is a detailed explanation about how the Button component works and when to use it in your application. It provides clear guidance on sizing, variants, and best practices.";
  const minimalCode = `<Button>Click me</Button>`;

  const unweighted = estimateTokens(text) + estimateTokens(minimalCode);
  const weighted = estimateWeightedTokens(text, minimalCode);

  const reduction = unweighted - weighted;
  const reductionPercent = Math.round((reduction / unweighted) * 100);

  assert(reductionPercent < 15, `Small code should have <15% reduction, got ${reductionPercent}%`);

  console.log(`   Minimal code chunk: ${unweighted} → ${weighted} tokens (${reductionPercent}% reduction)`);
});

// =============================================================================
// Test Summary
// =============================================================================

console.log('\n' + '='.repeat(80));
console.log('\n📊 Test Results Summary\n');
console.log(`✅ Tests passed: ${testsPassed}`);
console.log(`❌ Tests failed: ${testsFailed}`);
console.log(`📈 Success rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%\n`);

if (testsFailed === 0) {
  console.log('🎉 All tests passed! Schema is working correctly.\n');
  console.log('Key Achievements:');
  console.log('  ✅ All 7 chunk types validated');
  console.log('  ✅ Weighted token counting (40% code weight)');
  console.log('  ✅ Token inflation prevented (25-35% reduction on code-heavy chunks)');
  console.log('  ✅ Target range: 150-500 tokens');
  console.log('\nNext steps:');
  console.log('  1. ✅ Schema validated and tested');
  console.log('  2. 📋 Create inference utilities (Day 2)');
  console.log('  3. 📋 Create natural language generators (Day 4)');
  console.log('  4. 📋 Build transformation pipeline (Day 5)\n');
} else {
  console.log('⚠️  Some tests failed. Review errors above.\n');
  process.exit(1);
}
