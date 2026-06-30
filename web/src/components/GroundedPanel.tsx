import { useState } from 'react';
import { Badge, Box, Button, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import type { ContextChunk } from '../api';

// Collapsible list of the retrieved chunks the generation was grounded in — the
// RAG transparency that showcases the whole pipeline. Each row shows the source
// component, chunk type and similarity score; expand to read the rendered text
// the model actually saw.
export function GroundedPanel({ context }: { context: ContextChunk[] }) {
  // Open by default: this panel IS the RAG-transparency showcase (which real v3
  // doc chunks grounded the generation) — surface it, don't hide it behind a click.
  const [open, setOpen] = useState(true);

  if (!context.length) {
    return (
      <Box borderWidth="1px" borderRadius="lg" p={4}>
        <Text fontSize="sm" color="fg.muted">
          Ungrounded run — no documentation context was retrieved.
        </Text>
      </Box>
    );
  }

  return (
    <Box borderWidth="1px" borderRadius="lg">
      <Button
        variant="ghost"
        w="full"
        justifyContent="space-between"
        onClick={() => setOpen((v) => !v)}
        px={4}
        py={3}
      >
        <Text fontWeight="medium">Grounded in {context.length} retrieved chunks</Text>
        <Text color="fg.muted">{open ? '▲' : '▼'}</Text>
      </Button>

      {open && (
        <Stack gap={3} px={4} pb={4}>
          {context.map((c) => (
            <Box key={c.rank} borderWidth="1px" borderRadius="md" p={3} bg="bg.subtle">
              <Flex align="center" justify="space-between" mb={2} gap={2} wrap="wrap">
                <HStack gap={2}>
                  <Badge colorPalette="purple" variant="subtle">
                    #{c.rank}
                  </Badge>
                  <Text fontWeight="medium">{c.componentName}</Text>
                  <Badge colorPalette="blue" variant="subtle">
                    {c.chunkType}
                  </Badge>
                </HStack>
                <Text fontSize="xs" color="fg.muted">
                  score {c.score.toFixed(3)}
                </Text>
              </Flex>
              <Box
                as="pre"
                fontSize="xs"
                color="fg.muted"
                whiteSpace="pre-wrap"
                maxH="160px"
                overflow="auto"
              >
                {c.rendered}
              </Box>
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
