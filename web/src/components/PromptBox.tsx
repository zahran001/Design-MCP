import { Box, Button, Flex, Switch, Textarea, Text, Wrap } from '@chakra-ui/react';
import type { ExamplePrompt } from '../api';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  loading: boolean;
  useContext: boolean;
  onToggleContext: (v: boolean) => void;
  examples: ExamplePrompt[];
  onPickExample: (query: string) => void;
}

// Prompt textarea + Generate, the grounding toggle (so users can watch grounding
// degrade output — the README's --no-context demo), and the held-out prompts as
// one-click chips.
export function PromptBox({
  value,
  onChange,
  onGenerate,
  loading,
  useContext,
  onToggleContext,
  examples,
  onPickExample,
}: Props) {
  return (
    <Box bg="bg.panel" borderWidth="1px" borderRadius="lg" p={5}>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder='Describe a component, e.g. "a green submit button" or "a checkbox with a label"'
        rows={3}
        resize="vertical"
        autoresize
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter submits.
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !loading && value.trim()) {
            onGenerate();
          }
        }}
      />

      <Flex mt={3} align="center" justify="space-between" gap={4} wrap="wrap">
        <Switch.Root
          checked={useContext}
          onCheckedChange={(e) => onToggleContext(e.checked)}
          disabled={loading}
        >
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label>
            Grounded in retrieved docs {useContext ? '(on)' : '(off — relies on model memory)'}
          </Switch.Label>
        </Switch.Root>

        <Button
          colorPalette="teal"
          onClick={onGenerate}
          loading={loading}
          loadingText="Generating…"
          disabled={!value.trim()}
        >
          Generate
        </Button>
      </Flex>

      {examples.length > 0 && (
        <Box mt={4}>
          <Text fontSize="sm" color="fg.muted" mb={2}>
            Try an example:
          </Text>
          <Wrap gap={2}>
            {examples.map((ex) => (
              <Button
                key={ex.id}
                size="xs"
                variant="outline"
                disabled={loading}
                onClick={() => onPickExample(ex.query)}
                title={ex.note}
              >
                {ex.query}
              </Button>
            ))}
          </Wrap>
        </Box>
      )}
    </Box>
  );
}
