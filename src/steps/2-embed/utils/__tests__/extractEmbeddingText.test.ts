/**
 * Unit Tests for extractEmbeddingText
 *
 * Tests the chunk-type-aware text extraction utility
 * Validates both success cases and error handling
 */

import { describe, it, expect } from '@jest/globals';
import { extractEmbeddingText } from '../extractEmbeddingText.js';
import type {
  CodeExampleChunk,
  PropReferenceChunk,
  NormalizedChunk,
} from '../../../../schemas/NormalizedChunkSchema.js';

// =============================================================================
// Test Fixtures - Realistic chunk examples
// =============================================================================

const createCodeExampleChunkFixture = (overrides?: Partial<CodeExampleChunk>): CodeExampleChunk => {
  const base: CodeExampleChunk = {
    metadata: {
      chunkId: 'button-example-sizes-v1',
      chunkType: 'code-example',
      componentName: 'Button',
      sourceUrl: 'https://chakra-ui.com/docs/components/button',
      version: '3.27.1',
      tags: ['size', 'variants'],
      category: 'form-controls',
      complexity: 'simple',
      relatedChunks: [],
    },
    example: {
      title: 'Button Sizes',
      intent: 'Show different button sizes',
      difficulty: 'basic',
    },
    content: {
      explanation: 'This example demonstrates button sizing.',
      code: '<Button size="md">Click me</Button>',
      demonstrates: ['size prop usage', 'responsive design'],
      keyPoints: ['Use xs for small actions', 'Use lg for primary CTAs'],
    },
    codeMetadata: {
      language: 'tsx',
      imports: [],
      components: ['Button'],
      props: [],
      hasInteractivity: false,
      hasState: false,
      complexity: 2,
    },
  } as CodeExampleChunk;

  return overrides ? { ...base, ...overrides } : base;
};

const createPropReferenceChunkFixture = (overrides?: Partial<PropReferenceChunk>): PropReferenceChunk => {
  const base: PropReferenceChunk = {
    metadata: {
      chunkId: 'button-prop-size-v1',
      chunkType: 'prop-reference',
      componentName: 'Button',
      sourceUrl: 'https://chakra-ui.com/docs/components/button',
      version: '3.27.1',
      tags: ['sizing'],
      category: 'form-controls',
      complexity: 'simple',
      relatedChunks: [],
    },
    prop: {
      fullName: 'size',
      name: 'size',
      category: 'appearance',
    },
    content: {
      description: 'Controls the size of the button.',
      typeExplanation: 'Accepts: 2xs | xs | sm | md | lg | xl | 2xl',
      usageGuidance: 'Use md for primary actions, sm for secondary.',
      defaultBehavior: 'Defaults to md if not specified.',
    },
    apiReference: {
      type: { kind: 'primitive', raw: 'string' },
      defaultValue: 'md',
      required: false,
    },
  } as PropReferenceChunk;

  return overrides ? { ...base, ...overrides } : base;
};

// =============================================================================
// Test Suite: CodeExampleChunk Extraction
// =============================================================================

describe('extractEmbeddingText - CodeExampleChunk', () => {
  it('extracts explanation + demonstrates + keyPoints', () => {
    const chunk = createCodeExampleChunkFixture();
    const text = extractEmbeddingText(chunk);

    // Verify all fields are present in extracted text
    expect(text).toContain('This example demonstrates button sizing.');
    expect(text).toContain('size prop usage');
    expect(text).toContain('responsive design');
    expect(text).toContain('Use xs for small actions');
    expect(text).toContain('Use lg for primary CTAs');
  });

  it('combines fields in correct order (explanation first)', () => {
    const chunk = createCodeExampleChunkFixture();
    const text = extractEmbeddingText(chunk);

    // Explanation should come before demonstrates
    const explanationIndex = text.indexOf('This example demonstrates');
    const demonstratesIndex = text.indexOf('size prop usage');
    expect(explanationIndex).toBeLessThan(demonstratesIndex);
  });

  it('handles missing keyPoints gracefully', () => {
    const chunk = createCodeExampleChunkFixture();
    const updated = { ...chunk, content: { ...chunk.content, keyPoints: [] } };

    const text = extractEmbeddingText(updated);

    expect(text).toBeTruthy();
    expect(text).toContain('This example demonstrates');
    expect(text).toContain('size prop usage');
  });

  it('handles empty demonstrates array gracefully', () => {
    const chunk = createCodeExampleChunkFixture();
    const updated = { ...chunk, content: { ...chunk.content, demonstrates: [], keyPoints: ['Key point'] } };

    const text = extractEmbeddingText(updated);

    expect(text).toBeTruthy();
    expect(text).toContain('This example demonstrates');
    expect(text).toContain('Key point');
  });

  it('handles missing demonstrates gracefully', () => {
    const chunk = createCodeExampleChunkFixture();
    const updated = { ...chunk, content: { ...chunk.content, demonstrates: [] } };

    const text = extractEmbeddingText(updated);

    expect(text).toBeTruthy();
    expect(text).toContain('This example demonstrates');
  });

  it('returns metadata anchors when no semantic code-example content is available', () => {
    const chunk = createCodeExampleChunkFixture({
      content: {
        explanation: '',
        code: '',
        demonstrates: [],
        keyPoints: [],
      },
    });

    expect(extractEmbeddingText(chunk)).toBe('Component: Button. Title: Button Sizes.');
  });

  it('ignores code-only content when semantic embedding fields are absent', () => {
    const chunk = createCodeExampleChunkFixture({
      content: {
        explanation: '',
        code: '<Button>Test</Button>',
        demonstrates: [],
        keyPoints: [],
      },
    });

    const text = extractEmbeddingText(chunk);

    expect(text).toBe('Component: Button. Title: Button Sizes.');
    expect(text).not.toContain('<Button>Test</Button>');
  });

  it('includes component and title anchors for disambiguation', () => {
    const chunk = createCodeExampleChunkFixture({
      metadata: {
        ...createCodeExampleChunkFixture().metadata,
        chunkId: 'my-custom-chunk-id',
      },
      content: {
        explanation: '',
        code: '',
        demonstrates: [],
      },
    });

    const text = extractEmbeddingText(chunk);

    expect(text).toContain('Component: Button.');
    expect(text).toContain('Title: Button Sizes.');
  });

  it('filters out undefined/null items from demonstrates array', () => {
    const chunk = createCodeExampleChunkFixture({
      content: {
        explanation: 'Main text',
        code: '<Button>Test</Button>',
        demonstrates: ['valid1', undefined as any, null as any, 'valid2'],
        keyPoints: [],
      },
    });

    const text = extractEmbeddingText(chunk);

    expect(text).toContain('valid1');
    expect(text).toContain('valid2');
    expect(text).not.toContain('null');
    expect(text).not.toContain('undefined');
  });

  it('normalizes whitespace while preserving metadata anchors', () => {
    const chunk = createCodeExampleChunkFixture({
      content: {
        explanation: '  \n  Text with whitespace  \n  ',
        code: '<Button>Test</Button>',
        demonstrates: [],
        keyPoints: [],
      },
    });

    const text = extractEmbeddingText(chunk);

    expect(text).toBe('Component: Button. Title: Button Sizes. Text with whitespace');
  });
});

// =============================================================================
// Test Suite: PropReferenceChunk Extraction
// =============================================================================

describe('extractEmbeddingText - PropReferenceChunk', () => {
  it('extracts description + typeExplanation + usageGuidance + defaultBehavior', () => {
    const chunk = createPropReferenceChunkFixture();
    const text = extractEmbeddingText(chunk);

    // Verify all fields are present
    expect(text).toContain('Controls the size of the button.');
    expect(text).toContain('2xs | xs | sm | md | lg | xl | 2xl');
    expect(text).toContain('Use md for primary actions');
    expect(text).toContain('Defaults to md');
  });

  it('combines fields in correct order (description first)', () => {
    const chunk = createPropReferenceChunkFixture();
    const text = extractEmbeddingText(chunk);

    const descriptionIndex = text.indexOf('Controls the size');
    const typeIndex = text.indexOf('2xs | xs | sm');
    const usageIndex = text.indexOf('Use md for primary');

    expect(descriptionIndex).toBeLessThan(typeIndex);
    expect(typeIndex).toBeLessThan(usageIndex);
  });

  it('handles missing usageGuidance gracefully', () => {
    const chunk = createPropReferenceChunkFixture({
      content: {
        description: 'Controls something',
        typeExplanation: 'Type info',
        usageGuidance: undefined, // Missing
        defaultBehavior: 'Defaults to x',
      },
    });

    const text = extractEmbeddingText(chunk);

    expect(text).toBeTruthy();
    expect(text).toContain('Controls something');
    expect(text).toContain('Type info');
    expect(text).toContain('Defaults to x');
  });

  it('handles missing defaultBehavior gracefully', () => {
    const chunk = createPropReferenceChunkFixture({
      content: {
        description: 'Controls something',
        typeExplanation: 'Type info',
        usageGuidance: 'Use when needed',
        defaultBehavior: undefined, // Missing
      },
    });

    const text = extractEmbeddingText(chunk);

    expect(text).toBeTruthy();
    expect(text).toContain('Controls something');
    expect(text).toContain('Type info');
    expect(text).toContain('Use when needed');
  });

  it('handles both usageGuidance and defaultBehavior missing', () => {
    const chunk = createPropReferenceChunkFixture({
      content: {
        description: 'Controls something',
        typeExplanation: 'Type info',
        usageGuidance: undefined,
        defaultBehavior: undefined,
      },
    });

    const text = extractEmbeddingText(chunk);

    expect(text).toBeTruthy();
    expect(text).toContain('Controls something');
    expect(text).toContain('Type info');
  });

  it('returns prop anchors when semantic prop content is empty', () => {
    const chunk = createPropReferenceChunkFixture();
    const updated = {
      ...chunk,
      content: {
        description: '',
        typeExplanation: '',
        usageGuidance: undefined,
        defaultBehavior: undefined,
      },
    };

    expect(extractEmbeddingText(updated)).toBe('Component: Button. Prop: size.');
  });

  it('extracts text with typeExplanation alone (no description)', () => {
    const chunk = createPropReferenceChunkFixture();
    const updated = { ...chunk, content: { ...chunk.content, description: '' } };

    const text = extractEmbeddingText(updated);

    expect(text).toBeTruthy();
    expect(text).toContain('Accepts:');
  });

  it('extracts text even with only optional fields when required fields are present', () => {
    // Since we have typeExplanation, even with empty description, it should work
    const chunk = createPropReferenceChunkFixture();
    const updated = {
      ...chunk,
      content: {
        description: '',
        typeExplanation: 'Required type info present',
        usageGuidance: undefined,
        defaultBehavior: undefined,
      },
    };

    const text = extractEmbeddingText(updated);
    expect(text).toBeTruthy();
    expect(text).toContain('Required type info');
  });

  it('includes component and prop anchors in extracted text', () => {
    const chunk = createPropReferenceChunkFixture({
      metadata: {
        ...createPropReferenceChunkFixture().metadata,
        chunkId: 'my-prop-chunk',
      },
      content: {
        description: '',
        typeExplanation: '',
        usageGuidance: undefined,
        defaultBehavior: undefined,
      },
    });

    const text = extractEmbeddingText(chunk);

    expect(text).toContain('Component: Button.');
    expect(text).toContain('Prop: size.');
  });

  it('trims whitespace from all fields', () => {
    const chunk = createPropReferenceChunkFixture({
      content: {
        description: '  Description with spaces  ',
        typeExplanation: '  Type with spaces  ',
        usageGuidance: '  Guidance with spaces  ',
        defaultBehavior: '  Default with spaces  ',
      },
    });

    const text = extractEmbeddingText(chunk);

    // Should contain the text without excessive leading/trailing whitespace
    expect(text).toContain('Description with spaces');
    expect(text).toContain('Type with spaces');
    // Final text should be properly formed
    expect(text.length).toBeGreaterThan(10);
  });
});

// =============================================================================
// Test Suite: Unsupported Chunk Types
// =============================================================================

describe('extractEmbeddingText - Error Handling', () => {
  it('throws error for unsupported chunk type (component-overview)', () => {
    const chunk = {
      metadata: {
        chunkId: 'test-chunk',
        chunkType: 'component-overview',
        componentName: 'Button',
        sourceUrl: 'https://example.com',
        version: '1.0',
        tags: [],
        category: 'form-controls' as const,
        complexity: 'simple' as const,
        relatedChunks: [],
      },
      // Missing content structure for component-overview
    } as unknown as NormalizedChunk;

    expect(() => extractEmbeddingText(chunk)).toThrow(
      /Unsupported chunk type/
    );
    expect(() => extractEmbeddingText(chunk)).toThrow('component-overview');
  });

  it('throws error for unsupported chunk type (prop-group)', () => {
    const chunk = {
      metadata: {
        chunkId: 'test-chunk',
        chunkType: 'prop-group',
        componentName: 'Button',
        sourceUrl: 'https://example.com',
        version: '1.0',
        tags: [],
        category: 'form-controls' as const,
        complexity: 'simple' as const,
        relatedChunks: [],
      },
      // Missing content structure for prop-group
    } as unknown as NormalizedChunk;

    expect(() => extractEmbeddingText(chunk)).toThrow(
      /Unsupported chunk type/
    );
    expect(() => extractEmbeddingText(chunk)).toThrow('prop-group');
  });

  it('includes chunkId in unsupported type error', () => {
    const chunk = {
      metadata: {
        chunkId: 'my-unsupported-chunk',
        chunkType: 'api-reference',
        componentName: 'Button',
        sourceUrl: 'https://example.com',
        version: '1.0',
        tags: [],
        category: 'form-controls' as const,
        complexity: 'simple' as const,
        relatedChunks: [],
      },
    } as unknown as NormalizedChunk;

    expect(() => extractEmbeddingText(chunk)).toThrow('my-unsupported-chunk');
    expect(() => extractEmbeddingText(chunk)).toThrow('Currently supported');
  });

  it('error message includes chunk type and ID for debugging', () => {
    const chunk = {
      metadata: {
        chunkId: 'chunk-123',
        chunkType: 'composition-pattern',
        componentName: 'Button',
        sourceUrl: 'https://example.com',
        version: '1.0',
        tags: [],
        category: 'form-controls' as const,
        complexity: 'simple' as const,
        relatedChunks: [],
      },
    } as unknown as NormalizedChunk;

    expect(() => extractEmbeddingText(chunk)).toThrow(/composition-pattern|chunk-123/);
  });
});

// =============================================================================
// Test Suite: Integration Tests
// =============================================================================

describe('extractEmbeddingText - Integration', () => {
  it('produces reasonable length text (not too short)', () => {
    const chunk = createCodeExampleChunkFixture();
    const text = extractEmbeddingText(chunk);

    // Extracted text should be meaningful (at least 20 characters)
    expect(text.length).toBeGreaterThan(20);
  });

  it('produces text without excessive whitespace', () => {
    const chunk = createPropReferenceChunkFixture();
    const text = extractEmbeddingText(chunk);

    // Should not have double spaces or leading/trailing whitespace
    expect(text).not.toMatch(/^[\s\n]/);
    expect(text).not.toMatch(/[\s\n]$/);
    expect(text).not.toMatch(/  +/);
  });

  it('works with realistic CodeExampleChunk from Button', () => {
    const chunk = createCodeExampleChunkFixture({
      metadata: {
        ...createCodeExampleChunkFixture().metadata,
        chunkId: 'button-example-loading-v1',
        tags: ['state', 'loading', 'feedback'],
      },
      content: {
        explanation: 'Use the loading prop to show that a button action is processing. This is useful for async operations like form submissions.',
        code: '<Button isLoading={isSubmitting}>Submit</Button>',
        demonstrates: ['loading state', 'async feedback', 'user affordance'],
        keyPoints: ['Typically used with form submissions', 'Combines with isDisabled to prevent double-clicks', 'Shows spinner during operation'],
      },
    });

    const text = extractEmbeddingText(chunk);

    // Should contain all key information
    expect(text).toContain('loading state');
    expect(text).toContain('processing');
    expect(text).toContain('form submission');
  });

  it('works with realistic PropReferenceChunk from Button', () => {
    const chunk = createPropReferenceChunkFixture({
      metadata: {
        ...createPropReferenceChunkFixture().metadata,
        chunkId: 'button-prop-colorPalette-v1',
        tags: ['appearance', 'color', 'styling'],
      },
      prop: {
        fullName: 'colorPalette',
        name: 'colorPalette',
        category: 'appearance',
      },
      content: {
        description: 'Sets the color scheme of the button. Chakra provides semantic color palettes that work with your theme.',
        typeExplanation: 'Union of color palette names: "blue" | "green" | "red" | "orange" | "cyan" | "purple" | "pink" | "teal" | "gray"',
        usageGuidance: 'Use "blue" or "green" for primary actions, "red" for destructive actions, "gray" for secondary.',
        defaultBehavior: 'Defaults to "blue" if not specified.',
      },
    });

    const text = extractEmbeddingText(chunk);

    // Should contain all key information
    expect(text).toContain('color');
    expect(text).toContain('blue');
    expect(text).toContain('destructive');
    expect(text).toContain('primary');
  });
});
