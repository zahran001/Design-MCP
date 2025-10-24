// =============================================================================
// Template Data Extractor
// =============================================================================
// Created: 2025-10-23
// Reference: POC_PHASE1_IMPLEMENTATION.md - Step 3
//
// Extracts structured data from code analysis outputs to populate templates.
//
// PURPOSE:
// - Separate data extraction from text generation
// - Prepare clean, typed data for template functions
// - Normalize patterns for consistent template rendering
//
// DESIGN:
// - Pure data transformation (no text generation)
// - Intent-specific extractors for targeted data
// - Defensive programming (handle missing data gracefully)
//
// =============================================================================

import type { CodeAnalysis, PropUsage } from '../inference/codeAnalyzer.js';

/**
 * Template data for sizing intent
 */
export interface SizingTemplateData {
  component: string;           // Primary component ("Button")
  sizes: string[];             // All size values found (["xs", "sm", "md", "lg"])
  sizeCount: number;           // Number of sizes (4)
  layoutComponent?: string;    // Container component if present ("HStack")
  layoutProps?: Record<string, string>; // Container props ({ gap: "6" })
}

/**
 * Template data for variants intent
 */
export interface VariantsTemplateData {
  component: string;           // Primary component ("Button")
  variants: string[];          // All variant values (["solid", "outline", "ghost"])
  variantCount: number;        // Number of variants (3)
  otherProps?: Record<string, string[]>; // Other props used (colorPalette, size, etc.)
}

/**
 * Template data for states intent
 */
export interface StatesTemplateData {
  component: string;           // Primary component ("Button")
  states: string[];            // State props found (["loading", "disabled"])
  stateDescriptions: Record<string, string>; // Human-readable descriptions
  demonstrations: string[];    // What each state shows
}

/**
 * Template data for composition intent
 */
export interface CompositionTemplateData {
  primaryComponent: string;    // Main component ("Checkbox")
  subComponents: string[];     // Subcomponents (["Checkbox.Root", "Checkbox.Label"])
  componentCount: number;      // Total unique components (5)
  pattern: string;             // Pattern name ("subcomponent composition" or "multi-component")
  imports: string[];           // All imports needed
}

/**
 * Template data for interaction intent
 */
export interface InteractionTemplateData {
  component: string;           // Primary component ("Button")
  hooks: string[];             // React hooks used (["useState"])
  eventHandlers: string[];     // Event handlers (["onClick"])
  stateVariables: string[];    // Inferred state var names (["count", "isOpen"])
  interactionType: string;     // Type of interaction ("click handler", "form submission")
}

/**
 * Template data for generic intent (fallback)
 */
export interface GenericTemplateData {
  component: string;           // Primary component ("Button")
  props: Record<string, string[]>; // All props used
  components: string[];        // All components used
  hasInteractivity: boolean;   // Has event handlers?
  hasState: boolean;           // Uses state hooks?
}

/**
 * Union type for all template data
 */
export type TemplateData =
  | { intent: 'sizing'; data: SizingTemplateData }
  | { intent: 'variants'; data: VariantsTemplateData }
  | { intent: 'states'; data: StatesTemplateData }
  | { intent: 'composition'; data: CompositionTemplateData }
  | { intent: 'interaction'; data: InteractionTemplateData }
  | { intent: 'generic'; data: GenericTemplateData };

/**
 * Extract template data based on intent classification
 *
 * Routes to intent-specific extractors and returns typed data
 *
 * @param intent - Intent classification (sizing, variants, states, etc.)
 * @param analysis - Code analysis result
 * @param componentName - Primary component name
 * @returns Intent-specific template data
 *
 * @example
 * const analysis = analyzeCode(code);
 * const data = extractTemplateData('sizing', analysis, 'Button');
 * // Returns: { intent: 'sizing', data: { component: 'Button', sizes: [...], ... } }
 */
export function extractTemplateData(
  intent: string,
  analysis: CodeAnalysis,
  componentName: string
): TemplateData {
  switch (intent) {
    case 'sizing':
      return { intent: 'sizing', data: extractSizingData(analysis, componentName) };

    case 'variants':
      return { intent: 'variants', data: extractVariantsData(analysis, componentName) };

    case 'states':
      return { intent: 'states', data: extractStatesData(analysis, componentName) };

    case 'composition':
      return { intent: 'composition', data: extractCompositionData(analysis, componentName) };

    case 'interaction':
      return { intent: 'interaction', data: extractInteractionData(analysis, componentName) };

    case 'generic':
    default:
      return { intent: 'generic', data: extractGenericData(analysis, componentName) };
  }
}

// =============================================================================
// Intent-Specific Extractors
// =============================================================================

/**
 * Extract data for sizing templates
 *
 * Focuses on size prop values and layout patterns
 */
function extractSizingData(
  analysis: CodeAnalysis,
  componentName: string
): SizingTemplateData {
  // Find size prop usage
  const sizeProp = analysis.props.find(p =>
    p.component === componentName && p.prop === 'size'
  );

  const sizes = sizeProp?.values || [];

  // Find layout component (HStack, VStack, Stack, Flex, etc.)
  const layoutComponent = analysis.components.find(c =>
    ['HStack', 'VStack', 'Stack', 'Flex', 'Grid', 'SimpleGrid'].includes(c)
  );

  // Get layout props if layout component exists
  const layoutProps: Record<string, string> = {};
  if (layoutComponent) {
    const layoutPropUsages = analysis.props.filter(p => p.component === layoutComponent);
    layoutPropUsages.forEach(p => {
      layoutProps[p.prop] = p.values[0]; // Use first value
    });
  }

  return {
    component: componentName,
    sizes,
    sizeCount: sizes.length,
    layoutComponent,
    layoutProps: Object.keys(layoutProps).length > 0 ? layoutProps : undefined
  };
}

/**
 * Extract data for variants templates
 *
 * Focuses on variant prop values and complementary styling props
 */
function extractVariantsData(
  analysis: CodeAnalysis,
  componentName: string
): VariantsTemplateData {
  // Find variant prop usage
  const variantProp = analysis.props.find(p =>
    p.component === componentName && p.prop === 'variant'
  );

  const variants = variantProp?.values || [];

  // Get other styling props (exclude variant and common layout props)
  const excludeProps = new Set(['variant', 'children', 'key', 'className', 'style']);
  const otherProps: Record<string, string[]> = {};

  analysis.props
    .filter(p => p.component === componentName && !excludeProps.has(p.prop))
    .forEach(p => {
      otherProps[p.prop] = p.values;
    });

  return {
    component: componentName,
    variants,
    variantCount: variants.length,
    otherProps: Object.keys(otherProps).length > 0 ? otherProps : undefined
  };
}

/**
 * Extract data for states templates
 *
 * Focuses on state-related props (loading, disabled, error, etc.)
 */
function extractStatesData(
  analysis: CodeAnalysis,
  componentName: string
): StatesTemplateData {
  // State prop patterns
  const statePropsMap: Record<string, string> = {
    'loading': 'loading state',
    'isLoading': 'loading state',
    'disabled': 'disabled state',
    'isDisabled': 'disabled state',
    'error': 'error state',
    'invalid': 'invalid state',
    'isInvalid': 'invalid state',
    'readOnly': 'read-only state',
    'isReadOnly': 'read-only state',
    'required': 'required state',
    'isRequired': 'required state'
  };

  const states: string[] = [];
  const stateDescriptions: Record<string, string> = {};
  const demonstrations: string[] = [];

  // Find state props
  analysis.props
    .filter(p => p.component === componentName && statePropsMap[p.prop])
    .forEach(p => {
      const state = p.prop;
      const description = statePropsMap[state];

      if (!states.includes(state)) {
        states.push(state);
        stateDescriptions[state] = description;
        demonstrations.push(`How to show ${description} using the ${state} prop`);
      }
    });

  return {
    component: componentName,
    states,
    stateDescriptions,
    demonstrations
  };
}

/**
 * Extract data for composition templates
 *
 * Focuses on component relationships and patterns
 */
function extractCompositionData(
  analysis: CodeAnalysis,
  componentName: string
): CompositionTemplateData {
  // Check for subcomponent pattern (e.g., Checkbox.Root, Checkbox.Label)
  const subComponents = analysis.components.filter(c =>
    c.startsWith(`${componentName}.`)
  );

  const pattern = subComponents.length > 0
    ? 'subcomponent composition'
    : 'multi-component';

  // Get all imports
  const imports = analysis.imports.flatMap(imp => imp.imports);

  return {
    primaryComponent: componentName,
    subComponents: subComponents.length > 0 ? subComponents : analysis.components,
    componentCount: analysis.components.length,
    pattern,
    imports
  };
}

/**
 * Extract data for interaction templates
 *
 * Focuses on event handlers and state management
 */
function extractInteractionData(
  analysis: CodeAnalysis,
  componentName: string
): InteractionTemplateData {
  // Infer state variable names from hooks (simplified - just use generic names)
  const stateVariables: string[] = [];
  if (analysis.hooks.includes('useState')) {
    // Generic state variable names based on context
    if (analysis.eventHandlers.includes('onClick')) {
      stateVariables.push('state');
    }
  }

  // Determine interaction type
  let interactionType = 'user interaction';
  if (analysis.eventHandlers.includes('onClick')) {
    interactionType = 'click handling';
  } else if (analysis.eventHandlers.includes('onChange')) {
    interactionType = 'change handling';
  } else if (analysis.eventHandlers.includes('onSubmit')) {
    interactionType = 'form submission';
  }

  return {
    component: componentName,
    hooks: analysis.hooks,
    eventHandlers: analysis.eventHandlers,
    stateVariables,
    interactionType
  };
}

/**
 * Extract data for generic templates (fallback)
 *
 * General-purpose data extraction
 */
function extractGenericData(
  analysis: CodeAnalysis,
  componentName: string
): GenericTemplateData {
  // Group props by prop name
  const props: Record<string, string[]> = {};
  analysis.props
    .filter(p => p.component === componentName)
    .forEach(p => {
      props[p.prop] = p.values;
    });

  return {
    component: componentName,
    props,
    components: analysis.components,
    hasInteractivity: analysis.hasInteractivity,
    hasState: analysis.hasState
  };
}

/**
 * Get primary component from analysis
 *
 * Heuristic: Most frequently used component that isn't a layout component
 *
 * @param analysis - Code analysis result
 * @returns Primary component name
 */
export function getPrimaryComponent(analysis: CodeAnalysis): string {
  // Layout components to deprioritize
  const layoutComponents = new Set([
    'HStack', 'VStack', 'Stack', 'Flex', 'Grid', 'SimpleGrid',
    'Box', 'Container', 'Center', 'Wrap'
  ]);

  // Count component usage
  const componentCounts = new Map<string, number>();
  analysis.props.forEach(p => {
    componentCounts.set(p.component, (componentCounts.get(p.component) || 0) + 1);
  });

  // Find most used non-layout component
  const nonLayoutComponents = Array.from(componentCounts.entries())
    .filter(([comp]) => !layoutComponents.has(comp))
    .sort((a, b) => b[1] - a[1]);

  if (nonLayoutComponents.length > 0) {
    return nonLayoutComponents[0][0];
  }

  // Fallback: first component
  return analysis.components[0] || 'Component';
}
