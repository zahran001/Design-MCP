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
Given a REQUEST and a generated COMPONENT, grade how well the component satisfies the request
using the CURRENT Chakra UI v3 API.

Grade:
  2 = Correct and complete. Satisfies the request AND uses valid, current Chakra v3 API
      (e.g. colorPalette not colorScheme; composed components like Checkbox.Root / Field.Root
      fully assembled with their required parts).
  1 = Partially correct. Right intent but uses outdated v2 API (colorScheme, isLoading, leftIcon,
      FormControl, monolithic components, spacing, etc.) OR is incomplete/under-composed.
  0 = Wrong or broken. Does not satisfy the request, or uses invented/incorrect components.

Be strict about v3 correctness — Chakra v3 was a major breaking change from v2.
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

  async grade(query: string, component: string): Promise<GenerationGrade> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `REQUEST:\n${query}\n\nCOMPONENT:\n${component}` },
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
