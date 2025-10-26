import { describe, it, expect } from '@jest/globals';
import {
  createMinimalChunk,
  createFallbackChunk,
  createFallbackChunkWithAnalysis,
  createAppropriateFallback,
  type FallbackReason
} from '../fallbackChunks.js';

describe('createMinimalChunk', () => {
  it('should create minimal chunk for empty-code reason', () => {
    const chunk = createMinimalChunk('Button', 'https://example.com', 'empty-code');

    expect(chunk.metadata.componentName).toBe('Button');
    expect(chunk.metadata.sourceUrl).toBe('https://example.com');
    expect(chunk.metadata.tags).toContain('fallback');
    expect(chunk.metadata.tags).toContain('empty-code');
    expect(chunk.metadata.chunkType).toBe('code-example');
    expect(chunk.metadata.category).toBe('form-controls');
  });

  it('should create minimal chunk for invalid-input reason', () => {
    const chunk = createMinimalChunk('Input', 'https://example.com', 'invalid-input');

    expect(chunk.metadata.tags).toContain('fallback');
    expect(chunk.metadata.tags).toContain('invalid-input');
  });

  it('should create minimal chunk for all fallback reasons', () => {
    const reasons: FallbackReason[] = [
      'empty-code',
      'invalid-input',
      'analysis-failed',
      'inference-failed',
      'generation-failed'
    ];

    reasons.forEach(reason => {
      const chunk = createMinimalChunk('Button', 'https://example.com', reason);
      expect(chunk.metadata.tags).toContain(reason);
    });
  });

  it('should have fallback content in explanation', () => {
    const chunk = createMinimalChunk('Button', 'https://example.com', 'analysis-failed');

    expect(chunk.content.explanation).toContain('fallback chunk');
    expect(chunk.content.explanation).toContain('analysis-failed');
  });

  it('should have placeholder code', () => {
    const chunk = createMinimalChunk('Button', 'https://example.com', 'empty-code');

    expect(chunk.content.code).toContain('unavailable');
  });

  it('should have minimal code metadata', () => {
    const chunk = createMinimalChunk('Button', 'https://example.com', 'empty-code');

    expect(chunk.codeMetadata.language).toBe('tsx');
    expect(chunk.codeMetadata.imports).toEqual([]);
    expect(chunk.codeMetadata.components).toContain('Button');
    expect(chunk.codeMetadata.props).toEqual([]);
    expect(chunk.codeMetadata.hasInteractivity).toBe(false);
    expect(chunk.codeMetadata.hasState).toBe(false);
  });

  it('should have fallback example metadata', () => {
    const chunk = createMinimalChunk('Button', 'https://example.com', 'empty-code');

    expect(chunk.example.title).toBe('Fallback Example');
    expect(chunk.example.intent).toBe('generic');
    expect(chunk.example.difficulty).toBe('basic');
  });

  it('should generate proper chunk ID', () => {
    const chunk = createMinimalChunk('Button', 'https://example.com', 'empty-code');

    expect(chunk.metadata.chunkId).toContain('button');
    expect(chunk.metadata.chunkId).toContain('code-example');
  });

  it('should infer correct category for different components', () => {
    const buttonChunk = createMinimalChunk('Button', 'https://example.com', 'empty-code');
    expect(buttonChunk.metadata.category).toBe('form-controls');

    const stackChunk = createMinimalChunk('Stack', 'https://example.com', 'empty-code');
    expect(stackChunk.metadata.category).toBe('layout');

    const unknownChunk = createMinimalChunk('UnknownComponent', 'https://example.com', 'empty-code');
    expect(unknownChunk.metadata.category).toBe('other');
  });
});

describe('createFallbackChunk', () => {
  it('should create fallback chunk with provided code', () => {
    const rawExample = {
      code: '<Button>Click Me</Button>'
    };
    const error = new Error('Analysis failed');
    const chunk = createFallbackChunk(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.content.code).toBe('<Button>Click Me</Button>');
  });

  it('should use placeholder code when code is missing', () => {
    const rawExample = {};
    const error = new Error('Test error');
    const chunk = createFallbackChunk(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.content.code).toBe('// Code unavailable');
  });

  it('should preserve section if provided', () => {
    const rawExample = {
      code: '<Button>Click</Button>',
      section: 'Sizes'
    };
    const error = new Error('Test error');
    const chunk = createFallbackChunk(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.example.title).toBe('Sizes');
  });

  it('should use "Unknown Section" when section is missing', () => {
    const rawExample = {
      code: '<Button>Click</Button>'
    };
    const error = new Error('Test error');
    const chunk = createFallbackChunk(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.example.title).toBe('Unknown Section');
  });

  it('should preserve complexity if provided', () => {
    const rawExample = {
      code: '<Button>Click</Button>',
      complexity: 'advanced'
    };
    const error = new Error('Test error');
    const chunk = createFallbackChunk(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.metadata.complexity).toBe('advanced');
    expect(chunk.example.difficulty).toBe('advanced');
  });

  it('should default to intermediate complexity', () => {
    const rawExample = {
      code: '<Button>Click</Button>'
    };
    const error = new Error('Test error');
    const chunk = createFallbackChunk(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.metadata.complexity).toBe('intermediate');
    expect(chunk.example.difficulty).toBe('intermediate');
  });

  it('should include error message in explanation', () => {
    const rawExample = {
      code: '<Button>Click</Button>'
    };
    const error = new Error('Inference timeout');
    const chunk = createFallbackChunk(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.content.explanation).toContain('Inference timeout');
  });

  it('should detect interactivity from code', () => {
    const rawExample = {
      code: '<Button onClick={() => alert("test")}>Click</Button>'
    };
    const error = new Error('Test');
    const chunk = createFallbackChunk(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.codeMetadata.hasInteractivity).toBe(true);
  });

  it('should detect state from code', () => {
    const rawExample = {
      code: 'const [count, setCount] = useState(0); <Button>{count}</Button>'
    };
    const error = new Error('Test');
    const chunk = createFallbackChunk(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.codeMetadata.hasState).toBe(true);
  });

  it('should extract basic components from code', () => {
    const rawExample = {
      code: '<Stack><Button>A</Button><Input /></Stack>'
    };
    const error = new Error('Test');
    const chunk = createFallbackChunk(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.codeMetadata.components).toContain('Stack');
    expect(chunk.codeMetadata.components).toContain('Button');
    expect(chunk.codeMetadata.components).toContain('Input');
  });

  it('should tag chunk as fallback with partial-data', () => {
    const rawExample = {
      code: '<Button>Click</Button>'
    };
    const error = new Error('Test');
    const chunk = createFallbackChunk(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.metadata.tags).toContain('fallback');
    expect(chunk.metadata.tags).toContain('partial-data');
  });
});

describe('createFallbackChunkWithAnalysis', () => {
  it('should create chunk with analysis data', () => {
    const rawExample = {
      code: '<Button>Click</Button>',
      section: 'Basic Usage'
    };
    const analysisData = {
      imports: [{ source: '@chakra-ui/react', items: ['Button'] }],
      components: ['Button'],
      props: [],
      hooks: [],
      hasInteractivity: false,
      hasState: false
    };
    const error = new Error('Generation failed');
    const chunk = createFallbackChunkWithAnalysis(
      rawExample,
      'Button',
      'https://example.com',
      analysisData,
      error
    );

    expect(chunk.codeMetadata.imports).toEqual(analysisData.imports);
    expect(chunk.codeMetadata.components).toEqual(analysisData.components);
  });

  it('should include component count in explanation when multiple components', () => {
    const rawExample = {
      code: '<Stack><Button>A</Button><Input /></Stack>'
    };
    const analysisData = {
      components: ['Stack', 'Button', 'Input'],
      hasInteractivity: false,
      hasState: false
    };
    const error = new Error('Test');
    const chunk = createFallbackChunkWithAnalysis(
      rawExample,
      'Stack',
      'https://example.com',
      analysisData,
      error
    );

    expect(chunk.content.explanation).toContain('with 3 components');
  });

  it('should generate demonstrates based on analysis', () => {
    const rawExample = {
      code: '<Button onClick={handler}>Click</Button>'
    };
    const analysisData = {
      components: ['Button'],
      hasInteractivity: true,
      hasState: false
    };
    const error = new Error('Test');
    const chunk = createFallbackChunkWithAnalysis(
      rawExample,
      'Button',
      'https://example.com',
      analysisData,
      error
    );

    expect(chunk.content.demonstrates).toContain('Basic usage of the Button component');
    expect(chunk.content.demonstrates).toContain('Interactive behavior with event handlers');
  });

  it('should generate demonstrates for stateful examples', () => {
    const rawExample = {
      code: 'const [value, setValue] = useState(""); <Input value={value} />'
    };
    const analysisData = {
      components: ['Input'],
      hasInteractivity: false,
      hasState: true
    };
    const error = new Error('Test');
    const chunk = createFallbackChunkWithAnalysis(
      rawExample,
      'Input',
      'https://example.com',
      analysisData,
      error
    );

    expect(chunk.content.demonstrates).toContain('State management with React hooks');
  });

  it('should generate key points from imports', () => {
    const rawExample = {
      code: '<Button>Click</Button>'
    };
    const analysisData = {
      imports: [
        { source: '@chakra-ui/react', items: ['Button'] },
        { source: 'react', items: ['useState'] }
      ],
      components: ['Button'],
      hasInteractivity: false,
      hasState: false
    };
    const error = new Error('Test');
    const chunk = createFallbackChunkWithAnalysis(
      rawExample,
      'Button',
      'https://example.com',
      analysisData,
      error
    );

    const keyPointsStr = chunk.content.keyPoints?.join(' ') || '';
    expect(keyPointsStr).toContain('@chakra-ui/react');
    expect(keyPointsStr).toContain('react');
  });

  it('should generate key points from hooks', () => {
    const rawExample = {
      code: 'const [state, setState] = useState(); <Button>Click</Button>'
    };
    const analysisData = {
      imports: [],
      components: ['Button'],
      hooks: ['useState', 'useEffect'],
      hasInteractivity: false,
      hasState: true
    };
    const error = new Error('Test');
    const chunk = createFallbackChunkWithAnalysis(
      rawExample,
      'Button',
      'https://example.com',
      analysisData,
      error
    );

    const keyPointsStr = chunk.content.keyPoints?.join(' ') || '';
    expect(keyPointsStr).toContain('useState');
    expect(keyPointsStr).toContain('useEffect');
  });

  it('should tag chunk as with-analysis', () => {
    const rawExample = {
      code: '<Button>Click</Button>'
    };
    const analysisData = {
      components: ['Button'],
      hasInteractivity: false,
      hasState: false
    };
    const error = new Error('Test');
    const chunk = createFallbackChunkWithAnalysis(
      rawExample,
      'Button',
      'https://example.com',
      analysisData,
      error
    );

    expect(chunk.metadata.tags).toContain('fallback');
    expect(chunk.metadata.tags).toContain('with-analysis');
  });

  it('should handle missing hooks gracefully', () => {
    const rawExample = {
      code: '<Button>Click</Button>'
    };
    const analysisData = {
      components: ['Button'],
      hasInteractivity: false,
      hasState: false
    };
    const error = new Error('Test');
    const chunk = createFallbackChunkWithAnalysis(
      rawExample,
      'Button',
      'https://example.com',
      analysisData,
      error
    );

    expect(chunk.codeMetadata.hooks).toBeUndefined();
  });

  it('should include hooks if provided', () => {
    const rawExample = {
      code: '<Button>Click</Button>'
    };
    const analysisData = {
      components: ['Button'],
      hooks: ['useState'],
      hasInteractivity: false,
      hasState: true
    };
    const error = new Error('Test');
    const chunk = createFallbackChunkWithAnalysis(
      rawExample,
      'Button',
      'https://example.com',
      analysisData,
      error
    );

    expect(chunk.codeMetadata.hooks).toEqual(['useState']);
  });
});

describe('createAppropriateFallback', () => {
  it('should use minimal chunk for empty code', () => {
    const rawExample = {
      code: ''
    };
    const error = new Error('Test');
    const chunk = createAppropriateFallback(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.metadata.tags).toContain('empty-code');
    expect(chunk.content.code).toContain('unavailable');
  });

  it('should use minimal chunk for whitespace-only code', () => {
    const rawExample = {
      code: '   \n\t  '
    };
    const error = new Error('Test');
    const chunk = createAppropriateFallback(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.metadata.tags).toContain('empty-code');
  });

  it('should use minimal chunk for missing code', () => {
    const rawExample = {};
    const error = new Error('Test');
    const chunk = createAppropriateFallback(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.metadata.tags).toContain('empty-code');
  });

  it('should use analysis fallback when analysis data provided', () => {
    const rawExample = {
      code: '<Button>Click</Button>'
    };
    const analysisData = {
      components: ['Button'],
      hasInteractivity: false,
      hasState: false
    };
    const error = new Error('Test');
    const chunk = createAppropriateFallback(
      rawExample,
      'Button',
      'https://example.com',
      error,
      analysisData
    );

    expect(chunk.metadata.tags).toContain('with-analysis');
    expect(chunk.codeMetadata.components).toEqual(['Button']);
  });

  it('should use basic fallback when only code is available', () => {
    const rawExample = {
      code: '<Button>Click</Button>',
      section: 'Basic'
    };
    const error = new Error('Test');
    const chunk = createAppropriateFallback(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.metadata.tags).toContain('partial-data');
    expect(chunk.content.code).toBe('<Button>Click</Button>');
  });

  it('should prefer analysis fallback over basic fallback', () => {
    const rawExample = {
      code: '<Button>Click</Button>',
      section: 'Basic'
    };
    const analysisData = {
      components: ['Button'],
      imports: [{ source: '@chakra-ui/react', items: ['Button'] }],
      hasInteractivity: false,
      hasState: false
    };
    const error = new Error('Test');
    const chunk = createAppropriateFallback(
      rawExample,
      'Button',
      'https://example.com',
      error,
      analysisData
    );

    expect(chunk.metadata.tags).toContain('with-analysis');
    expect(chunk.codeMetadata.imports).toEqual(analysisData.imports);
  });

  it('should handle undefined analysis data', () => {
    const rawExample = {
      code: '<Button>Click</Button>'
    };
    const error = new Error('Test');
    const chunk = createAppropriateFallback(
      rawExample,
      'Button',
      'https://example.com',
      error,
      undefined
    );

    expect(chunk.metadata.tags).toContain('partial-data');
  });

  it('should handle empty analysis data object', () => {
    const rawExample = {
      code: '<Button>Click</Button>'
    };
    const error = new Error('Test');
    const chunk = createAppropriateFallback(
      rawExample,
      'Button',
      'https://example.com',
      error,
      {}
    );

    expect(chunk.metadata.tags).toContain('partial-data');
  });

  it('should use analysis fallback with partial analysis data', () => {
    const rawExample = {
      code: '<Button>Click</Button>'
    };
    const analysisData = {
      components: ['Button']
      // Missing other fields
    };
    const error = new Error('Test');
    const chunk = createAppropriateFallback(
      rawExample,
      'Button',
      'https://example.com',
      error,
      analysisData
    );

    expect(chunk.metadata.tags).toContain('with-analysis');
  });
});

describe('Edge cases', () => {
  it('should handle very long code strings', () => {
    const longCode = '<Button>' + 'x'.repeat(10000) + '</Button>';
    const rawExample = { code: longCode };
    const error = new Error('Test');
    const chunk = createFallbackChunk(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.content.code).toBe(longCode);
  });

  it('should handle special characters in code', () => {
    const rawExample = {
      code: '<Button onClick={() => alert("Test!")}>Click</Button>'
    };
    const error = new Error('Test');
    const chunk = createFallbackChunk(rawExample, 'Button', 'https://example.com', error);

    expect(chunk.content.code).toContain('alert("Test!")');
  });

  it('should handle multiline code', () => {
    const rawExample = {
      code: `<Stack>
  <Button>A</Button>
  <Button>B</Button>
</Stack>`
    };
    const error = new Error('Test');
    const chunk = createFallbackChunk(rawExample, 'Stack', 'https://example.com', error);

    expect(chunk.content.code).toContain('\n');
  });

  it('should handle unknown component categories', () => {
    const chunk = createMinimalChunk('UnknownComponent', 'https://example.com', 'empty-code');

    expect(chunk.metadata.category).toBe('other');
  });

  it('should handle composite component names', () => {
    const chunk = createMinimalChunk('Menu.Item', 'https://example.com', 'empty-code');

    // Should infer category from base component (Menu)
    expect(chunk.metadata.componentName).toBe('Menu.Item');
  });
});
