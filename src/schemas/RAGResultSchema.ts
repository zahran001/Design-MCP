// // =============================================================================
// skeleton implementation
// =============================================================================
// import { z } from 'zod';

// export const PropSchema = z.object({
//   name: z.string(),
//   type: z.string(),
//   description: z.string(),
//   defaultValue: z.string().optional(),
//   required: z.boolean(),
// });

// export const CodeExampleSchema = z.object({
//   title: z.string(),
//   description: z.string().optional(),
//   code: z.string(),
//   language: z.string().default('tsx'),
// });

// export const RAGResultSchema = z.object({
//   componentName: z.string(),
//   sourceUrl: z.string().url(),
//   description: z.string(),
//   props: z.array(PropSchema),
//   codeExamples: z.array(CodeExampleSchema),
//   accessibilityNotes: z.string().optional(),
// });

// export type RAGResult = z.infer<typeof RAGResultSchema>;


// // =============================================================================
// actual implementation
// =============================================================================
import { z } from "zod";

export const ComponentDocSchema = z.object({
  componentName: z.string().min(1),
  sourceUrl: z.string().url(),
  description: z.string().min(1).optional(),

  // Milestone B
  codeExamples: z.array(
    z.object({ code: z.string().min(1) })
  ).optional(),

  // Milestone C
  props: z.array(
    z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      defaultValue: z.string().optional(),
      description: z.string().optional(),
    })
  ).optional(),
});

export type ComponentDoc = z.infer<typeof ComponentDocSchema>;
