// =============================================================================
// Section Title Inference
// =============================================================================
// Created: 2025-10-22
// Reference: NORMALIZATION_GUIDE.md - Phase 1 POC
//
// Infers semantic section titles from code patterns.
//
// CHALLENGE: 60% of code examples have no section or generic "Usage" title
// SOLUTION: Pattern matching on code content to infer semantic titles
//
// CONFIDENCE SCORING:
// - 0.9-1.0: Strong pattern match (multiple indicators)
// - 0.7-0.9: Medium pattern match (single clear indicator)
// - 0.5-0.7: Weak pattern match or existing section
// - 0.3-0.5: Fallback to generic title
//
// =============================================================================

/**
 * Section inference result with confidence score
 */
export interface SectionInference {
  title: string;                                           // Inferred section title
  confidence: number;                                      // 0.0-1.0
  method: 'pattern_match' | 'existing_section' | 'fallback'; // How was it inferred?
  matchedPattern?: string;                                 // For debugging
}

/**
 * Infer semantic section title from code patterns
 *
 * Uses priority-ordered pattern matching to determine what the code demonstrates.
 * Falls back to existing section or generic title if no patterns match.
 *
 * @param code - Source code to analyze
 * @param existingSection - Section from raw extract (optional)
 * @param componentName - Component name for context (optional)
 * @returns Section inference with confidence score
 *
 * @example
 * const code = `<Button size="xs">Small</Button><Button size="lg">Large</Button>`;
 * const result = inferSectionTitle(code);
 * // Returns: {
 * //   title: "Size Variants",
 * //   confidence: 0.95,
 * //   method: "pattern_match",
 * //   matchedPattern: "multiple_size_values"
 * // }
 */
export function inferSectionTitle(
  code: string,
  existingSection?: string,
  componentName?: string
): SectionInference {
  // Pattern 1: Multiple size values (HIGH CONFIDENCE)
  if (hasMultipleValues(code, 'size')) {
    return {
      title: 'Size Variants',
      confidence: 0.95,
      method: 'pattern_match',
      matchedPattern: 'multiple_size_values'
    };
  }

  // Pattern 2: Multiple variant values (HIGH CONFIDENCE)
  if (hasMultipleValues(code, 'variant')) {
    return {
      title: 'Visual Variants',
      confidence: 0.95,
      method: 'pattern_match',
      matchedPattern: 'multiple_variant_values'
    };
  }

  // Pattern 3: Multiple colorPalette/colorScheme values (HIGH CONFIDENCE)
  if (hasMultipleValues(code, 'colorPalette') || hasMultipleValues(code, 'colorScheme')) {
    return {
      title: 'Color Palettes',
      confidence: 0.95,
      method: 'pattern_match',
      matchedPattern: 'multiple_color_values'
    };
  }

  // Pattern 4: Loading state (MEDIUM CONFIDENCE)
  if (code.match(/\b(loading|isLoading)(\s*=|\s+|\s*>|\s*\/)|<Spinner|<CircularProgress/)) {
    return {
      title: 'Loading State',
      confidence: 0.9,
      method: 'pattern_match',
      matchedPattern: 'loading_indicator'
    };
  }

  // Pattern 5: Disabled state (MEDIUM CONFIDENCE)
  if (code.match(/\b(disabled|isDisabled)(\s*=|\s+|\s*>|\s*\/)/)) {
    return {
      title: 'Disabled State',
      confidence: 0.9,
      method: 'pattern_match',
      matchedPattern: 'disabled_prop'
    };
  }

  // Pattern 6: Error/Invalid state (MEDIUM CONFIDENCE)
  if (code.match(/\b(error|invalid|isInvalid)(\s*=|\s+|\s*>|\s*\/)/)) {
    return {
      title: 'Error State',
      confidence: 0.85,
      method: 'pattern_match',
      matchedPattern: 'error_state'
    };
  }

  // Pattern 7: With icons (MEDIUM CONFIDENCE)
  if (code.match(/<Icon|leftIcon|rightIcon|startElement|endElement/)) {
    const title = componentName
      ? `${componentName} with Icons`
      : 'With Icons';
    return {
      title,
      confidence: 0.85,
      method: 'pattern_match',
      matchedPattern: 'icon_usage'
    };
  }

  // Pattern 8: Interactive/onClick (LOW-MEDIUM CONFIDENCE)
  if (code.includes('onClick') && code.match(/\buseState\b/)) {
    return {
      title: 'Interactive Example',
      confidence: 0.8,
      method: 'pattern_match',
      matchedPattern: 'interactive_with_state'
    };
  }

  // Pattern 9: Form integration (LOW-MEDIUM CONFIDENCE)
  if (code.match(/<Form|onSubmit|useForm/)) {
    const title = componentName
      ? `${componentName} in Forms`
      : 'Form Integration';
    return {
      title,
      confidence: 0.8,
      method: 'pattern_match',
      matchedPattern: 'form_usage'
    };
  }

  // Pattern 10: Composition (multiple subcomponents)
  if (componentName && (code.match(new RegExp(`${componentName}\\.\\w+`, 'g'))?.length ?? 0) > 2) {
    return {
      title: 'Composition Structure',
      confidence: 0.75,
      method: 'pattern_match',
      matchedPattern: 'subcomponent_composition'
    };
  }

  // =========================================================================
  // NEW PATTERNS (Stage 3 Enhancement)
  // =========================================================================

  // Pattern 11: Accessibility features (HIGH PRIORITY)
  if (code.match(/\b(aria-|ariaLabel|ariaDescribedBy|role=|screenReader|keyboardNav|tabIndex)/)) {
    return {
      title: 'Accessibility',
      confidence: 0.9,
      method: 'pattern_match',
      matchedPattern: 'accessibility_features'
    };
  }

  // Pattern 12: Responsive design (MEDIUM PRIORITY)
  if (code.match(/\b(base|sm|md|lg|xl|2xl|breakpoint|responsive|mobile|desktop|hideBelow|hideFrom)/)) {
    return {
      title: 'Responsive Design',
      confidence: 0.85,
      method: 'pattern_match',
      matchedPattern: 'responsive_props'
    };
  }

  // Pattern 13: Form validation (MEDIUM PRIORITY)
  if (code.match(/\b(validation|validator|error|isInvalid|required|pattern|min|max|validate|useForm|register)/)) {
    return {
      title: 'Form Validation',
      confidence: 0.85,
      method: 'pattern_match',
      matchedPattern: 'form_validation'
    };
  }

  // Pattern 14: Theming/Custom styling (MEDIUM PRIORITY)
  if (code.match(/\b(theme|createTheme|useTheme|ThemeProvider|colorMode|darkMode|lightMode|css=)/)) {
    return {
      title: 'Theming',
      confidence: 0.85,
      method: 'pattern_match',
      matchedPattern: 'theming_customization'
    };
  }

  // Pattern 15: Custom styling with sx prop (MEDIUM PRIORITY)
  if (code.match(/\bsx=\{/)) {
    return {
      title: 'Custom Styling',
      confidence: 0.8,
      method: 'pattern_match',
      matchedPattern: 'sx_prop_styling'
    };
  }

  // Pattern 16: Animation/Transitions (LOW-MEDIUM PRIORITY)
  if (code.match(/\b(animation|transition|keyframes|animate|motion|framer)/)) {
    return {
      title: 'Animations',
      confidence: 0.8,
      method: 'pattern_match',
      matchedPattern: 'animation_transition'
    };
  }

  // Pattern 17: Controlled vs Uncontrolled (MEDIUM PRIORITY)
  if (code.match(/\b(value|onChange|defaultValue|uncontrolled|controlled)/)) {
    const hasValue = code.includes('value=');
    const hasDefaultValue = code.includes('defaultValue=');
    if (hasValue && !hasDefaultValue) {
      return {
        title: 'Controlled Component',
        confidence: 0.75,
        method: 'pattern_match',
        matchedPattern: 'controlled_pattern'
      };
    } else if (hasDefaultValue && !hasValue) {
      return {
        title: 'Uncontrolled Component',
        confidence: 0.75,
        method: 'pattern_match',
        matchedPattern: 'uncontrolled_pattern'
      };
    }
  }

  // Pattern 18: Component hooks usage (MEDIUM PRIORITY)
  if (componentName && code.match(new RegExp(`use${componentName}`, 'i'))) {
    return {
      title: 'Using Component Hooks',
      confidence: 0.85,
      method: 'pattern_match',
      matchedPattern: 'component_hooks'
    };
  }

  // Pattern 19: Ref forwarding (LOW PRIORITY)
  if (code.match(/\b(ref=|useRef|forwardRef|createRef)/)) {
    return {
      title: 'Ref Forwarding',
      confidence: 0.75,
      method: 'pattern_match',
      matchedPattern: 'ref_usage'
    };
  }

  // Pattern 20: Indeterminate state (LOW PRIORITY)
  if (code.match(/\b(indeterminate|isIndeterminate|partial)/)) {
    return {
      title: 'Indeterminate State',
      confidence: 0.85,
      method: 'pattern_match',
      matchedPattern: 'indeterminate_state'
    };
  }

  // Pattern 21: Conditional rendering (LOW PRIORITY)
  if (code.match(/\{\s*\w+\s*\?\s*<|&&\s*</)) {
    return {
      title: 'Conditional Rendering',
      confidence: 0.7,
      method: 'pattern_match',
      matchedPattern: 'conditional_render'
    };
  }

  // Pattern 22: Data mapping/rendering (MEDIUM PRIORITY)
  if (code.match(/\.(map|filter|reduce)\s*\(.*?=>\s*</)) {
    return {
      title: 'Rendering Lists',
      confidence: 0.8,
      method: 'pattern_match',
      matchedPattern: 'data_mapping'
    };
  }

  // Pattern 23: Event handling (MEDIUM PRIORITY)
  if (code.match(/\b(onPress|onHover|onFocus|onBlur|onKeyDown|onKeyUp)/)) {
    return {
      title: 'Event Handling',
      confidence: 0.75,
      method: 'pattern_match',
      matchedPattern: 'event_handlers'
    };
  }

  // Pattern 24: Read-only state (LOW PRIORITY)
  if (code.match(/\b(readOnly|isReadOnly|readonly)/)) {
    return {
      title: 'Read-Only State',
      confidence: 0.8,
      method: 'pattern_match',
      matchedPattern: 'readonly_state'
    };
  }

  // Pattern 25: Required fields (MEDIUM PRIORITY)
  if (code.match(/\b(required|isRequired|\*|mandatory)/)) {
    return {
      title: 'Required Fields',
      confidence: 0.75,
      method: 'pattern_match',
      matchedPattern: 'required_fields'
    };
  }

  // Use existing section if provided and not generic
  if (existingSection && !isGenericSection(existingSection)) {
    return {
      title: existingSection,
      confidence: 0.6,
      method: 'existing_section'
    };
  }

  // Fallback to generic title
  return {
    title: 'Usage Example',
    confidence: 0.3,
    method: 'fallback'
  };
}

/**
 * Check if a prop has multiple distinct values in the code
 *
 * Used to detect "variants" examples that show multiple options
 *
 * @param code - Source code
 * @param propName - Prop to check (e.g., "size", "variant")
 * @returns True if multiple distinct values found
 *
 * @example
 * hasMultipleValues('<Button size="xs"/><Button size="lg"/>', 'size')
 * // Returns: true
 *
 * hasMultipleValues('<Button size="md"/>', 'size')
 * // Returns: false
 */
function hasMultipleValues(code: string, propName: string): boolean {
  // Match: propName="value" or propName='value'
  const regex = new RegExp(`${propName}=["']([^"']+)["']`, 'g');
  const values = new Set<string>();
  let match;

  while ((match = regex.exec(code)) !== null) {
    values.add(match[1]);
  }

  return values.size >= 2;
}

/**
 * Check if a section title is generic/non-semantic
 *
 * Generic sections don't provide meaningful context:
 * - "Usage"
 * - "Example"
 * - "Example 1", "Example 2", etc.
 *
 * @param section - Section title to check
 * @returns True if section is generic
 */
function isGenericSection(section: string): boolean {
  const genericPatterns = [
    /^usage$/i,
    /^example$/i,
    /^example\s+\d+$/i,
    /^demo$/i,
    /^basic$/i
  ];

  return genericPatterns.some(pattern => pattern.test(section));
}
