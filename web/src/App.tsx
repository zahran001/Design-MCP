import { Box, Container, Heading, Text, VStack } from '@chakra-ui/react';

// Scaffold shell. The prompt box, live preview, code view, report badges and
// "Grounded in" panel land in the next commits — this is just the frame so the
// Chakra v3 provider + Vite dev server are wired and verifiable.
export function App() {
  return (
    <Box minH="100vh" bg="bg.subtle">
      <Container maxW="5xl" py={10}>
        <VStack align="stretch" gap={2}>
          <Heading size="2xl">Chakra v3 Component Generator</Heading>
          <Text color="fg.muted">
            Describe a component in plain language and see it generated, grounded in the Chakra UI v3
            docs, validated, and rendered live.
          </Text>
        </VStack>
      </Container>
    </Box>
  );
}
