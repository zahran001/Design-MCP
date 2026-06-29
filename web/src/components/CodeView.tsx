import { useState } from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { Highlight, themes } from 'prism-react-renderer';

// Syntax-highlighted, read-only TSX with copy-to-clipboard. The live preview
// (Sandpack) is the headline; this is the "give me the code" path.
export function CodeView({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked (e.g. insecure context) — no-op */
    }
  };

  return (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden">
      <Flex align="center" justify="space-between" px={4} py={2} bg="bg.muted">
        <Text fontSize="sm" fontWeight="medium" color="fg.muted">
          Component.tsx
        </Text>
        <Button size="xs" variant="outline" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </Button>
      </Flex>
      <Box maxH="480px" overflow="auto">
        <Highlight code={code} language="tsx" theme={themes.nightOwl}>
          {({ style, tokens, getLineProps, getTokenProps }) => (
            <pre
              style={{
                ...style,
                margin: 0,
                padding: '16px',
                fontSize: '13px',
                lineHeight: 1.5,
              }}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </Box>
    </Box>
  );
}
