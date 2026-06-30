import { useEffect, useState } from 'react';
import { Box, Container, Heading, Link, Spinner, Stack, Text } from '@chakra-ui/react';
import { fetchExamples, generate } from './api';
import type { ExamplePrompt, PipelineReport } from './api';
import { PromptBox } from './components/PromptBox';
import { ReportBadges, ReportDetails } from './components/ReportBadges';
import { CodeView } from './components/CodeView';
import { GroundedPanel } from './components/GroundedPanel';
import { LivePreview } from './components/LivePreview';

// Below this top retrieval score the corpus has no real match for the request,
// so the "grounding" is noise and the output is really model-memory. In-corpus
// matches score ~0.35+; out-of-corpus tops out ~0.24 (see TESTING_FULLSTACK.md).
const WEAK_GROUNDING_THRESHOLD = 0.3;

export function App() {
  const [query, setQuery] = useState('');
  const [useContext, setUseContext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PipelineReport | null>(null);
  const [examples, setExamples] = useState<ExamplePrompt[]>([]);

  useEffect(() => {
    fetchExamples()
      .then(setExamples)
      .catch(() => setExamples([])); // examples are a nicety; ignore failure
  }, []);

  const onGenerate = async () => {
    if (!query.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      setReport(await generate(query.trim(), useContext));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minH="100vh" bg="bg.subtle">
      <Container maxW="5xl" py={10}>
        <Stack gap={6} align="stretch">
          <Stack gap={1}>
            <Heading size="2xl">Spec to Component</Heading>
            <Text color="fg.muted">
              Describe a component in plain language and see it generated, grounded in the{' '}
              <Link
                href="https://chakra-ui.com/docs/components/concepts/overview"
                target="_blank"
                rel="noopener noreferrer"
                color="teal.fg"
                textDecoration="underline"
              >
                Chakra UI v3 docs
              </Link>
              , validated, and rendered live.
            </Text>
          </Stack>

          <PromptBox
            value={query}
            onChange={setQuery}
            onGenerate={onGenerate}
            loading={loading}
            useContext={useContext}
            onToggleContext={setUseContext}
            examples={examples}
            onPickExample={(q) => setQuery(q)}
          />

          {error && (
            <Box bg="red.subtle" borderWidth="1px" borderColor="red.muted" borderRadius="lg" p={4}>
              <Text color="red.fg" fontWeight="medium">
                {error}
              </Text>
            </Box>
          )}

          {loading && (
            <Box
              borderWidth="1px"
              borderColor="border.muted"
              borderRadius="lg"
              p={10}
              bg="bg.panel"
            >
              <Stack gap={3} align="center">
                <Spinner size="lg" color="teal.solid" borderWidth="3px" />
                <Text color="fg.muted" fontSize="sm">
                  {useContext
                    ? 'Retrieving v3 docs → generating → validating…'
                    : 'Generating → validating…'}
                </Text>
              </Stack>
            </Box>
          )}

          {!loading && !report && !error && (
            <Box
              borderWidth="1px"
              borderStyle="dashed"
              borderColor="border.muted"
              borderRadius="lg"
              p={10}
            >
              <Text color="fg.muted" textAlign="center" fontSize="sm">
                Your generated component will appear here: live preview, validated code, and the docs
                it was grounded in.
              </Text>
            </Box>
          )}

          {report && !loading && (
            <Stack gap={4} align="stretch">
              <Box>
                <ReportBadges report={report} />
                <ReportDetails report={report} />
                <Text fontSize="xs" color="fg.muted" mt={2}>
                  model {report.model} · top match {report.topContextComponent || '—'}
                  {report.context.length > 0 && ` (score ${report.context[0].score.toFixed(3)})`}
                </Text>
              </Box>

              {report.grounded &&
                report.context.length > 0 &&
                report.context[0].score < WEAK_GROUNDING_THRESHOLD && (
                  <Box
                    bg="orange.subtle"
                    borderWidth="1px"
                    borderColor="orange.muted"
                    borderRadius="lg"
                    p={4}
                  >
                    <Text color="orange.fg" fontWeight="medium">
                      ⚠️ Weak grounding — no strong corpus match
                    </Text>
                    <Text color="orange.fg" fontSize="sm" mt={1}>
                      The closest retrieved chunk scored {report.context[0].score.toFixed(3)} (strong
                      matches are ~0.35+). This request is likely outside the ~50-component corpus, so
                      the output relies on the model's own knowledge rather than the v3 docs — trust the
                      report badges over the result.
                    </Text>
                  </Box>
                )}

              <LivePreview component={report.component} renderOk={report.renderOk} />
              <CodeView code={report.component} />
              <GroundedPanel context={report.context} />
            </Stack>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
