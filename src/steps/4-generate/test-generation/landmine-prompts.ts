// =============================================================================
// Phase 4b — v3 "landmine" prompts (15)
// =============================================================================
// Each targets a known Chakra v2 -> v3 breaking change that a v2-trained model
// will likely emit unless grounded in the retrieved v3 docs. Every prompt uses a
// component that IS in our embedded 50-component corpus, so grounded retrieval
// has real context to work with (fair A/B).
//
// `risks` lists the v2-smell ids (see v2SmellDetector) the prompt is bait for.
// =============================================================================

export interface LandminePrompt {
  id: string;
  query: string;
  /** v2-smell ids this prompt is most likely to trigger (the bait). */
  risks: string[];
  note: string;
}

export const LANDMINE_PROMPTS: LandminePrompt[] = [
  {
    id: 'color-palette',
    query: 'a green solid button that says Submit',
    risks: ['colorScheme'],
    note: 'v2 colorScheme -> v3 colorPalette',
  },
  {
    id: 'button-loading',
    query: 'a button that shows a spinner and the text "Saving..." while a form submits',
    risks: ['isLoading'],
    note: 'v2 isLoading -> v3 loading',
  },
  {
    id: 'button-icon',
    query: 'a button with a mail icon before the label "Email us"',
    risks: ['leftIcon'],
    note: 'v2 leftIcon prop -> v3 icon as a child',
  },
  {
    id: 'icon-button',
    query: 'an icon-only button with a search icon and an accessible label "Search"',
    risks: [],
    note: 'v2 IconButton icon/aria-label prop shape -> v3 IconButton with child icon',
  },
  {
    id: 'checkbox',
    query: 'a checkbox with the label "Accept terms and conditions"',
    risks: [],
    note: 'v2 monolithic <Checkbox> -> v3 Checkbox.Root/.HiddenInput/.Control/.Label',
  },
  {
    id: 'checkbox-disabled',
    query: 'a disabled checkbox labeled "Currently unavailable"',
    risks: ['isDisabled'],
    note: 'v2 isDisabled + monolithic -> v3 disabled + composition',
  },
  {
    id: 'field-email',
    query: 'an email input with a label "Email" and helper text "We will never share it"',
    risks: ['FormControl', 'FormLabel', 'FormHelperText'],
    note: 'v2 FormControl/FormLabel/FormHelperText -> v3 Field.Root/.Label/.HelperText',
  },
  {
    id: 'field-invalid',
    query: 'a required password field that shows the error message "Password is too weak"',
    risks: ['FormControl', 'FormErrorMessage', 'isInvalid', 'isRequired'],
    note: 'v2 FormControl/isInvalid/isRequired -> v3 Field.Root invalid/required + Field.ErrorText',
  },
  {
    id: 'fieldset',
    query: 'a fieldset grouping a first name and last name input under a legend "Your name"',
    risks: ['FormControl', 'FormLabel'],
    note: 'v3 Fieldset.Root/.Legend/.Content composition',
  },
  {
    id: 'stack-gap',
    query: 'three boxes stacked vertically with even space between them',
    risks: ['spacing'],
    note: 'v2 Stack spacing -> v3 gap',
  },
  {
    id: 'number-input',
    query: 'a number input for quantity with a minimum of 0 and a maximum of 10',
    risks: ['NumberInputField', 'NumberInputStepper'],
    note: 'v2 NumberInput/NumberInputField/NumberInputStepper -> v3 NumberInput.Root/.Input/.Control',
  },
  {
    id: 'pin-input',
    query: 'a 4-digit one-time-code input',
    risks: ['PinInputField'],
    note: 'v2 PinInput/PinInputField -> v3 PinInput.Root/.Input',
  },
  {
    id: 'editable',
    query: 'an inline editable text field that previews "Click to edit" and becomes an input on click',
    risks: ['EditablePreview', 'EditableInput'],
    note: 'v2 Editable/EditablePreview/EditableInput -> v3 Editable.Root/.Preview/.Input',
  },
  {
    id: 'input-addon',
    query: 'a text input for a website with a "https://" prefix addon',
    risks: ['InputLeftAddon'],
    note: 'v2 InputGroup/InputLeftAddon -> v3 InputGroup startElement/startAddon',
  },
  {
    id: 'password-input',
    query: 'a password input with a button to toggle visibility',
    risks: [],
    note: 'v3 PasswordInput component (did not exist in v2)',
  },
];
