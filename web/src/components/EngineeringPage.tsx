import { Badge, Box, Flex, Heading, HStack, Link, SimpleGrid, Stack, Text, Wrap } from '@chakra-ui/react';

// The in-app engineering showcase (route: #/engineering). A skimmable, visual
// distillation of the engineering story for someone who opens the live demo —
// the architecture, the headline numbers, and the decisions (including the honest
// negatives). Mirrors SHOWCASE.md. Chakra v3 only (the app dogfoods the target),
// no new deps — the pipeline "diagram" is built from boxes, not a mermaid render.

const REPO = 'https://github.com/zahran001/Design-MCP/blob/main';

// One labelled step in the pipeline strip.
function Step({ label, sub }: { label: string; sub?: string }) {
  return (
    <Box
      borderWidth="1px"
      borderColor="border.muted"
      borderRadius="md"
      bg="bg.panel"
      px={3}
      py={2}
      minW="fit-content"
    >
      <Text fontSize="sm" fontWeight="medium">
        {label}
      </Text>
      {sub && (
        <Text fontSize="xs" color="fg.muted">
          {sub}
        </Text>
      )}
    </Box>
  );
}

// A horizontal flow of steps separated by arrows; wraps on narrow screens.
function Pipeline({ steps }: { steps: { label: string; sub?: string }[] }) {
  return (
    <Flex align="center" gap={2} wrap="wrap">
      {steps.map((s, i) => (
        <HStack key={s.label} gap={2}>
          <Step label={s.label} sub={s.sub} />
          {i < steps.length - 1 && (
            <Text color="fg.subtle" aria-hidden>
              →
            </Text>
          )}
        </HStack>
      ))}
    </Flex>
  );
}

// A headline metric.
function Stat({ value, label, caption }: { value: string; label: string; caption?: string }) {
  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} bg="bg.panel">
      <Text fontSize="2xl" fontWeight="bold" color="teal.fg" lineHeight="1.1">
        {value}
      </Text>
      <Text fontSize="sm" fontWeight="medium" mt={1}>
        {label}
      </Text>
      {caption && (
        <Text fontSize="xs" color="fg.muted" mt={1}>
          {caption}
        </Text>
      )}
    </Box>
  );
}

// A problem → approach → outcome decision card.
function Decision({ title, body }: { title: string; body: string }) {
  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} bg="bg.panel">
      <Text fontWeight="semibold" mb={1}>
        {title}
      </Text>
      <Text fontSize="sm" color="fg.muted">
        {body}
      </Text>
    </Box>
  );
}

const docLink = {
  target: '_blank',
  rel: 'noopener noreferrer',
  color: 'teal.fg',
  textDecoration: 'underline',
} as const;

export function EngineeringPage() {
  return (
    <Stack gap={8} align="stretch">
      {/* Hero */}
      <Stack gap={2}>
        <Heading size="xl">How it’s built</Heading>
        <Text color="fg.muted" maxW="3xl">
          LLMs confidently emit the old Chakra <b>v2</b> API (<code>colorScheme</code>,{' '}
          <code>isLoading</code>, <code>FormControl</code>) because that’s what they were trained on. v3
          was a breaking change. The fix isn’t a bigger model — it’s <b>grounding</b> generation in the
          real v3 docs and <b>validating</b> the output with signals a compiler can verify, not an
          LLM’s opinion.
        </Text>
        <Wrap gap={2} mt={1}>
          {['RAG', 'Qdrant', 'OpenAI embeddings', 'DeepSeek V4', 'Chakra UI v3', 'tsc gates', 'Cloud Run'].map(
            (t) => (
              <Badge key={t} colorPalette="teal" variant="subtle">
                {t}
              </Badge>
            )
          )}
        </Wrap>
      </Stack>

      {/* Architecture */}
      <Stack gap={3}>
        <Heading size="md">Architecture</Heading>
        <Box>
          <Text fontSize="sm" fontWeight="medium" color="fg.muted" mb={2}>
            Offline — build the corpus
          </Text>
          <Pipeline
            steps={[
              { label: 'Crawl', sub: 'Playwright' },
              { label: 'Normalize', sub: 'typed chunks' },
              { label: 'Embed', sub: 'OpenAI 1536-d' },
              { label: 'Qdrant', sub: '897 vectors' },
            ]}
          />
        </Box>
        <Box>
          <Text fontSize="sm" fontWeight="medium" color="fg.muted" mb={2}>
            Per request
          </Text>
          <Pipeline
            steps={[
              { label: 'NL request' },
              { label: 'Retrieve', sub: 'reserved-slot' },
              { label: 'Generate', sub: 'DeepSeek V4' },
              { label: 'tsc self-heal', sub: 'bounded loop' },
              { label: 'Objective gates', sub: 'tsc · smell · comp' },
              { label: 'Live preview', sub: 'Sandpack' },
            ]}
          />
        </Box>
        <Text fontSize="xs" color="fg.muted">
          One container serves the SPA + API (single origin). Generation on DeepSeek V4; embeddings stay
          on OpenAI (the query vector must match the corpus). Render-check is off in prod — Sandpack
          renders client-side and <code>tsc</code> stays the gate.
        </Text>
      </Stack>

      {/* Results */}
      <Stack gap={3}>
        <Heading size="md">Results</Heading>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={3}>
          <Stat value="100%" label="Grounded tsc-valid, single-shot" caption="15 v2-landmine prompts, DeepSeek, 0 repairs (gpt-4o ~93% hinted)" />
          <Stat value="100%" label="Held-out generalization" caption="unseen prompts: tsc · smell-free · composition" />
          <Stat value="+46% / 0" label="Thinking mode: latency / gain" caption="A/B measured → shipped OFF" />
          <Stat value="539→462 MB" label="Prod image slim" caption="dep reclassify + npm prune --omit=dev" />
          <Stat value="629" label="Unit tests passing" caption="22 suites" />
          <Stat value="0.684→0.748" label="Retrieval gP@k" caption="authentic prose beats templates (paraphrased set)" />
        </SimpleGrid>
        <Text fontSize="xs" color="fg.muted">
          Single runs unless noted; generation is non-deterministic, so single-run flips are noise. Full
          method + numbers in the linked docs.
        </Text>
      </Stack>

      {/* Decisions */}
      <Stack gap={3}>
        <Heading size="md">Decisions &amp; tradeoffs</Heading>
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap={3}>
          <Decision
            title="Objective gates over an untrusted LLM judge"
            body="Built an LLM-as-judge and found it inverts on v3 — it prefers the familiar v2 API. So tsc + v2-smell + composition are the trusted spine; the judge is secondary."
          />
          <Decision
            title="A/B isolation to prove grounding helps"
            body="Generation runs as grounded vs no-context on 15 engineered v2-landmines, with retrieval-only knowledge kept out of the shared prompt — so the delta is attributable to retrieval."
          />
          <Decision
            title="Honest negative: thinking mode gave nothing"
            body="DeepSeek's reasoning mode was the obvious lever. A/B'd it: no objective gain, +46% latency, repair never fired. Shipped off, with the numbers to back it."
          />
          <Decision
            title="Honest negative: the obvious fix failed first"
            body="A naïve tsc-feedback repair loop didn't work — TS's JSX errors don't name the bad prop. Smell-named hints that point at the exact v2→v3 rename are what fixed it."
          />
          <Decision
            title="Cheaper model, made reliable by the system"
            body="Moved gpt-4o → DeepSeek V4. With grounding it beat the gpt-4o baseline on the objective gates (93% → 100% single-shot). The win is the system, not inference spend."
          />
          <Decision
            title="Deploy engineering + real gotchas"
            body="Single-origin SPA+API, render-check off in prod, slim image, Cloud Run. Found in a prod-parity smoke: a Dockerfile COPY-comment trap and a Qdrant Cloud payload-index requirement local Qdrant hides."
          />
        </SimpleGrid>
      </Stack>

      {/* Links */}
      <Stack gap={2}>
        <Heading size="md">Go deeper</Heading>
        <Text fontSize="sm" color="fg.muted">
          The full engineering narrative lives in the repo:{' '}
          <Link href={`${REPO}/GENERATION_EXPERIMENT.md`} {...docLink}>
            the correction loop &amp; A/B results
          </Link>
          ,{' '}
          <Link href={`${REPO}/EVALUATION_STRATEGY.md`} {...docLink}>
            retrieval evaluation
          </Link>
          ,{' '}
          <Link href={`${REPO}/README_DEPLOY.md`} {...docLink}>
            the deploy runbook
          </Link>
          , and{' '}
          <Link href={`${REPO}/SHOWCASE.md`} {...docLink}>
            the showcase
          </Link>
          .
        </Text>
      </Stack>
    </Stack>
  );
}
