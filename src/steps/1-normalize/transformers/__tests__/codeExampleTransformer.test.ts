import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  transformCodeExample,
  transformCodeExampleLegacy,
  type RawCodeExample,
  type TransformerOptions,
  type TransformationResult
} from '../codeExampleTransformer.js';

// =============================================================================
// Stage 4 Integration Tests - Code Example Transformer
// =============================================================================
// Tests the complete transformation pipeline with the new API:
// - Options object API
// - Success/failure result types
// - Backward compatibility wrapper
// - End-to-end transformation with all stages integrated
// =============================================================================

describe('transformCodeExample (New API - Stage 4)', () => {
  describe('Success Cases', () => {
    it('should transform valid Button sizing example successfully', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<Button size="sm">Small Button</Button>',
          complexity: 'basic',  // Changed from 'simple' to match schema
          section: 'Sizes'
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button',
        context: {
          exampleIndex: 1,
          totalExamples: 5
        }
      };

      const result = transformCodeExample(options);

      // Should be success
      expect(result.status).toBe('success');

      if (result.status === 'success') {
        // Check chunk structure
        expect(result.chunk).toBeDefined();
        expect(result.chunk.metadata.componentName).toBe('Button');
        expect(result.chunk.metadata.chunkType).toBe('code-example');
        expect(result.chunk.metadata.sourceUrl).toBe('https://chakra-ui.com/docs/components/button');

        // Check example data
        expect(result.chunk.example.title).toBeDefined();
        expect(result.chunk.example.intent).toBeDefined();

        // Check content
        expect(result.chunk.content.code).toBe('<Button size="sm">Small Button</Button>');
        expect(result.chunk.content.explanation).toBeDefined();
        expect(result.chunk.content.demonstrates).toBeDefined();
        expect(result.chunk.content.keyPoints).toBeDefined();

        // Check code metadata
        expect(result.chunk.codeMetadata.language).toBe('tsx');
        expect(result.chunk.codeMetadata.components).toContain('Button');

        // Check metrics
        expect(result.metrics).toBeDefined();
        expect(result.metrics.analysisTimeMs).toBeGreaterThanOrEqual(0);
        expect(result.metrics.inferenceTimeMs).toBeGreaterThanOrEqual(0);
        expect(result.metrics.generationTimeMs).toBeGreaterThanOrEqual(0);
        expect(result.metrics.tokenCount).toBeGreaterThan(0);

        // Check warnings
        expect(result.warnings).toBeDefined();
        expect(Array.isArray(result.warnings)).toBe(true);
      }
    });

    it('should transform example without optional context', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<Stack spacing={4}><Box>Item 1</Box></Stack>'
        },
        componentName: 'Stack',
        sourceUrl: 'https://chakra-ui.com/docs/components/stack'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.chunk.metadata.componentName).toBe('Stack');
        expect(result.chunk.codeMetadata.components).toEqual(expect.arrayContaining(['Stack', 'Box']));
      }
    });

    it('should extract imports correctly', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: `import { Button } from '@chakra-ui/react';

<Button colorScheme="blue">Click me</Button>`
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.chunk.codeMetadata.imports).toBeDefined();
        expect(result.chunk.codeMetadata.imports.length).toBeGreaterThan(0);
        expect(result.chunk.codeMetadata.imports[0].source).toBe('@chakra-ui/react');
        expect(result.chunk.codeMetadata.imports[0].imports).toContain('Button');
      }
    });

    it('should detect props correctly', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<Button size="lg" variant="solid" colorScheme="blue">Large Button</Button>'
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.chunk.codeMetadata.props).toBeDefined();
        expect(result.chunk.codeMetadata.props.length).toBeGreaterThan(0);

        const buttonProps = result.chunk.codeMetadata.props.filter(p => p.component === 'Button');
        expect(buttonProps.length).toBeGreaterThan(0);

        const propNames = buttonProps.map(p => p.prop);
        expect(propNames).toEqual(expect.arrayContaining(['size', 'variant', 'colorScheme']));
      }
    });

    it('should infer semantic section titles', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<Button size="xs">Extra Small</Button><Button size="sm">Small</Button>',
          section: 'Button Sizes'
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        // Should infer a semantic title (not just "Usage Example")
        expect(result.chunk.example.title).toBeDefined();
        expect(result.chunk.example.title.length).toBeGreaterThan(0);
      }
    });

    it('should classify intent correctly', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<Button variant="solid">Solid</Button><Button variant="outline">Outline</Button>'
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.chunk.example.intent).toBeDefined();
        expect(result.chunk.example.intent).not.toBe('');
        // Should classify as variants (not generic)
        expect(result.chunk.example.intent).toBe('variants');
      }
    });

    it('should collect confidence scores in metrics', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<Button size="md">Medium Button</Button>'
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.metrics.confidenceScores).toBeDefined();
        expect(result.metrics.confidenceScores?.section).toBeGreaterThan(0);
        expect(result.metrics.confidenceScores?.section).toBeLessThanOrEqual(1);
        expect(result.metrics.confidenceScores?.intent).toBeGreaterThan(0);
        expect(result.metrics.confidenceScores?.intent).toBeLessThanOrEqual(1);
      }
    });

    it('should track pattern matches in metrics', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<Button size="xs">XS</Button><Button size="sm">SM</Button>',
          section: 'Sizes'
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.metrics.patternMatches).toBeDefined();
        expect(Array.isArray(result.metrics.patternMatches)).toBe(true);
        // Should have matched some patterns
        expect(result.metrics.patternMatches.length).toBeGreaterThan(0);
      }
    });

    it('should generate category from config', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<Button>Click me</Button>'
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        // Button should be categorized (not 'uncategorized')
        expect(result.chunk.metadata.category).toBeDefined();
        expect(result.chunk.metadata.category).not.toBe('uncategorized');
      }
    });
  });

  describe('Validation Failure Cases', () => {
    it('should return failure result for invalid input (empty code)', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: ''  // Invalid: empty code
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      // Should be failure
      expect(result.status).toBe('failure');

      if (result.status === 'failure') {
        expect(result.error).toBeDefined();
        expect(result.error.message).toContain('validation');
        expect(result.fallbackChunk).toBeDefined();
        expect(result.metrics).toBeDefined();
        expect(result.warnings).toBeDefined();
      }
    });

    it('should return failure result for invalid input (code with whitespace only)', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '   '  // Invalid: whitespace only
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('failure');
      if (result.status === 'failure') {
        expect(result.error.message).toContain('validation');
        expect(result.fallbackChunk).toBeDefined();
      }
    });

    it('should provide fallback chunk on validation failure', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: ''
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      if (result.status === 'failure') {
        expect(result.fallbackChunk).toBeDefined();
        expect(result.fallbackChunk?.metadata.componentName).toBe('Button');
        // Fallback uses placeholder text, not original empty code
        expect(result.fallbackChunk?.content.code).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle code with special characters', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<Button onClick={() => alert("Hello!")}>Click</Button>'
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.chunk.content.code).toContain('alert');
      }
    });

    it('should handle minimal code', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<Box />'
        },
        componentName: 'Box',
        sourceUrl: 'https://chakra-ui.com/docs/components/box'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.chunk.codeMetadata.components).toContain('Box');
      }
    });

    it('should handle code with multiple components', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<HStack><Button>One</Button><Button>Two</Button><IconButton /></HStack>'
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.chunk.codeMetadata.components).toEqual(
          expect.arrayContaining(['HStack', 'Button', 'IconButton'])
        );
      }
    });

    it('should warn on low confidence inference', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<SomeUnknownComponent />'  // Unlikely to have high confidence
        },
        componentName: 'UnknownComponent',
        sourceUrl: 'https://example.com'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        // May have warnings (but not required - depends on inference confidence)
        expect(result.warnings).toBeDefined();
      }
    });

    it('should handle missing optional fields', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<Button>Simple</Button>'
          // No complexity, no section, no score
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.chunk.metadata.complexity).toBeDefined(); // Should default to 'intermediate'
        expect(result.chunk.example.difficulty).toBeDefined();
      }
    });
  });

  describe('Metrics Collection', () => {
    it('should collect timing metrics for all phases', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<Button size="md">Button</Button>'
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.metrics.analysisTimeMs).toBeGreaterThanOrEqual(0);
        expect(result.metrics.inferenceTimeMs).toBeGreaterThanOrEqual(0);
        expect(result.metrics.generationTimeMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('should estimate token count', () => {
      const options: TransformerOptions = {
        rawExample: {
          code: '<Button>Click me</Button>'
        },
        componentName: 'Button',
        sourceUrl: 'https://chakra-ui.com/docs/components/button'
      };

      const result = transformCodeExample(options);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.metrics.tokenCount).toBeDefined();
        expect(result.metrics.tokenCount).toBeGreaterThan(0);
      }
    });
  });
});

// =============================================================================
// Legacy API Tests (Backward Compatibility)
// =============================================================================

describe('transformCodeExampleLegacy (Backward Compatibility)', () => {
  it('should work with old positional parameter API', () => {
    const rawExample: RawCodeExample = {
      code: '<Button size="sm">Small</Button>',
      complexity: 'basic'  // Changed from 'simple' to match schema
    };

    const chunk = transformCodeExampleLegacy(
      rawExample,
      'Button',
      'https://chakra-ui.com/docs/components/button',
      1,
      5
    );

    expect(chunk).toBeDefined();
    expect(chunk.metadata.componentName).toBe('Button');
    expect(chunk.content.code).toBe('<Button size="sm">Small</Button>');
  });

  it('should work without optional parameters', () => {
    const rawExample: RawCodeExample = {
      code: '<Button>Click</Button>'
    };

    const chunk = transformCodeExampleLegacy(
      rawExample,
      'Button',
      'https://chakra-ui.com/docs/components/button'
    );

    expect(chunk).toBeDefined();
    expect(chunk.metadata.componentName).toBe('Button');
  });

  it('should return fallback chunk on validation failure', () => {
    const rawExample: RawCodeExample = {
      code: ''  // Invalid
    };

    const chunk = transformCodeExampleLegacy(
      rawExample,
      'Button',
      'https://chakra-ui.com/docs/components/button'
    );

    // Should return fallback chunk (not throw)
    expect(chunk).toBeDefined();
    expect(chunk.metadata.componentName).toBe('Button');
    // Fallback uses placeholder, not original empty code
    expect(chunk.content.code).toBeDefined();
  });

  it('should produce same result as new API', () => {
    const rawExample: RawCodeExample = {
      code: '<Button variant="solid">Solid Button</Button>',
      complexity: 'basic'  // Changed from 'simple' to match schema
    };

    // Legacy API
    const legacyChunk = transformCodeExampleLegacy(
      rawExample,
      'Button',
      'https://chakra-ui.com/docs/components/button',
      1,
      3
    );

    // New API
    const newResult = transformCodeExample({
      rawExample,
      componentName: 'Button',
      sourceUrl: 'https://chakra-ui.com/docs/components/button',
      context: { exampleIndex: 1, totalExamples: 3 }
    });

    expect(newResult.status).toBe('success');
    if (newResult.status === 'success') {
      expect(legacyChunk.content.code).toBe(newResult.chunk.content.code);
      expect(legacyChunk.metadata.componentName).toBe(newResult.chunk.metadata.componentName);
      expect(legacyChunk.example.intent).toBe(newResult.chunk.example.intent);
    }
  });
});

// =============================================================================
// Integration Tests (Real-World Examples)
// =============================================================================

describe('Real-World Component Examples', () => {
  it('should transform Alert component example', () => {
    const options: TransformerOptions = {
      rawExample: {
        code: `<Alert status="error">
  <AlertIcon />
  <AlertTitle>Error!</AlertTitle>
  <AlertDescription>Something went wrong.</AlertDescription>
</Alert>`,
        complexity: 'intermediate'
      },
      componentName: 'Alert',
      sourceUrl: 'https://chakra-ui.com/docs/components/alert'
    };

    const result = transformCodeExample(options);

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.chunk.codeMetadata.components).toEqual(
        expect.arrayContaining(['Alert', 'AlertIcon', 'AlertTitle', 'AlertDescription'])
      );
    }
  });

  it('should transform Modal component example', () => {
    const options: TransformerOptions = {
      rawExample: {
        code: `<Modal isOpen={isOpen} onClose={onClose}>
  <ModalOverlay />
  <ModalContent>
    <ModalHeader>Modal Title</ModalHeader>
    <ModalCloseButton />
    <ModalBody>Modal body content</ModalBody>
  </ModalContent>
</Modal>`,
        complexity: 'advanced'
      },
      componentName: 'Modal',
      sourceUrl: 'https://chakra-ui.com/docs/components/modal'
    };

    const result = transformCodeExample(options);

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.chunk.codeMetadata.hasInteractivity).toBe(true);
      expect(result.chunk.metadata.complexity).toBe('advanced');
    }
  });

  it('should transform Form component with state', () => {
    const options: TransformerOptions = {
      rawExample: {
        code: `const [value, setValue] = useState('');
<Input value={value} onChange={(e) => setValue(e.target.value)} />`,
        complexity: 'intermediate'
      },
      componentName: 'Input',
      sourceUrl: 'https://chakra-ui.com/docs/components/input'
    };

    const result = transformCodeExample(options);

    expect(result.status).toBe('success');
    if (result.status === 'success') {
      expect(result.chunk.codeMetadata.hasState).toBe(true);
      expect(result.chunk.codeMetadata.hooks).toContain('useState');
    }
  });
});
