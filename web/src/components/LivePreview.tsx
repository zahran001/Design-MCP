import {
  SandpackProvider,
  SandpackLayout,
  SandpackPreview,
  useSandpack,
} from '@codesandbox/sandpack-react';
import { useEffect, useState } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { buildPreviewFiles } from '../lib/sandbox';

// The preview renders via codesandbox.io's remote bundler, which can be blocked
// (DuckDuckGo/Brave/uBlock/some networks) or just slow (measured working compiles
// run ~13-30s cold). Timing alone can't tell "blocked" from "slow", so we escalate
// in two tiers, both keyed on the `done` (compile-complete) message and both
// auto-clearing the moment it arrives:
//   - SLOW (15s): a soft note that is honest during a slow-but-working build.
//   - BLOCKED (60s): well past any working build (measured ~13-30s), so a stall
//     this long is almost certainly a block -> assert it and give an actionable fix.
const SLOW_MS = 15_000;
const BLOCKED_MS = 60_000;

// Inner body (inside SandpackProvider) so it can subscribe to bundler messages.
function PreviewBody() {
  const { listen } = useSandpack();
  const [compiled, setCompiled] = useState(false);
  const [phase, setPhase] = useState<'ok' | 'slow' | 'blocked'>('ok');

  useEffect(() => {
    // The bundler emits `done` when the compile finishes (with or without a
    // compile error); either way the sandbox is up, so that clears the note.
    const stop = listen((msg) => {
      if (msg.type === 'done') setCompiled(true);
    });
    return stop;
  }, [listen]);

  useEffect(() => {
    if (compiled) return; // finished (or already was) -> arm nothing / cancel below
    const t1 = setTimeout(() => setPhase('slow'), SLOW_MS);
    const t2 = setTimeout(() => setPhase('blocked'), BLOCKED_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [compiled]);

  return (
    <>
      {!compiled && phase === 'slow' && (
        <Box px={4} py={2} bg="orange.subtle">
          <Text fontSize="xs" color="orange.fg">
            Live preview is taking a while. It renders via <code>codesandbox.io</code>; if it stays
            blank, a browser or blocker (DuckDuckGo, Brave, uBlock, some networks) may be blocking it.
            The generated code and validation report above are unaffected.
          </Text>
        </Box>
      )}
      {!compiled && phase === 'blocked' && (
        <Box px={4} py={2} bg="orange.subtle">
          <Text fontSize="xs" color="orange.fg">
            Live preview failed to load. It renders via <code>codesandbox.io</code>, which is likely
            being blocked by your browser, a privacy extension (Brave Shields, uBlock), or your
            network. The generated code and validation report above are unaffected.
            <br />
            <Text as="span" fontWeight="semibold">
              To see the interactive preview, disable tracking protection for this site.
            </Text>
          </Text>
        </Box>
      )}
      <SandpackLayout>
        <SandpackPreview showOpenInCodeSandbox={false} showRefreshButton style={{ height: 420 }} />
      </SandpackLayout>
    </>
  );
}

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
        <Flex align="center" justify="space-between" gap={2} wrap="wrap">
          <Text fontSize="sm" fontWeight="medium" color="fg.muted">
            Live preview
          </Text>
          <Text fontSize="xs" color="fg.subtle">
            First preview can take a few seconds to boot the sandbox
          </Text>
        </Flex>
      </Box>

      {!renderOk && (
        <Box px={4} py={2} bg="orange.subtle">
          <Text fontSize="xs" color="orange.fg">
            The server's render check failed for this component. The preview below may be empty or
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
        <PreviewBody />
      </SandpackProvider>
    </Box>
  );
}
