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
import {
  getGenerationModel,
  getGenerationTemperature,
  getGenerationSeed,
  getGenerationBaseUrl,
  getGenerationApiKey,
  getGenerateThinking,
  getRepairThinking,
} from '../../config/vectorConfig.js';
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

// Pass C (5.3): repair-pass system prompt. Fired ONLY when the first generation
// fails `tsc`. The compiler errors are the oracle — symmetric across both A/B
// arms — so this prompt stays generic (no v2->v3 rename map; same isolation rule
// as SYSTEM_PROMPT). It just instructs the model to resolve the exact diagnostics.
const REPAIR_SYSTEM_PROMPT = `You are an expert Chakra UI v3 engineer fixing TypeScript compile
errors. You are given a component that failed \`tsc\` against the real Chakra UI v3 types, plus the
exact error lines.

Rules:
- Return a corrected, standalone component that resolves ALL the listed errors.
- Do NOT change the core functional intent of the REQUEST.
- Import ONLY from "@chakra-ui/react" and "react". Do NOT add icon libraries or local/doc helper
  modules. If an icon is needed, use an inline <svg> or omit it.
- Output EXACTLY ONE \`\`\`tsx code block. No prose before or after it.`;

// Pass F (5.2): grounded few-shot exemplars. Passes A–E closed the prop-rename
// gap; the residual was STRUCTURAL — composed shapes the retrieved chunks
// describe but don't lay out as a copyable blueprint (e.g. the v3 "PasswordInput"
// in the docs is a copy-in snippet from "@/components/ui/*", which our import-rule
// forbids, so the model must rebuild it from `@chakra-ui/react` primitives —
// `InputGroup endElement` + `Field.Root`, which it kept botching as v2
// `InputRightElement`/`FormControl`). Each exemplar is a curated, tsc-VERIFIED v3
// snippet keyed by the dominant retrieved component. Appended GROUNDED-ARM ONLY
// (keyed on retrieval), so the A/B isolation Passes A–E maintained holds: the
// no-context arm never sees these. They teach structure, not prop names.
const FEWSHOT_EXEMPLARS: Record<string, string> = {
  // A password field assembled from primitives: visibility toggle via
  // `InputGroup endElement`, wrapped in `Field.Root` for required/invalid/error.
  // One exemplar covers both structural targets (password-input + field-invalid).
  'Password Input': `import { Field, Input, InputGroup, IconButton } from "@chakra-ui/react";
import { useState } from "react";

const PasswordField = () => {
  const [show, setShow] = useState(false);
  return (
    <Field.Root required invalid>
      <Field.Label>Password</Field.Label>
      <InputGroup
        endElement={
          <IconButton aria-label="Toggle password visibility" size="xs" variant="ghost" onClick={() => setShow((v) => !v)}>
            {show ? "Hide" : "Show"}
          </IconButton>
        }
      >
        <Input type={show ? "text" : "password"} placeholder="Enter password" />
      </InputGroup>
      <Field.ErrorText>Password is too weak</Field.ErrorText>
    </Field.Root>
  );
};`,
  // A labelled field with helper + error text and a required indicator.
  Field: `import { Field, Input } from "@chakra-ui/react";

const EmailField = () => {
  return (
    <Field.Root required invalid>
      <Field.Label>Email <Field.RequiredIndicator /></Field.Label>
      <Input type="email" placeholder="you@example.com" />
      <Field.HelperText>We will never share it.</Field.HelperText>
      <Field.ErrorText>That email looks invalid.</Field.ErrorText>
    </Field.Root>
  );
};`,
};

/** Most-frequent componentName across the assembled context (the dominant). */
function dominantFromContext(context: ContextChunk[]): string {
  const counts = new Map<string, number>();
  for (const c of context) {
    if (c.componentName && c.componentName !== '?') {
      counts.set(c.componentName, (counts.get(c.componentName) ?? 0) + 1);
    }
  }
  let best = '';
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

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

/** Map a raw retrieval result into a prompt-ready ContextChunk. */
function toContextChunk(r: SearchResult, rank: number): ContextChunk {
  return {
    rank,
    score: r.score,
    componentName: str(r.payload['componentName']) || '?',
    chunkType: str(r.payload['chunkType']) || '?',
    rendered: renderContext(r.payload),
  };
}

/** A Qdrant payload filter matching one component + chunk type. */
function slotFilter(componentName: string, chunkType: string): Record<string, unknown> {
  return {
    must: [
      { key: 'componentName', match: { value: componentName } },
      { key: 'chunkType', match: { value: chunkType } },
    ],
  };
}

/**
 * The component that dominates an initial top-k result set, by frequency
 * (ties broken by best rank — results arrive in descending score order).
 * This is the component we reserve structural slots for. Returns '' if none.
 */
function dominantComponent(results: SearchResult[]): string {
  const counts = new Map<string, number>();
  for (const r of results) {
    const name = str(r.payload['componentName']);
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const [name, count] of counts) {
    if (count > bestCount) {
      best = name;
      bestCount = count;
    }
  }
  return best;
}

export class GenerationService {
  private client: OpenAI;
  private model: string;
  private retrieval: RetrievalService;
  // Generation temperature for `generate()` (product default 0.2). `repair()`
  // stays deterministic at temp 0 regardless — it's a corrective, not creative,
  // pass. The eval harness constructs with { temperature: 0, seed } to make a
  // single run a stable measurement (Item 1).
  private temperature: number;
  // Optional best-effort determinism seed, threaded into BOTH the generate and
  // repair calls. undefined => omit `seed` from the OpenAI request entirely.
  private seed: number | undefined;

  constructor(options: { model?: string; temperature?: number; seed?: number } = {}) {
    this.model = options.model || getGenerationModel();
    this.temperature = options.temperature ?? getGenerationTemperature();
    this.seed = options.seed ?? getGenerationSeed();
    // Generation client may be OpenAI (default) or an OpenAI-compatible provider
    // (DeepSeek) via GEN_BASE_URL. RetrievalService keeps its own OpenAI client
    // for embeddings — the corpus is OpenAI-embedded, so retrieval must stay OpenAI.
    this.client = new OpenAI({
      apiKey: getGenerationApiKey(),
      ...(getGenerationBaseUrl() ? { baseURL: getGenerationBaseUrl() } : {}),
    });
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
    options: { k?: number; useContext?: boolean; reservedSlots?: boolean } = {}
  ): Promise<GenerationResult> {
    const k = options.k ?? 8;
    const useContext = options.useContext ?? true;
    // Pass B: reserved-slot context mixing (default on for the grounded arm).
    // Set false to reproduce the flat top-k baseline for ablation.
    const reservedSlots = options.reservedSlots ?? true;

    let context: ContextChunk[] = [];
    let userMessage = `REQUEST: ${query}`;

    if (useContext) {
      context = reservedSlots
        ? await this.assembleReservedSlots(query, k)
        : await this.assembleTopK(query, k);
      const contextBlock = context.map((c, i) => `[${i + 1}] ${c.rendered}`).join('\n\n');
      // Pass F: if the dominant retrieved component has a curated exemplar, give
      // the model a structural blueprint to mirror (grounded-arm only).
      const exemplar = FEWSHOT_EXEMPLARS[dominantFromContext(context)];
      const exemplarBlock = exemplar
        ? `\n\nREFERENCE EXAMPLE (mirror this v3 STRUCTURE — adapt labels/values to the REQUEST; ` +
          `import only from "@chakra-ui/react" and "react"):\n\`\`\`tsx\n${exemplar}\n\`\`\``
        : '';
      userMessage =
        `REQUEST: ${query}\n\n` +
        `DOCUMENTATION CONTEXT (real Chakra UI v3 API — use the exact component and prop names shown):\n` +
        contextBlock +
        exemplarBlock;
    }

    // DeepSeek thinking mode is a non-standard body field; spreading a pre-typed
    // variable (not an inline literal) bypasses TS excess-property checking, so no
    // cast is needed. Empty object on the OpenAI path / when disabled.
    const thinkingParam = getGenerateThinking() ? { thinking: { type: 'enabled' } } : {};
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      ...(this.seed !== undefined ? { seed: this.seed } : {}),
      ...thinkingParam,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    const rawReply = completion.choices[0]?.message?.content ?? '';
    const { component, clean } = extractComponent(rawReply);

    return { query, model: this.model, context, component, cleanCodeBlock: clean, rawReply };
  }

  /**
   * Pass C (5.3) repair pass. Given a component that failed `tsc` and the exact
   * diagnostics, return a corrected component. `contextBlock` is the arm's OWN
   * retrieval context (the grounded v3 docs, or '' for the no-context arm) — kept
   * symmetric so grounded repair is grounded and no-context repair is not. The
   * compiler errors are the shared oracle either way.
   */
  async repair(opts: {
    query: string;
    component: string;
    diagnostics: string[];
    contextBlock?: string;
    /** Pass D: surgical v2->v3 migration hints that NAME the offending prop,
     *  translating tsc's coarse TS2322 into an actionable instruction. Omit for
     *  the raw-error repair mode (= Pass C). */
    hints?: string[];
  }): Promise<string> {
    const ctx = opts.contextBlock
      ? `\n\nDOCUMENTATION CONTEXT (authoritative Chakra v3 API — fix against this):\n${opts.contextBlock}`
      : '';
    const hintBlock = opts.hints && opts.hints.length
      ? `\n\nMIGRATION HINTS (apply these exactly):\n${opts.hints.map((h) => `- ${h}`).join('\n')}`
      : '';
    const userMessage =
      `REQUEST: ${opts.query}\n\n` +
      `PREVIOUS COMPONENT (failed tsc):\n\`\`\`tsx\n${opts.component}\n\`\`\`\n\n` +
      `TYPESCRIPT ERRORS (resolve ALL of these):\n${opts.diagnostics.join('\n')}` +
      hintBlock +
      ctx;

    const thinkingParam = getRepairThinking() ? { thinking: { type: 'enabled' } } : {};
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      ...(this.seed !== undefined ? { seed: this.seed } : {}),
      ...thinkingParam,
      messages: [
        { role: 'system', content: REPAIR_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
    });

    const rawReply = completion.choices[0]?.message?.content ?? '';
    const { component } = extractComponent(rawReply);
    return component;
  }

  /** Baseline strategy: flat top-k retrieval, ranked by score. */
  private async assembleTopK(query: string, k: number): Promise<ContextChunk[]> {
    const { results } = await this.retrieval.searchDetailed(query, k);
    return results.map((r, i) => toContextChunk(r, i + 1));
  }

  /**
   * Pass B reserved-slot strategy. top-k retrieval is dominated by flat
   * prop-reference chunks — the model learns valid props but gets no STRUCTURAL
   * blueprint for how subcomponents nest, so it emits hollow `.Root`s. We fix
   * the context budget so a blueprint is always present:
   *   [1] the dominant component's overview (top-level structure)
   *   [2-3] its 1-2 best code-examples (HOW subcomponents nest)
   *   [rest] the remaining top-k (prop/capability reference)
   * One query embedding is reused across all filtered fetches.
   */
  private async assembleReservedSlots(query: string, k: number): Promise<ContextChunk[]> {
    const { queryVector, results } = await this.retrieval.searchDetailed(query, k);
    const component = dominantComponent(results);
    if (!component) return results.map((r, i) => toContextChunk(r, i + 1));

    // Reserved structural slots for the dominant component, by the SAME vector.
    const [overview, examples] = await Promise.all([
      this.retrieval.searchByVector(queryVector, 1, slotFilter(component, 'component-overview')),
      this.retrieval.searchByVector(queryVector, 2, slotFilter(component, 'code-example')),
    ]);

    const picked: SearchResult[] = [];
    const seen = new Set<string | number>();
    const add = (r: SearchResult) => {
      if (picked.length >= k || seen.has(r.id)) return;
      seen.add(r.id);
      picked.push(r);
    };

    overview.forEach(add);
    examples.forEach(add);
    // Fill the remaining budget with the highest-scoring top-k chunks (props/
    // capabilities), skipping any already pulled into a reserved slot.
    results.forEach(add);

    return picked.map((r, i) => toContextChunk(r, i + 1));
  }
}
