// =============================================================================
// Explanation Generator - Hardcoded Templates
// =============================================================================
// Created: 2025-10-23
// Reference: POC_PHASE1_IMPLEMENTATION.md - Step 3
//
// Generates natural language content using hardcoded templates.
//
// PURPOSE:
// - Generate explanation, demonstrates, and keyPoints for chunks
// - Use intent-specific templates for consistency
// - Optimize content for embedding models (natural language)
//
// DESIGN PHILOSOPHY:
// - Hardcoded templates for POC (fast, deterministic, testable)
// - Intent-specific templates (6 types: sizing, variants, states, composition, interaction, generic)
// - Natural language optimized for semantic search
// - Can be upgraded to LLM generation in production if needed
//
// =============================================================================

import type {
  SizingTemplateData,
  VariantsTemplateData,
  StatesTemplateData,
  CompositionTemplateData,
  InteractionTemplateData,
  GenericTemplateData,
  TemplateData
} from './templateDataExtractor.js';

/**
 * Generated content for a code example chunk
 */
export interface GeneratedContent {
  explanation: string;       // Natural language explanation (1-3 sentences)
  demonstrates: string[];    // What the code demonstrates (3-5 items)
  keyPoints: string[];       // Teaching moments (2-4 items)
}

/**
 * Generate natural language content from template data
 *
 * Routes to intent-specific template generators
 *
 * @param templateData - Intent-specific template data
 * @returns Generated explanation, demonstrates, and keyPoints
 *
 * @example
 * const data = { intent: 'sizing', data: { component: 'Button', sizes: ['xs', 'sm', 'md'], ... } };
 * const content = generateContent(data);
 * // Returns: {
 * //   explanation: "This example demonstrates how to control Button dimensions...",
 * //   demonstrates: ["Using the size prop to control Button dimensions", ...],
 * //   keyPoints: ["The size prop accepts: 'xs', 'sm', 'md'", ...]
 * // }
 */
export function generateContent(templateData: TemplateData): GeneratedContent {
  switch (templateData.intent) {
    case 'sizing':
      return generateSizingContent(templateData.data);

    case 'variants':
      return generateVariantsContent(templateData.data);

    case 'states':
      return generateStatesContent(templateData.data);

    case 'composition':
      return generateCompositionContent(templateData.data);

    case 'interaction':
      return generateInteractionContent(templateData.data);

    case 'generic':
      return generateGenericContent(templateData.data);
  }
}

// =============================================================================
// Intent-Specific Template Generators
// =============================================================================

/**
 * Generate content for sizing intent
 *
 * Template focuses on size prop and available options
 */
function generateSizingContent(data: SizingTemplateData): GeneratedContent {
  const { component, sizes, sizeCount, layoutComponent, layoutProps } = data;

  // Explanation
  const explanation = sizeCount > 0
    ? `This example demonstrates how to control ${component} dimensions using the size prop, ` +
      `showing ${sizeCount} available size option${sizeCount === 1 ? '' : 's'} ` +
      `(${sizes.map(s => `"${s}"`).join(', ')}). ` +
      (layoutComponent
        ? `The ${layoutComponent} component provides consistent layout and spacing.`
        : `Each size option renders the component with different dimensions.`)
    : `This example demonstrates the ${component} component with size customization options.`;

  // Demonstrates
  const demonstrates: string[] = [
    `Using the size prop to control ${component} dimensions`
  ];

  if (sizes.length > 0) {
    demonstrates.push(`Available size values: ${sizes.map(s => `"${s}"`).join(', ')}`);
  }

  if (layoutComponent) {
    demonstrates.push(`Layout organization with ${layoutComponent} component`);
  }

  if (layoutProps?.gap) {
    demonstrates.push(`Consistent spacing using gap="${layoutProps.gap}"`);
  }

  // Key Points
  const keyPoints: string[] = [];

  if (sizes.length > 0) {
    keyPoints.push(`The size prop accepts: ${sizes.map(s => `"${s}"`).join(', ')}`);
  }

  if (layoutComponent && layoutProps) {
    const propsList = Object.entries(layoutProps)
      .map(([key, val]) => `${key}="${val}"`)
      .join(', ');
    keyPoints.push(`${layoutComponent} with ${propsList} provides consistent layout`);
  }

  keyPoints.push(`Size controls the component's overall dimensions and spacing`);

  return { explanation, demonstrates, keyPoints };
}

/**
 * Generate content for variants intent
 *
 * Template focuses on variant prop and visual styles
 */
function generateVariantsContent(data: VariantsTemplateData): GeneratedContent {
  const { component, variants, variantCount, otherProps } = data;

  // Explanation
  const explanation = variantCount > 0
    ? `This example demonstrates different visual styles for the ${component} component using the variant prop, ` +
      `showcasing ${variantCount} variant${variantCount === 1 ? '' : 's'} ` +
      `(${variants.map(v => `"${v}"`).join(', ')}). ` +
      `Each variant provides a distinct visual appearance while maintaining the same functionality.`
    : `This example demonstrates visual style variants for the ${component} component.`;

  // Demonstrates
  const demonstrates: string[] = [
    `Using the variant prop to change ${component} visual style`
  ];

  if (variants.length > 0) {
    demonstrates.push(`Available variants: ${variants.map(v => `"${v}"`).join(', ')}`);
  }

  if (otherProps?.colorPalette || otherProps?.colorScheme) {
    const colorProp = otherProps.colorPalette ? 'colorPalette' : 'colorScheme';
    demonstrates.push(`Combining variants with ${colorProp} for color theming`);
  }

  if (otherProps && Object.keys(otherProps).length > 0) {
    demonstrates.push(`How variants work with other styling props`);
  }

  // Key Points
  const keyPoints: string[] = [];

  if (variants.length > 0) {
    keyPoints.push(`The variant prop accepts: ${variants.map(v => `"${v}"`).join(', ')}`);
  }

  keyPoints.push(`Variants control visual appearance while preserving component functionality`);

  if (otherProps && Object.keys(otherProps).length > 0) {
    keyPoints.push(`Variants can be combined with other props for customization`);
  }

  return { explanation, demonstrates, keyPoints };
}

/**
 * Generate content for states intent
 *
 * Template focuses on state props (loading, disabled, error, etc.)
 */
function generateStatesContent(data: StatesTemplateData): GeneratedContent {
  const { component, states, stateDescriptions, demonstrations } = data;

  // Explanation
  const stateList = states.length > 0
    ? states.map(s => stateDescriptions[s] || s).join(', ')
    : 'various states';

  const explanation = states.length > 0
    ? `This example demonstrates how to display different states of the ${component} component, ` +
      `including ${stateList}. ` +
      `State props provide visual feedback to users about the component's current condition.`
    : `This example demonstrates various state configurations for the ${component} component.`;

  // Demonstrates
  const demonstratesArray: string[] = demonstrations.length > 0
    ? demonstrations
    : [`Different states of the ${component} component`];

  if (states.length > 1) {
    demonstratesArray.push(`How to combine multiple state props`);
  }

  // Key Points
  const keyPoints: string[] = [];

  states.forEach(state => {
    keyPoints.push(`Use ${state} prop to show ${stateDescriptions[state] || state}`);
  });

  if (keyPoints.length === 0) {
    keyPoints.push(`State props control component behavior and appearance`);
  }

  keyPoints.push(`State props provide important visual feedback to users`);

  return { explanation, demonstrates: demonstratesArray, keyPoints };
}

/**
 * Generate content for composition intent
 *
 * Template focuses on component relationships and patterns
 */
function generateCompositionContent(data: CompositionTemplateData): GeneratedContent {
  const { primaryComponent, subComponents, componentCount, pattern, imports } = data;

  // Explanation
  const explanation = pattern === 'subcomponent composition'
    ? `This example demonstrates the composition pattern for ${primaryComponent}, ` +
      `showing how to use ${subComponents.length} subcomponent${subComponents.length === 1 ? '' : 's'} ` +
      `(${subComponents.slice(0, 3).join(', ')}${subComponents.length > 3 ? ', ...' : ''}) ` +
      `to build a complete ${primaryComponent} interface. ` +
      `This pattern provides fine-grained control over structure and styling.`
    : `This example demonstrates how to compose multiple components together, ` +
      `using ${componentCount} different component${componentCount === 1 ? '' : 's'} ` +
      `to create a cohesive interface. ` +
      `Component composition enables flexible and reusable UI patterns.`;

  // Demonstrates
  const demonstrates: string[] = [];

  if (pattern === 'subcomponent composition') {
    demonstrates.push(`Using ${primaryComponent} subcomponents for composition`);
    demonstrates.push(`Structure: ${subComponents.slice(0, 3).join(' → ')}${subComponents.length > 3 ? ' → ...' : ''}`);
  } else {
    demonstrates.push(`Composing multiple components together`);
    demonstrates.push(`Components used: ${imports.slice(0, 4).join(', ')}${imports.length > 4 ? ', ...' : ''}`);
  }

  demonstrates.push(`How components work together to create complex UIs`);

  // Key Points
  const keyPoints: string[] = [];

  if (pattern === 'subcomponent composition') {
    keyPoints.push(`${primaryComponent} uses a subcomponent pattern for flexibility`);
    keyPoints.push(`Each subcomponent has a specific role in the overall structure`);
  } else {
    keyPoints.push(`Multiple components can be composed for complex interfaces`);
    keyPoints.push(`Component composition promotes reusability and maintainability`);
  }

  if (imports.length > 0) {
    keyPoints.push(`Import all components from the same package: ${imports[0].includes('@') ? imports[0].split('/').slice(0, 2).join('/') : 'package'}`);
  }

  return { explanation, demonstrates, keyPoints };
}

/**
 * Generate content for interaction intent
 *
 * Template focuses on event handlers and state management
 */
function generateInteractionContent(data: InteractionTemplateData): GeneratedContent {
  const { component, hooks, eventHandlers, interactionType } = data;

  // Explanation
  const explanation = hooks.length > 0 || eventHandlers.length > 0
    ? `This example demonstrates ${interactionType} with the ${component} component, ` +
      `showing how to respond to user interactions using ` +
      (hooks.length > 0 ? `${hooks.join(' and ')} for state management` : 'event handlers') +
      (eventHandlers.length > 0 ? ` and ${eventHandlers.join(', ')} for handling events` : '') +
      `. This pattern enables dynamic, user-responsive interfaces.`
    : `This example demonstrates interactive behavior with the ${component} component.`;

  // Demonstrates
  const demonstrates: string[] = [
    `Handling ${interactionType} with ${component}`
  ];

  if (eventHandlers.length > 0) {
    demonstrates.push(`Using ${eventHandlers.join(' and ')} event handler${eventHandlers.length === 1 ? '' : 's'}`);
  }

  if (hooks.includes('useState')) {
    demonstrates.push(`Managing component state with useState hook`);
  }

  if (hooks.includes('useEffect')) {
    demonstrates.push(`Side effects with useEffect hook`);
  }

  demonstrates.push(`Creating interactive, responsive user interfaces`);

  // Key Points
  const keyPoints: string[] = [];

  if (eventHandlers.length > 0) {
    eventHandlers.forEach(handler => {
      keyPoints.push(`${handler} responds to user interactions`);
    });
  }

  if (hooks.includes('useState')) {
    keyPoints.push(`useState maintains component state between renders`);
  }

  if (keyPoints.length === 0) {
    keyPoints.push(`Event handlers enable interactive behavior`);
  }

  keyPoints.push(`Combining state and event handlers creates dynamic UIs`);

  return { explanation, demonstrates, keyPoints };
}

/**
 * Generate content for generic intent (fallback)
 *
 * Generic template for examples that don't fit other patterns
 */
function generateGenericContent(data: GenericTemplateData): GeneratedContent {
  const { component, props, components, hasInteractivity, hasState } = data;

  const propCount = Object.keys(props).length;

  // Explanation
  let explanation = `This example demonstrates the ${component} component`;

  if (propCount > 0) {
    const propNames = Object.keys(props).slice(0, 3);
    explanation += ` with ${propCount} prop${propCount === 1 ? '' : 's'} ` +
      `(${propNames.join(', ')}${propCount > 3 ? ', ...' : ''})`;
  }

  if (components.length > 1) {
    explanation += `, showing how it works with other components`;
  }

  explanation += `. This example provides a practical reference for using ${component} in your application.`;

  // Demonstrates
  const demonstrates: string[] = [
    `Basic usage of the ${component} component`
  ];

  if (propCount > 0) {
    demonstrates.push(`Configuring ${component} with props`);
  }

  if (components.length > 1) {
    demonstrates.push(`Using ${component} with other components`);
  }

  if (hasInteractivity) {
    demonstrates.push(`Interactive behavior and event handling`);
  }

  // Key Points
  const keyPoints: string[] = [];

  if (propCount > 0) {
    const propList = Object.entries(props)
      .slice(0, 2)
      .map(([prop, values]) => `${prop}: ${values.map(v => `"${v}"`).join(', ')}`)
      .join('; ');
    keyPoints.push(`Common props: ${propList}`);
  }

  if (hasState) {
    keyPoints.push(`Example uses React state for dynamic behavior`);
  }

  keyPoints.push(`${component} is flexible and can be customized for various use cases`);

  return { explanation, demonstrates, keyPoints };
}
