import {
  Badge,
  Box,
  Flex,
  Heading,
  HStack,
  Link,
  Portal,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
  Wrap,
} from '@chakra-ui/react';
import type { ReactNode } from 'react';

// The in-app engineering showcase (route: #/engineering). A skimmable, visual
// distillation of the engineering story for someone who opens the live demo:
// the architecture, the headline numbers, and the decisions (including the honest
// negatives). Mirrors SHOWCASE.md. Chakra v3 only (the app dogfoods the target),
// no new deps; the pipeline "diagram" is built from boxes, not a mermaid render.

// The GitHub mark, inline (no icon-lib dependency). `fill="currentColor"` so it
// inherits the link colour.
function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

// Inline term with a hover tooltip (dotted underline + help cursor). Reused for
// every abbreviation / proper noun on the page so the treatment is consistent.
function Term({ children, tip }: { children: ReactNode; tip: string }) {
  return (
    <Tooltip.Root openDelay={150} closeDelay={100}>
      <Tooltip.Trigger asChild>
        <Box as="span" textDecoration="underline dotted" cursor="help">
          {children}
        </Box>
      </Tooltip.Trigger>
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Content maxW="xs">{tip}</Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  );
}

// One labelled step in the pipeline strip. `tip` / `subTip` add a hover tooltip
// on the label / sub-label.
function Step({
  label,
  sub,
  tip,
  subTip,
}: {
  label: string;
  sub?: string;
  tip?: string;
  subTip?: string;
}) {
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
        {tip ? <Term tip={tip}>{label}</Term> : label}
      </Text>
      {sub && (
        <Text fontSize="xs" color="fg.muted">
          {subTip ? <Term tip={subTip}>{sub}</Term> : sub}
        </Text>
      )}
    </Box>
  );
}

// A horizontal flow of steps separated by arrows; wraps on narrow screens.
function Pipeline({
  steps,
}: {
  steps: { label: string; sub?: string; tip?: string; subTip?: string }[];
}) {
  return (
    <Flex align="center" gap={2} wrap="wrap">
      {steps.map((s, i) => (
        <HStack key={s.label} gap={2}>
          <Step label={s.label} sub={s.sub} tip={s.tip} subTip={s.subTip} />
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
function Stat({
  value,
  label,
  caption,
  tip,
}: {
  value: string;
  label: string;
  caption?: string;
  tip?: string;
}) {
  return (
    <Box borderWidth="1px" borderRadius="lg" p={4} bg="bg.panel">
      <Text fontSize="2xl" fontWeight="bold" color="teal.fg" lineHeight="1.1">
        {value}
      </Text>
      <Text fontSize="sm" fontWeight="medium" mt={1}>
        {tip ? <Term tip={tip}>{label}</Term> : label}
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

export function EngineeringPage() {
  return (
    <Stack gap={8} align="stretch">
      {/* Hero */}
      <Stack gap={2}>
        <Heading size="xl">How it’s built</Heading>
        <Text color="fg.muted" maxW="4xl">
          LLMs confidently hallucinate the old Chakra <b>v2</b> API (<code>colorScheme</code>,{' '}
          <code>isLoading</code>) because that is their training baseline, and v3 introduced massive
          breaking changes. The solution isn’t throwing a larger model at the problem. It’s{' '}
          <b>grounding</b> generation in the real v3 documentation, and <b>validating</b> the output
          using deterministic compiler checks instead of a probabilistic LLM opinion.
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
            Offline: build the corpus
          </Text>
          <Pipeline
            steps={[
              { label: 'Crawl', sub: 'Playwright' },
              { label: 'Normalize', sub: 'typed chunks' },
              { label: 'Embed', sub: 'OpenAI 1536-d' },
              {
                label: 'Qdrant',
                sub: '897 vectors',
                tip: 'An open-source vector database; stores the doc embeddings for similarity search.',
              },
            ]}
          />
        </Box>
        <Box>
          <Text fontSize="sm" fontWeight="medium" color="fg.muted" mb={2}>
            Per request
          </Text>
          <Pipeline
            steps={[
              {
                label: 'NL request',
                tip: 'Natural language: a plain-English request, e.g. “a green submit button”.',
              },
              {
                label: 'Retrieve',
                sub: 'reserved-slot',
                subTip:
                  'Retrieval that reserves a slot for the target component’s blueprint, not just the top-k nearest chunks.',
              },
              { label: 'Generate', sub: 'DeepSeek V4' },
              {
                label: 'tsc self-heal',
                sub: 'bounded loop',
                tip: 'tsc is the TypeScript compiler. The loop feeds its type errors back to the model until the code compiles.',
              },
              {
                label: 'Objective gates',
                sub: 'tsc · smell · comp',
                tip: 'Automated pass/fail checks on the output: type-check, v2-API smell lint, and composition completeness.',
              },
              { label: 'Live preview', sub: 'Sandpack' },
            ]}
          />
        </Box>
        <Text fontSize="xs" color="fg.muted">
          One container serves the SPA and API from a single origin. Generation runs on DeepSeek V4;
          embeddings stay on OpenAI so the query vector matches the corpus. The render-check is off in
          prod, so Sandpack renders client-side and <code>tsc</code> stays the gate.
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
          <Stat value="0.684→0.748" label="Retrieval gP@k" caption="authentic prose beats templates (paraphrased set)" tip="Graded precision at k: how relevant the top-k retrieved chunks are, on a graded (not binary) scale." />
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
            body="Built an LLM-as-judge and found it inverts on v3: it prefers the familiar v2 API. So tsc, v2-smell, and composition are the trusted spine, and the judge is only a secondary signal."
          />
          <Decision
            title="A/B isolation to prove grounding helps"
            body="Generation runs as grounded vs no-context on 15 engineered v2-landmines. Retrieval-only knowledge is kept out of the shared prompt, so the measured delta is attributable to retrieval."
          />
          <Decision
            title="Honest negative: thinking mode gave nothing"
            body="DeepSeek's reasoning mode was the obvious lever. A/B'd it: no objective gain, +46% latency, repair never fired. Shipped off, with the numbers to back it."
          />
          <Decision
            title="Honest negative: the obvious fix failed first"
            body="A naïve tsc-feedback repair loop didn't work, because TypeScript's JSX errors don't name the offending prop. What fixed it was smell-named hints that point at the exact v2→v3 rename."
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

      {/* Footer */}
      <Box borderTopWidth="1px" borderColor="border.muted" pt={4}>
        <Link
          href="https://github.com/zahran001/Design-MCP"
          target="_blank"
          rel="noopener noreferrer"
          display="inline-flex"
          alignItems="center"
          gap={2}
          fontSize="sm"
          color="fg.muted"
          textDecoration="none"
          _hover={{ color: 'fg' }}
        >
          <GitHubIcon />
          View the source on GitHub
        </Link>
      </Box>
    </Stack>
  );
}
