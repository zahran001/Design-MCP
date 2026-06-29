import { SandpackProvider, SandpackLayout, SandpackPreview } from '@codesandbox/sandpack-react';
import { Box, Text } from '@chakra-ui/react';
import { buildPreviewFiles } from '../lib/sandbox';

// The headline accessibility feature: render the generated component live, in a
// real browser sandbox, inside a Chakra v3 provider — so a user SEES the result,
// not just the code. Sandpack bundles @chakra-ui/react in-iframe and shows its
// own error overlay if the component fails to mount (it shouldn't when tsc + the
// render tier are green, but we surface it honestly when it does).
//
// `key={component}` remounts the sandbox on each new generation so stale bundles
// never linger.
export function LivePreview({ component, renderOk }: { component: string; renderOk: boolean }) {
  const { files, dependencies } = buildPreviewFiles(component);

  return (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden">
      <Box px={4} py={2} bg="bg.muted">
        <Text fontSize="sm" fontWeight="medium" color="fg.muted">
          Live preview
        </Text>
      </Box>

      {!renderOk && (
        <Box px={4} py={2} bg="orange.subtle">
          <Text fontSize="xs" color="orange.fg">
            The server's render check failed for this component — the preview below may be empty or
            error.
          </Text>
        </Box>
      )}

      <SandpackProvider
        key={component}
        template="react-ts"
        files={files}
        customSetup={{ dependencies }}
        options={{ recompileMode: 'immediate' }}
      >
        <SandpackLayout>
          <SandpackPreview
            showOpenInCodeSandbox={false}
            showRefreshButton
            style={{ height: 420 }}
          />
        </SandpackLayout>
      </SandpackProvider>
    </Box>
  );
}
