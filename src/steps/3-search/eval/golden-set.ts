// =============================================================================
// Retrieval Evaluation - Golden Query Set
// =============================================================================
// Curated queries with expected component answers, used to score retrieval.
//
// Seeded from the 5-query manual test in RETRIEVAL_TEST_REPORT.md (for continuity
// with the Dec-27 baseline), then expanded across the taxonomy in
// CHUNK_TYPE_STRATEGY.md so the eval directly measures that doc's predictions:
//
//   how-to            -> code-example     (working today)
//   prop-lookup       -> prop-reference   (the documented "button color" failure)
//   what-is           -> component-overview  (NOT embedded yet -> expected to fail)
//   what-can-x-do     -> capability-reference (NOT embedded yet -> expected to fail)
//   layout / cross-component / typography  -> mixed
//
// Rules:
// - expectedComponents is always a LIST (any match counts as a hit).
// - Component names must match the exact stored `componentName` spelling
//   (comparison is space/hyphen/case tolerant, but NOT word-splitting:
//   "AbsoluteCenter" != "Absolute Center").
// - expectedChunkType is a diagnostic hint, never the gating metric.
// =============================================================================

import type { GoldenCase } from './metrics.js';

export const GOLDEN_SET: GoldenCase[] = [
  // ---- Seeds from RETRIEVAL_TEST_REPORT.md (the original 5) -----------------
  {
    id: 'seed-button-size',
    query: 'How do I size a button?',
    expectedComponents: ['Button'],
    expectedChunkType: 'code-example',
    category: 'how-to',
  },
  {
    id: 'seed-button-variants',
    query: 'button variants',
    expectedComponents: ['Button'],
    expectedChunkType: 'code-example',
    category: 'how-to',
  },
  {
    id: 'seed-loading-state',
    query: 'loading state',
    expectedComponents: ['Button'],
    expectedChunkType: 'code-example',
    category: 'how-to',
  },
  {
    id: 'seed-button-with-icons',
    query: 'button with icons',
    expectedComponents: ['Button', 'Icon Button'],
    expectedChunkType: 'code-example',
    category: 'cross-component',
  },
  {
    id: 'seed-button-color',
    query: 'button color',
    expectedComponents: ['Button'],
    expectedChunkType: 'prop-reference',
    category: 'prop-lookup',
  },

  // ---- how-to (code-example) -----------------------------------------------
  {
    id: 'howto-button-loading-spinner',
    query: 'show a button with a loading spinner',
    expectedComponents: ['Button'],
    expectedChunkType: 'code-example',
    category: 'how-to',
  },
  {
    id: 'howto-responsive-grid',
    query: 'how to build a responsive grid layout',
    expectedComponents: ['Grid', 'SimpleGrid'],
    expectedChunkType: 'code-example',
    category: 'how-to',
  },
  {
    id: 'howto-stack-vertical',
    query: 'stack elements vertically with spacing',
    expectedComponents: ['Stack'],
    expectedChunkType: 'code-example',
    category: 'how-to',
  },
  {
    id: 'howto-flex-row',
    query: 'arrange items in a horizontal flex row',
    expectedComponents: ['Flex'],
    expectedChunkType: 'code-example',
    category: 'how-to',
  },
  {
    id: 'howto-editable-text',
    query: 'how to make text editable inline',
    expectedComponents: ['Editable'],
    expectedChunkType: 'code-example',
    category: 'how-to',
  },

  // ---- prop-lookup (prop-reference) ----------------------------------------
  {
    id: 'prop-input-size',
    query: 'what size options does the input have',
    expectedComponents: ['Input'],
    expectedChunkType: 'prop-reference',
    category: 'prop-lookup',
  },
  {
    id: 'prop-button-variant',
    query: 'button variant prop values',
    expectedComponents: ['Button'],
    expectedChunkType: 'prop-reference',
    category: 'prop-lookup',
  },
  {
    id: 'prop-checkbox-disabled',
    query: 'how to disable a checkbox',
    expectedComponents: ['Checkbox'],
    expectedChunkType: 'prop-reference',
    category: 'prop-lookup',
  },
  {
    id: 'prop-button-spinner-placement',
    query: 'where to place the button loading spinner',
    expectedComponents: ['Button'],
    expectedChunkType: 'prop-reference',
    category: 'prop-lookup',
  },

  // ---- what-is (component-overview, NOT embedded yet) ----------------------
  {
    id: 'whatis-absolutecenter',
    query: 'what is AbsoluteCenter used for',
    expectedComponents: ['AbsoluteCenter'],
    expectedChunkType: 'component-overview',
    category: 'what-is',
  },
  {
    id: 'whatis-field',
    query: 'what is the Field component',
    expectedComponents: ['Field'],
    expectedChunkType: 'component-overview',
    category: 'what-is',
  },
  {
    id: 'whatis-kbd',
    query: 'what is a Kbd element',
    expectedComponents: ['Kbd'],
    expectedChunkType: 'component-overview',
    category: 'what-is',
  },
  {
    id: 'whatis-fileupload',
    query: 'what does the File Upload component do',
    expectedComponents: ['File Upload'],
    expectedChunkType: 'component-overview',
    category: 'what-is',
  },

  // ---- what-can-x-do (capability-reference, NOT embedded yet) --------------
  {
    id: 'cap-button-sizes',
    query: 'what sizes does a button support',
    expectedComponents: ['Button'],
    expectedChunkType: 'capability-reference',
    category: 'what-can-x-do',
  },
  {
    id: 'cap-button-variants',
    query: 'what visual variants can a button have',
    expectedComponents: ['Button'],
    expectedChunkType: 'capability-reference',
    category: 'what-can-x-do',
  },
  {
    id: 'cap-checkbox-states',
    query: 'what states does a checkbox support',
    expectedComponents: ['Checkbox'],
    expectedChunkType: 'capability-reference',
    category: 'what-can-x-do',
  },

  // ---- layout / composition ------------------------------------------------
  {
    id: 'layout-center-both-axes',
    query: 'center content vertically and horizontally',
    expectedComponents: ['Center', 'AbsoluteCenter'],
    category: 'layout',
  },
  {
    id: 'layout-max-width',
    query: 'constrain content to a maximum width',
    expectedComponents: ['Container'],
    category: 'layout',
  },
  {
    id: 'layout-aspect-ratio',
    query: 'keep an image at a fixed aspect ratio',
    expectedComponents: ['Aspect Ratio'],
    category: 'layout',
  },
  {
    id: 'layout-wrap-items',
    query: 'wrap items onto multiple lines with spacing',
    expectedComponents: ['Wrap'],
    category: 'layout',
  },

  // ---- cross-component -----------------------------------------------------
  {
    id: 'cross-icon-only-button',
    query: 'an icon-only button',
    expectedComponents: ['Icon Button'],
    category: 'cross-component',
  },
  {
    id: 'cross-close-button',
    query: 'a close button for a dialog',
    expectedComponents: ['Close Button'],
    category: 'cross-component',
  },
  {
    id: 'cross-group-buttons',
    query: 'group several buttons together',
    expectedComponents: ['Group', 'Button'],
    category: 'cross-component',
  },

  // ---- typography ----------------------------------------------------------
  {
    id: 'type-highlight-text',
    query: 'highlight part of a sentence',
    expectedComponents: ['Highlight', 'Mark'],
    category: 'typography',
  },
  {
    id: 'type-heading',
    query: 'render a page heading',
    expectedComponents: ['Heading'],
    category: 'typography',
  },
  {
    id: 'type-blockquote',
    query: 'style a quotation block',
    expectedComponents: ['Blockquote'],
    category: 'typography',
  },
];
