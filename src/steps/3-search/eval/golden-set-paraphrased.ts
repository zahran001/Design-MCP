// =============================================================================
// Retrieval Evaluation - Paraphrased (held-out) Developer Query Set
// =============================================================================
// The circularity / leakage test for the eval.
//
// We authored both the original golden queries AND the template prose they are
// matched against, so a high score on GOLDEN_SET might only prove "our query
// resembles our template", not "this chunk answers a real developer". This set
// re-asks every golden query in *different, real-developer phrasing* that
// deliberately avoids the original wording and the template/heading vocabulary
// (e.g. not "size a button" but "make a button bigger").
//
// Interpretation:
//   - Scores that SURVIVE paraphrasing are real retrieval quality.
//   - Scores that COLLAPSE under paraphrasing prove the templates mostly match
//     their own vocabulary — the central hypothesis the roadmap wants to test.
//
// Maintenance:
//   - Each paraphrase is keyed by the golden case's `id` and INHERITS that
//     case's expectedComponents / category / expectedChunkType, so the two sets
//     can never drift apart. To add a query, add it to GOLDEN_SET first.
//   - This is a committed static set for deterministic, comparable runs. To
//     regenerate/expand with an LLM, see gen-paraphrases.ts.
// =============================================================================

import type { GoldenCase } from './metrics.js';
import { GOLDEN_SET } from './golden-set.js';

/** baseId (from GOLDEN_SET) -> held-out, developer-phrased paraphrase. */
const PARAPHRASES: Record<string, string> = {
  // seeds
  'seed-button-size': 'make a button bigger or smaller',
  'seed-button-variants': 'different button styles like outline or solid',
  'seed-loading-state': 'show a spinner on a button while my form submits',
  'seed-button-with-icons': 'put an icon next to the text on a button',
  'seed-button-color': "change a button's color scheme",

  // how-to
  'howto-button-loading-spinner': 'disable the button and show a spinner while saving',
  'howto-responsive-grid': 'lay out cards in columns that reflow on smaller screens',
  'howto-stack-vertical': 'put boxes one under another with gaps between them',
  'howto-flex-row': 'line elements up side by side in a row',
  'howto-editable-text': 'let users click a label and edit it in place',

  // prop-lookup
  'prop-input-size': 'make a text field smaller or larger',
  'prop-button-variant': 'which style options can I pass to a button',
  'prop-checkbox-disabled': 'stop a checkbox from being clickable',
  'prop-button-spinner-placement': "put the button's spinner on the right side",

  // what-is
  'whatis-absolutecenter': 'a component that centers something over its parent',
  'whatis-field': 'a wrapper that adds a label and error text to an input',
  'whatis-kbd': 'how do I show a keyboard shortcut key in the UI',
  'whatis-fileupload': 'let users pick and upload files',

  // what-can-x-do
  'cap-button-sizes': 'list the available button dimensions',
  'cap-button-variants': 'what looks can I give a button',
  'cap-checkbox-states': 'can a checkbox be indeterminate or checked',

  // layout
  'layout-center-both-axes': 'perfectly center a box in the middle of the screen',
  'layout-max-width': 'keep my page content from getting too wide',
  'layout-aspect-ratio': 'make a video box stay 16:9',
  'layout-wrap-items': 'let tags flow onto new rows when they run out of room',

  // cross-component
  'cross-icon-only-button': "a clickable button that's just an icon, no text",
  'cross-close-button': 'an X button to dismiss a modal',
  'cross-group-buttons': 'join buttons into a single connected toolbar',

  // typography
  'type-highlight-text': 'make certain words stand out with a marker style',
  'type-heading': 'show a big title at the top of the page',
  'type-blockquote': 'format a quoted passage of text',
};

/**
 * Paraphrased set, derived from GOLDEN_SET. Each case keeps the golden id with a
 * `-para` suffix and inherits all grading metadata; only the query text differs.
 * Throws at module load if any golden case lacks a paraphrase, so the two sets
 * stay in lockstep.
 */
export const PARAPHRASED_SET: GoldenCase[] = GOLDEN_SET.map((base) => {
  const query = PARAPHRASES[base.id];
  if (query === undefined) {
    throw new Error(
      `Missing paraphrase for golden case "${base.id}". ` +
        `Add it to PARAPHRASES in golden-set-paraphrased.ts.`
    );
  }
  return { ...base, id: `${base.id}-para`, query };
});
