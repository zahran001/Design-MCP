// =============================================================================
// Step 4: Spec-Driven Component Generation (Phase 4a — thin slice)
// =============================================================================
// Closes the pipeline loop: NL query -> retrieve real v3 doc chunks -> ground an
// LLM in that context -> emit one self-contained TSX component.
//
// Phase 4a scope: retrieve + generate + return. NO validation yet (that's 4b,
// gated on this spike producing clean, standalone TSX). The whole point of the
// retrieval work is to feed this step — so generation is grounded ONLY in the
// retrieved chunks (current Chakra v3 API), not the model's stale training data.
// =============================================================================

import { OpenAI } from 'openai';
import 'dotenv/config';
import { RetrievalService } from '../../services/RetrievalService.js';
import { getGenerationModel } from '../../config/vectorConfig.js';
import type { SearchResult } from '../../services/RetrievalService.js';

export interface ContextChunk {
  rank: number;
  score: number;
  componentName: string;
  chunkType: string;
  rendered: string;
}

export interface GenerationResult {
  query: string;
  model: string;
  context: ContextChunk[];
  /** The extracted TSX (code-fence stripped), or the raw reply if no fence found. */
  component: string;
  /** True when a ```tsx code block was found and extracted cleanly. */
  cleanCodeBlock: boolean;
  rawReply: string;
}

// Generic system prompt for BOTH arms of the A/B. It tells the model to target
// Chakra v3 but deliberately does NOT reveal the specific v2->v3 renames — the
// only source of that specific knowledge should be the retrieved context
// (grounded arm) vs the model's own memory (no-context arm). Revealing renames
// here would hand the ungrounded model the answers and bias the experiment.
const SYSTEM_PROMPT = `You are an expert Chakra UI engineer. Generate a single, self-contained
React component in TypeScript (TSX) for the user's REQUEST, targeting the CURRENT Chakra UI v3 API.

Rules:
- Use only components and props that are valid in Chakra UI v3.
- Import ONLY from "@chakra-ui/react" and "react". Do NOT import local or documentation helper
  modules (e.g. "@/components/ui/*", "compositions/*"). If an icon is needed, use an inline <svg>
  or omit it — do not import an icon library.
- For composed components, assemble ALL required parts (e.g. Checkbox.Root with its Control and
  Label; NumberInput.Root with its Input and Control) — do not emit a bare Root.
- Output EXACTLY ONE \`\`\`tsx code block containing a complete, standalone component. No prose
  before or after it.`;

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Render one retrieved chunk into readable context for the prompt, emphasizing
 * the answer-bearing fields per chunk type (real code, prop types, capability
 * options, overview capabilities). Parses fullChunk for the structured fields.
 */
function renderContext(payload: Record<string, unknown>): string {
  const component = str(payload['componentName']) || 'Component';
  const chunkType = str(payload['chunkType']);
  const lines: string[] = [`Component: ${component} (${chunkType})`];

  if (chunkType === 'code-example') {
    const explanation = str(payload['explanation']);
    const code = str(payload['code']);
    if (explanation) lines.push(explanation);
    if (code) lines.push('```tsx\n' + code + '\n```');
  } else if (chunkType === 'prop-reference') {
    const name = str(payload['propName']);
    const type = str(payload['propType']);
    const desc = str(payload['propDescription']);
    if (name) lines.push(`Prop \`${name}\`${type ? `: ${type}` : ''}`);
    if (desc) lines.push(desc);
  } else if (chunkType === 'capability-reference' || chunkType === 'component-overview') {
    // Structured fields live in fullChunk.
    try {
      const full = JSON.parse(str(payload['fullChunk'])) as any;
      const c = full?.content ?? {};
      if (chunkType === 'capability-reference') {
        if (full?.capability?.name) lines.push(`Capability: ${full.capability.name}`);
        if (str(c.description)) lines.push(str(c.description));
        const opts = Array.isArray(c.options) ? c.options.map((o: any) => str(o?.value)).filter(Boolean) : [];
        if (opts.length) lines.push(`Options: ${opts.join(', ')}`);
      } else {
        if (str(c.description)) lines.push(str(c.description));
        if (Array.isArray(c.capabilities) && c.capabilities.length) lines.push(`Capabilities: ${c.capabilities.join(', ')}`);
      }
    } catch {
      const explanation = str(payload['explanation']);
      if (explanation) lines.push(explanation);
    }
  } else {
    const explanation = str(payload['explanation']);
    if (explanation) lines.push(explanation);
  }

  return lines.join('\n');
}

/** Extract the first TSX/TS code block; fall back to the raw text. */
function extractComponent(reply: string): { component: string; clean: boolean } {
  const m = reply.match(/```(?:tsx|jsx|typescript|ts)?\s*\n([\s\S]*?)```/);
  if (m && m[1].trim()) return { component: m[1].trim(), clean: true };
  return { component: reply.trim(), clean: false };
}

export class GenerationService {
  private client: OpenAI;
  private model: string;
  private retrieval: RetrievalService;

  constructor(options: { model?: string } = {}) {
    this.model = options.model || getGenerationModel();
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.retrieval = new RetrievalService();
  }

  get modelName(): string {
    return this.model;
  }

  /**
   * Generate a component. `useContext` toggles the A/B arm:
   *  - true  (grounded): retrieve real v3 doc chunks and put them in the prompt.
   *  - false (no-context): identical prompt minus the docs — relies on the
   *    model's own (v2-heavy) knowledge. Isolates retrieval's contribution.
   */
  async generate(
    query: string,
    options: { k?: number; useContext?: boolean } = {}
  ): Promise<GenerationResult> {
    const k = options.k ?? 8;
    const useContext = options.useContext ?? true;

    let context: ContextChunk[] = [];
    let userMessage = `REQUEST: ${query}`;

    if (useContext) {
      const { results } = await this.retrieval.searchDetailed(query, k);
      context = results.map((r: SearchResult) => ({
        rank: r.rank,
        score: r.score,
        componentName: str(r.payload['componentName']) || '?',
        chunkType: str(r.payload['chunkType']) || '?',
        rendered: renderContext(r.payload),
      }));
      const contextBlock = context.map((c, i) => `[${i + 1}] ${c.rendered}`).join('\n\n');
      userMessage =
        `REQUEST: ${query}\n\n` +
        `DOCUMENTATION CONTEXT (real Chakra UI v3 API — use the exact component and prop names shown):\n` +
        contextBlock;
    }

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    const rawReply = completion.choices[0]?.message?.content ?? '';
    const { component, clean } = extractComponent(rawReply);

    return { query, model: this.model, context, component, cleanCodeBlock: clean, rawReply };
  }
}
