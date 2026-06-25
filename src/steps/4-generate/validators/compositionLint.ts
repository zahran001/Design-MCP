// =============================================================================
// Composition-completeness lint (Phase 4b — objective under-composition signal)
// =============================================================================
// tsc accepts a "hollow" composed root (e.g. <Checkbox.Root>text</Checkbox.Root>)
// because children are typed loosely, and a model-judge can't be trusted on v3.
// So we measure under-composition OBJECTIVELY: when a v3 composed component's
// Root appears, its REQUIRED parts must appear too. This is a curated spec lint
// (like v2-smell), keeping the eval grounded in truth rather than model opinion.
//
// Required-parts = the minimal parts a component needs to actually function/render
// (well-documented in the Chakra v3 docs). Only components in our embedded corpus
// are listed.
// =============================================================================

/** Composed component (base name) -> minimal required part names (after `.`). */
export const COMPOSITION_RULES: Record<string, string[]> = {
  Checkbox: ['Control', 'Label'],
  CheckboxCard: ['Control', 'Label'],
  Field: ['Label'],
  Fieldset: ['Content'],
  NumberInput: ['Input', 'Control'],
  PinInput: ['Input'],
  Editable: ['Preview', 'Input'],
  FileUpload: ['Trigger'],
  ColorPicker: ['Control'],
};

export interface CompositionIssue {
  component: string;
  missing: string[];
}

/**
 * Flag composed roots that are missing required parts. Returns one issue per
 * under-composed component; empty array = fully composed (or no composition used).
 */
export function lintComposition(code: string): CompositionIssue[] {
  const issues: CompositionIssue[] = [];
  for (const [component, required] of Object.entries(COMPOSITION_RULES)) {
    const rootUsed = new RegExp(`\\b${component}\\.Root\\b`).test(code);
    if (!rootUsed) continue;
    const missing = required.filter(
      (part) => !new RegExp(`\\b${component}\\.${part}\\b`).test(code)
    );
    if (missing.length > 0) issues.push({ component, missing });
  }
  return issues;
}
