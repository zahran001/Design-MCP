// =============================================================================
// v2-smell detector (Phase 4b diagnostic)
// =============================================================================
// tsc is BLIND to prop-level v2->v3 drift: Chakra v3's permissive prop types
// silently swallow removed props like `colorScheme`, so a migration bug compiles
// clean and only surfaces at render. This detector catches that class — a small,
// curated set of WELL-DOCUMENTED v2 API that v3 renamed/removed. It is a
// diagnostic (not the headline), and it is exactly the failure mode the
// spec-driven retrieval context is meant to prevent.
// =============================================================================

export interface V2Smell {
  id: string;
  /** Matches the v2 API token in generated code. */
  pattern: RegExp;
  /** The v3 replacement (for reporting). */
  v3: string;
}

export const V2_SMELLS: V2Smell[] = [
  // prop renames (the ones tsc cannot see)
  { id: 'colorScheme', pattern: /\bcolorScheme\s*=/, v3: 'colorPalette' },
  { id: 'isLoading', pattern: /\bisLoading\b/, v3: 'loading' },
  { id: 'isDisabled', pattern: /\bisDisabled\b/, v3: 'disabled' },
  { id: 'isInvalid', pattern: /\bisInvalid\b/, v3: 'invalid' },
  { id: 'isChecked', pattern: /\bisChecked\b/, v3: 'checked' },
  { id: 'isRequired', pattern: /\bisRequired\b/, v3: 'required' },
  { id: 'leftIcon', pattern: /\bleftIcon\s*=/, v3: 'render the icon as a child' },
  { id: 'rightIcon', pattern: /\brightIcon\s*=/, v3: 'render the icon as a child' },
  { id: 'spacing', pattern: /\bspacing\s*=/, v3: 'gap' },

  // removed / renamed components (tsc catches these as bad imports, but listing
  // them here gives a single prop-level+structure drift signal too)
  { id: 'FormControl', pattern: /\bFormControl\b/, v3: 'Field.Root' },
  { id: 'FormLabel', pattern: /\bFormLabel\b/, v3: 'Field.Label' },
  { id: 'FormHelperText', pattern: /\bFormHelperText\b/, v3: 'Field.HelperText' },
  { id: 'FormErrorMessage', pattern: /\bFormErrorMessage\b/, v3: 'Field.ErrorText' },
  { id: 'NumberInputField', pattern: /\bNumberInputField\b/, v3: 'NumberInput.Input' },
  { id: 'NumberInputStepper', pattern: /\bNumberInputStepper\b/, v3: 'NumberInput.Control' },
  { id: 'EditablePreview', pattern: /\bEditablePreview\b/, v3: 'Editable.Preview' },
  { id: 'EditableInput', pattern: /\bEditableInput\b/, v3: 'Editable.Input' },
  { id: 'PinInputField', pattern: /\bPinInputField\b/, v3: 'PinInput.Input' },
  { id: 'InputLeftAddon', pattern: /\bInputLeft(Addon|Element)\b/, v3: 'InputGroup startElement/startAddon' },
  { id: 'InputRightAddon', pattern: /\bInputRight(Addon|Element)\b/, v3: 'InputGroup endElement/endAddon' },
];

/** Return the ids of v2 anti-patterns found in the generated code. */
export function detectV2Smells(code: string): string[] {
  return V2_SMELLS.filter((s) => s.pattern.test(code)).map((s) => s.id);
}
