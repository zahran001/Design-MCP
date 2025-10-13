import { z } from 'zod';

export const PropSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
  defaultValue: z.string().optional(),
  required: z.boolean(),
});

export const CodeExampleSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  code: z.string(),
  language: z.string().default('tsx'),
});

export const RAGResultSchema = z.object({
  componentName: z.string(),
  sourceUrl: z.string().url(),
  description: z.string(),
  props: z.array(PropSchema),
  codeExamples: z.array(CodeExampleSchema),
  accessibilityNotes: z.string().optional(),
});

export type RAGResult = z.infer<typeof RAGResultSchema>;