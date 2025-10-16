// =============================================================================
// Week 1 Schema - Component Documentation
// =============================================================================
// Updated: 2025-10-15
// Reference: docs/week1/IMPLEMENTATION_PLAN.md
//
// This schema defines the structure for extracted component documentation from
// Chakra UI (and potentially other component libraries).
//
// Note: pageContext field removed - Chakra UI uses single-page docs.
// See: docs/week1/CHANGELOG_PAGECONTEXT.md
// =============================================================================

import { z } from "zod";

/**
 * Code example schema (Milestone B)
 * Represents a filtered, high-quality code example from documentation
 */
export const CodeExampleSchema = z.object({
  code: z.string().min(1),
  language: z.string().optional(), // e.g., "tsx", "jsx", "typescript"
  title: z.string().optional(),     // Extracted from preceding heading
  section: z.string().optional(),   // Section name where code was found
});

export type CodeExample = z.infer<typeof CodeExampleSchema>;

/**
 * Prop schema (Milestone C)
 * Represents a component prop extracted from props tables
 */
export const PropSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  defaultValue: z.string().optional(),
  description: z.string().optional(),
  required: z.boolean().optional(), // Detected from asterisks or "required" text
});

export type Prop = z.infer<typeof PropSchema>;

/**
 * Component documentation schema (Week 1 Complete)
 * Main extraction output - one doc per crawled page
 */
export const ComponentDocSchema = z.object({
  componentName: z.string().min(1),
  sourceUrl: z.string().url(),
  description: z.string().min(1).optional(),

  // Milestone B: Code Examples Extraction
  codeExamples: z.array(CodeExampleSchema).optional(),

  // Milestone B: Related Components Detection
  // Components that appear together in code examples (for cross-component queries)
  relatedComponents: z.array(z.string()).optional(),

  // Milestone C: Props Table Extraction
  props: z.array(PropSchema).optional(),
});

export type ComponentDoc = z.infer<typeof ComponentDocSchema>;
