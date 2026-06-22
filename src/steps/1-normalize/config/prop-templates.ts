// =============================================================================
// Prop Templates Configuration
// =============================================================================
// Created: 2025-12-28
// Purpose: Centralized storage for prop descriptions and usage guidance
//
// This config file is extracted from propExplanationGenerator.ts to prevent
// the generator from becoming a "God Object" as templates scale to 1,000+ lines.
//
// Structure:
// - COMMON_PROP_DESCRIPTIONS: 60+ high-value prop → description mappings
// - COMMON_USAGE_GUIDANCE: 20+ high-ROI semantic guidance templates
//
// Maintenance:
// - Add new props here, not in the generator
// - Component-specific templates use "ComponentName:propName" keys (Phase 3+)
// - Keep templates concise and semantic (2-3 sentences max)
// =============================================================================

/**
 * COMMON_PROP_DESCRIPTIONS
 *
 * High-quality descriptions for commonly-used component props.
 * Strategy:
 * 1. First, extractedDescription from docs (not here)
 * 2. Second, lookup in this map (if prop name matches)
 * 3. Third, type-aware fallback (generated semantically)
 *
 * Coverage: ~60 props across appearance, state, composition, events, form, accessibility
 * Used by: generateDescription() in propExplanationGenerator.ts
 */
export const COMMON_PROP_DESCRIPTIONS: Record<string, string> = {
  // =========================================================================
  // Appearance Props
  // =========================================================================
  'size': 'Controls the visual size and spacing of the component. Larger sizes increase padding and font size.',
  'variant':
    'Selects a pre-configured visual style variant (e.g., solid, outline, ghost). Changes appearance without affecting behavior.',
  'colorPalette':
    'Sets the color scheme used throughout the component. Supports semantic color names (red, blue, green) and theme colors.',
  'colorScheme':
    'Controls the color appearance of the component. Maps to the design system color palette.',
  'width': 'Sets the component width. Accepts CSS values (%, px, em) or responsive array.',
  'height': 'Sets the component height. Accepts CSS values (%, px, em) or responsive array.',
  'padding': 'Controls internal spacing. Accepts CSS values or responsive array.',
  'margin': 'Controls external spacing. Accepts CSS values or responsive array.',
  'borderRadius': 'Controls corner rounding. Accepts CSS values (px, em, %).',
  'bg': 'Background color. Accepts theme color names or hex values.',
  'color': 'Text color. Accepts theme color names or hex values.',
  'display': 'Controls how the component is rendered (block, flex, grid, none).',
  'flexDirection': 'Controls flex layout direction (row, column, row-reverse, column-reverse).',
  'gap': 'Controls spacing between flex/grid children.',

  // =========================================================================
  // State Props
  // =========================================================================
  'disabled':
    'Prevents user interaction. When true, the component is dimmed and unresponsive. Native disabled state removes from keyboard navigation.',
  'aria-disabled':
    'Indicates a disabled state while keeping the element focusable for accessibility. Element remains in keyboard navigation.',
  'loading':
    'Shows loading indicator and prevents interaction during asynchronous operations. Often paired with disabled state.',
  'invalid':
    'Indicates validation error state. Component shows error styling and sets aria-invalid attribute.',
  'readonly': 'Marks form input as read-only. User can select and focus but cannot modify value.',
  'readOnly': 'Marks form input as read-only. User can select and focus but cannot modify value.',
  'checked': 'For checkboxes/radios: whether the control is checked.',
  'selected': 'Indicates whether the item is selected.',
  'open': 'Controls visibility of overlay/disclosure components (dialogs, menus, popovers).',
  'isOpen': 'Controls visibility of overlay/disclosure components.',
  'expanded': 'Indicates whether disclosure content is expanded.',
  'required': 'Marks form field as required. Must be filled before form submission.',
  'error': 'Indicates error state. Shows error styling and context.',
  'focused': 'Indicates whether element has focus.',
  'visible': 'Controls element visibility.',
  'active': 'Indicates whether element is in active/selected state.',

  // =========================================================================
  // Composition Props
  // =========================================================================
  'children':
    'Contains the component content. Accepts React elements, text, or arrays of elements. Primary way to populate the component.',
  'as': 'Renders the component as a different HTML element. Common uses: Button as="a" for link styling, Box as="section" for semantics.',
  'asChild':
    'When true, renders only the props and behavior; allows child element to be the actual DOM node. Useful for composition.',
  'ref': 'React ref to access the underlying DOM element or component instance directly.',
  'className': 'CSS class name for custom styling. Merged with component styles.',
  'style': 'Inline styles object. Merged with component styles.',

  // =========================================================================
  // Event Handlers
  // =========================================================================
  'onClick': 'Fires when user clicks the component. Receives MouseEvent.',
  'onChange': 'Fires when form input value changes. Receives change event details.',
  'onSubmit': 'Fires when form is submitted. Receives submit event.',
  'onFocus': 'Fires when component receives focus.',
  'onBlur': 'Fires when component loses focus.',
  'onMouseEnter': 'Fires when mouse enters component bounds.',
  'onMouseLeave': 'Fires when mouse leaves component bounds.',
  'onKeyDown': 'Fires when key is pressed while component has focus.',
  'onKeyUp': 'Fires when key is released.',
  'onInputChange': 'Fires when input value changes.',
  'onValueChange': 'Fires when controlled value changes.',
  'onOpenChange': 'Fires when open/closed state changes.',
  'onSelect': 'Fires when item is selected.',

  // =========================================================================
  // Form Control Props
  // =========================================================================
  'value': 'Controlled prop - the current value. Update via onChange handler to reflect state changes.',
  'defaultValue':
    'Uncontrolled prop - initial value. Use when component manages its own state and you do not need to control it.',
  'placeholder':
    'Hint text shown when input is empty. Should not replace labels. Disappears when user types.',
  'name': 'HTML name attribute for form submission. Identifies the field in form data.',
  'id': 'HTML id attribute for form association and styling hooks.',
  'type':
    'HTML input type (text, email, password, number, etc.). Determines input behavior and validation.',
  'label': 'Text label describing the form field. Should be associated with input via htmlFor.',
  'helperText': 'Additional explanation text shown below the input.',
  'errorMessage': 'Error message shown when field validation fails.',

  // =========================================================================
  // Accessibility Props
  // =========================================================================
  'aria-label': 'Accessible label for screen readers when visual label is not present.',
  'aria-labelledby': 'References the id of an element that labels this component.',
  'aria-describedby': 'References the id of an element that describes this component.',
  'aria-hidden': 'Hides element from screen readers (true) or shows (false).',
  'aria-pressed': 'Indicates whether toggle button is pressed.',
  'aria-expanded': 'Indicates whether disclosure content is expanded.',
  'aria-invalid': 'Indicates whether form field has validation error.',
  'aria-readonly': 'Indicates whether field is read-only.',
  'aria-required': 'Indicates whether field is required.',
  'role': 'Assigns ARIA role (button, tab, menuitem, etc.) for semantic meaning.'
};

/**
 * COMMON_USAGE_GUIDANCE
 *
 * Semantic WHY/WHEN guidance for high-ROI props.
 * Only includes guidance we're confident about (never assumes).
 *
 * Strategy:
 * 1. For known props: use semantic guidance (helps embeddings understand intent)
 * 2. For unknown props: return undefined (optional field in schema)
 * 3. For component-specific variants: use "ComponentName:propName" key (Phase 3+)
 *
 * Phase 2a coverage: ~20 generic templates
 * Phase 3: Expand with 30 critical component-specific templates (e.g., "Button:size")
 *
 * Used by: generateUsageGuidance() in propExplanationGenerator.ts
 */
export const COMMON_USAGE_GUIDANCE: Record<string, string> = {
  // =========================================================================
  // Appearance Guidance
  // =========================================================================
  'size': 'Use "md" for standard/primary actions. Use smaller sizes ("sm", "xs") for dense layouts or secondary actions. Use larger sizes ("lg", "xl") for prominent call-to-actions.',
  'variant':
    'Different variants serve different visual hierarchy: "solid" for primary actions, "outline" for secondary, "ghost" for tertiary.',

  // =========================================================================
  // State Guidance - CRITICAL accessibility distinctions
  // =========================================================================
  'disabled':
    'Use to prevent user interaction. Native disabled elements are removed from keyboard navigation. For interactive disabled UI, use aria-disabled instead.',
  'aria-disabled':
    'Use to indicate a disabled state while keeping the element focusable for accessibility. Element remains in keyboard navigation but should not accept input.',
  'readonly':
    'Marks input as read-only. User can select and focus but cannot modify. Element remains in keyboard tab order.',
  'loading':
    'Typically paired with disabled state. Indicates asynchronous operation in progress. Update via onLoadingChange handler.',

  // =========================================================================
  // Composition Guidance
  // =========================================================================
  'as': 'Renders as different HTML element. Common uses: <Button as="a"> for link styling, <Box as="section"> for semantic structure.',
  'asChild':
    'Use when you need full control over the rendered element. Passes all props/behavior to child, child becomes the actual DOM node.',
  'children':
    'Primary way to populate component content. Accepts React elements, text strings, or arrays. Type changes meaning based on component.',

  // =========================================================================
  // Form Control Guidance
  // =========================================================================
  'value':
    'Controlled prop. Must update via onChange handler to reflect state changes. Component does not manage its own value.',
  'defaultValue':
    'Uncontrolled prop. Use when component manages its own state and you do not need to synchronize value with component.',
  'placeholder':
    'Hint text for form inputs. Should not replace labels. Helps users understand expected input format.',

  // =========================================================================
  // Event Handlers
  // =========================================================================
  'onChange': 'Fires when user changes the value. Required for controlled components. Must update parent state.',
  'onSubmit': 'Fires when form is submitted. Typically triggered by button type="submit".',
  'onOpenChange': 'Fires when open/closed state changes. Use to synchronize component state with your app state.',

  // =========================================================================
  // Accessibility Guidance
  // =========================================================================
  'aria-label':
    'Use when visual label is not present. Provides accessible label for screen readers. Alternative to aria-labelledby.',
  'aria-invalid': 'Use on form fields with validation errors. Works with aria-describedby to point to error message.'
};
