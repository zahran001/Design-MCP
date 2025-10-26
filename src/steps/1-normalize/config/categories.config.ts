// =============================================================================
// Component Category Configuration
// =============================================================================
// Created: 2025-10-26
// Purpose: Centralized component category mappings
//
// Loads category data from categories.json and provides type-safe lookup
// functions for determining component categories.
//
// =============================================================================

import categoriesData from './categories.json' with { type: 'json' };
import type { ComponentCategory } from '../../../schemas/NormalizedChunkSchema.js';

/**
 * Map of component name to category
 * Built from categories.json at module load time
 */
export const CATEGORY_MAPPINGS = new Map<string, ComponentCategory>();

// Build the reverse mapping: component -> category
for (const [category, components] of Object.entries(categoriesData.categories)) {
  for (const component of components) {
    CATEGORY_MAPPINGS.set(component, category as ComponentCategory);
  }
}

/**
 * Get component category from component name
 *
 * Handles various name formats:
 * - Direct match: "Button" → "form-controls"
 * - Composite components: "Button.Root" → "form-controls" (checks base name)
 * - Kebab-case: "Checkbox-Card" → "form-controls"
 * - Case insensitive fallback
 *
 * @param componentName - Component name (e.g., "Button", "Checkbox.Root")
 * @returns Component category or "other" if no match
 *
 * @example
 * getCategoryFromComponent("Button") // Returns: "form-controls"
 * getCategoryFromComponent("Button.Root") // Returns: "form-controls"
 * getCategoryFromComponent("HStack") // Returns: "layout"
 * getCategoryFromComponent("Unknown") // Returns: "other"
 */
export function getCategoryFromComponent(componentName: string): ComponentCategory {
  // Direct lookup (exact match)
  if (CATEGORY_MAPPINGS.has(componentName)) {
    return CATEGORY_MAPPINGS.get(componentName)!;
  }

  // Try base name for composite components (e.g., "Checkbox.Root" → "Checkbox")
  if (componentName.includes('.')) {
    const baseName = componentName.split('.')[0];
    if (CATEGORY_MAPPINGS.has(baseName)) {
      return CATEGORY_MAPPINGS.get(baseName)!;
    }
  }

  // Try case-insensitive match
  const lowerName = componentName.toLowerCase();
  for (const [key, value] of CATEGORY_MAPPINGS.entries()) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  // Fallback to "other"
  return 'other';
}

/**
 * Get all components in a specific category
 *
 * @param category - Category name
 * @returns Array of component names in that category
 *
 * @example
 * getComponentsInCategory("form-controls")
 * // Returns: ["Button", "Input", "Checkbox", ...]
 */
export function getComponentsInCategory(category: ComponentCategory): string[] {
  return categoriesData.categories[category as keyof typeof categoriesData.categories] || [];
}

/**
 * Get all available categories
 *
 * @returns Array of all category names
 */
export function getAllCategories(): ComponentCategory[] {
  return Object.keys(categoriesData.categories) as ComponentCategory[];
}

/**
 * Check if a component exists in the category mappings
 *
 * @param componentName - Component name to check
 * @returns True if component is recognized
 *
 * @example
 * isKnownComponent("Button") // Returns: true
 * isKnownComponent("UnknownComponent") // Returns: false
 */
export function isKnownComponent(componentName: string): boolean {
  return getCategoryFromComponent(componentName) !== 'other';
}

/**
 * Get category configuration metadata
 *
 * @returns Category config metadata
 */
export function getCategoryConfigMetadata() {
  return {
    version: categoriesData.version,
    description: categoriesData.description,
    totalCategories: Object.keys(categoriesData.categories).length,
    totalComponents: Array.from(CATEGORY_MAPPINGS.keys()).length
  };
}
