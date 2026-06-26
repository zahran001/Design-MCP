// =============================================================================
// Held-out prompts for the end-to-end generalization test
// =============================================================================
// The 15 landmine prompts were the set the v2-smell list AND the Pass E repair
// heuristics were calibrated against — re-running them measures on the training
// set. These 5 are deliberately HELD OUT: every component is in the embedded
// corpus (verified 16-65 chunks each) but NONE appears in landmine-prompts, and
// none is an icon-as-child / numeric-coercion case the Pass E hints target. A
// mix of simple (Close Button, Heading) and compound/composed (Checkbox Card,
// File Upload, Color Picker) so the test exercises structural composition the
// pipeline was NOT tuned on.
// =============================================================================

export interface HeldoutPrompt {
  id: string;
  query: string;
  /** Why it's a fair generalization probe. */
  note: string;
}

export const HELDOUT_PROMPTS: HeldoutPrompt[] = [
  {
    id: 'close-button',
    query: 'a small close button with an X to dismiss a notification',
    note: 'simple; v3 CloseButton (icon as child)',
  },
  {
    id: 'heading',
    query: 'a large page heading that says "Welcome back"',
    note: 'simple layout/typography; size tokens',
  },
  {
    id: 'checkbox-card',
    query: 'a selectable checkbox card for a "Pro plan" option with a short description',
    note: 'composed CheckboxCard.Root/.Control/.Label (not the plain Checkbox in landmines)',
  },
  {
    id: 'file-upload',
    query: 'a file upload area with a button labeled "Upload file" that accepts images',
    note: 'composed FileUpload.Root/.Trigger',
  },
  {
    id: 'color-picker',
    query: 'a color picker for selecting a brand color with a label "Brand color"',
    note: 'composed ColorPicker.Root/.Control',
  },
];
