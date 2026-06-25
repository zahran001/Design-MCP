// =============================================================================
// Generation judge (Phase 4b headline metric)
// =============================================================================
// Grades a generated component on how well it satisfies the request using
// correct, current Chakra v3 API. This is the HEADLINE (tsc-validity and the
// v2-smell rate are objective diagnostics that backstop it). The judge sees what
// the compiler can't — semantic completeness (e.g. an incomplete Checkbox.Root)
// and prop-level v2 drift the permissive types swallow.
// =============================================================================

import { OpenAI } from 'openai';
import 'dotenv/config';
import { getJudgeModel } from '../../../config/vectorConfig.js';

export interface GenerationGrade {
  grade: number; // 0 = wrong/broken, 1 = partial, 2 = correct & complete v3
  reason: string;
}

const SYSTEM_PROMPT = `You are a strict reviewer of generated Chakra UI v3 components.
Given a REQUEST and a generated COMPONENT, grade how well the component satisfies the request.

CRITICAL: A REFERENCE section with authoritative Chakra v3 documentation may be provided. When it
is, treat it as THE source of truth for the v3 API and judge the component against IT — do NOT rely
on your own memory of Chakra, which may be outdated (v3 was a major breaking change, and the v3 API
uses composed components like Checkbox.Root / Field.Root / NumberInput.Root and props like
colorPalette — these are CORRECT v3, not "old").

Grade:
  2 = Correct and complete. Satisfies the request AND uses valid, current v3 API as shown in the
      REFERENCE (composed components fully assembled with their required parts).
  1 = Partially correct. Right intent but uses outdated v2 API (colorScheme, isLoading, leftIcon,
      FormControl, monolithic components, spacing) OR is incomplete / under-composed.
  0 = Wrong or broken. Does not satisfy the request, or uses invented/incorrect components.

Respond ONLY with the structured object.`;

const RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'generation_grade',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        reason: { type: 'string', description: 'One short sentence justifying the grade.' },
        grade: { type: 'integer', enum: [0, 1, 2] },
      },
      required: ['reason', 'grade'],
    },
  },
};

export class GenerationJudge {
  private client: OpenAI;
  private model: string;

  constructor(options: { model?: string } = {}) {
    this.model = options.model || getJudgeModel();
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 6,
    });
  }

  get modelName(): string {
    return this.model;
  }

  /**
   * Grade a component. Pass `reference` (the retrieved v3 doc context) to ground
   * the judge against real v3 truth — without it, a v2-biased judge inverts and
   * rates correct v3 as "outdated". The SAME reference should be used for both
   * A/B arms so they are judged against one authoritative spec.
   */
  async grade(query: string, component: string, reference?: string): Promise<GenerationGrade> {
    const refBlock = reference
      ? `\n\nREFERENCE (authoritative Chakra v3 documentation — judge against THIS):\n${reference}`
      : '';
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `REQUEST:\n${query}\n\nCOMPONENT:\n${component}${refBlock}` },
      ],
      response_format: RESPONSE_FORMAT,
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    try {
      const parsed = JSON.parse(raw) as { grade?: unknown; reason?: unknown };
      const grade = typeof parsed.grade === 'number' ? Math.max(0, Math.min(2, Math.round(parsed.grade))) : 0;
      const reason = typeof parsed.reason === 'string' ? parsed.reason : '';
      return { grade, reason };
    } catch {
      return { grade: 0, reason: 'judge returned unparseable output' };
    }
  }
}
