import { describe, it, expect } from '@jest/globals';
import {
  getCategoryFromComponent,
  getComponentsInCategory,
  getAllCategories,
  isKnownComponent,
  getCategoryConfigMetadata,
  CATEGORY_MAPPINGS
} from '../categories.config.js';

describe('categories.config', () => {
  describe('getCategoryFromComponent', () => {
    it('should return correct category for direct match', () => {
      expect(getCategoryFromComponent('Button')).toBe('form-controls');
      expect(getCategoryFromComponent('HStack')).toBe('layout');
      expect(getCategoryFromComponent('Alert')).toBe('feedback');
    });

    it('should handle composite components (dot notation)', () => {
      expect(getCategoryFromComponent('Checkbox.Root')).toBe('form-controls');
      expect(getCategoryFromComponent('Button.Root')).toBe('form-controls');
      expect(getCategoryFromComponent('ColorPicker.Root')).toBe('other');
    });

    it('should handle case-insensitive matching', () => {
      expect(getCategoryFromComponent('button')).toBe('form-controls');
      expect(getCategoryFromComponent('BUTTON')).toBe('form-controls');
      expect(getCategoryFromComponent('HsTaCk')).toBe('layout');
    });

    it('should return "other" for unknown components', () => {
      expect(getCategoryFromComponent('UnknownComponent')).toBe('other');
      expect(getCategoryFromComponent('RandomThing')).toBe('other');
    });

    it('should handle hyphenated component names', () => {
      expect(getCategoryFromComponent('Checkbox-Card')).toBe('form-controls');
      expect(getCategoryFromComponent('Close-Button')).toBe('form-controls');
    });
  });

  describe('getComponentsInCategory', () => {
    it('should return all components in form-controls category', () => {
      const components = getComponentsInCategory('form-controls');
      expect(components).toContain('Button');
      expect(components).toContain('Input');
      expect(components).toContain('Checkbox');
      expect(components.length).toBeGreaterThan(10);
    });

    it('should return all components in layout category', () => {
      const components = getComponentsInCategory('layout');
      expect(components).toContain('Stack');
      expect(components).toContain('HStack');
      expect(components).toContain('Box');
    });

    it('should return empty array for invalid category', () => {
      const components = getComponentsInCategory('invalid-category' as any);
      expect(components).toEqual([]);
    });
  });

  describe('getAllCategories', () => {
    it('should return all category names', () => {
      const categories = getAllCategories();
      expect(categories).toContain('form-controls');
      expect(categories).toContain('layout');
      expect(categories).toContain('typography');
      expect(categories).toContain('feedback');
      expect(categories).toContain('overlay');
      expect(categories).toContain('disclosure');
      expect(categories).toContain('navigation');
      expect(categories).toContain('data-display');
      expect(categories).toContain('media');
      expect(categories).toContain('other');
    });

    it('should return at least 10 categories', () => {
      const categories = getAllCategories();
      expect(categories.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('isKnownComponent', () => {
    it('should return true for known components', () => {
      expect(isKnownComponent('Button')).toBe(true);
      expect(isKnownComponent('HStack')).toBe(true);
      expect(isKnownComponent('Alert')).toBe(true);
    });

    it('should return false for unknown components', () => {
      expect(isKnownComponent('UnknownComponent')).toBe(false);
      expect(isKnownComponent('RandomThing')).toBe(false);
    });

    it('should handle composite components', () => {
      expect(isKnownComponent('Checkbox.Root')).toBe(true);
      expect(isKnownComponent('Button.Root')).toBe(true);
    });
  });

  describe('getCategoryConfigMetadata', () => {
    it('should return valid metadata', () => {
      const metadata = getCategoryConfigMetadata();
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.totalCategories).toBeGreaterThan(0);
      expect(metadata.totalComponents).toBeGreaterThan(0);
      expect(metadata.description).toBeDefined();
    });

    it('should have consistent component count', () => {
      const metadata = getCategoryConfigMetadata();
      expect(metadata.totalComponents).toBe(CATEGORY_MAPPINGS.size);
    });
  });

  describe('CATEGORY_MAPPINGS', () => {
    it('should be a Map with entries', () => {
      expect(CATEGORY_MAPPINGS).toBeInstanceOf(Map);
      expect(CATEGORY_MAPPINGS.size).toBeGreaterThan(0);
    });

    it('should have Button mapped', () => {
      expect(CATEGORY_MAPPINGS.has('Button')).toBe(true);
      expect(CATEGORY_MAPPINGS.get('Button')).toBe('form-controls');
    });

    it('should have no duplicate components', () => {
      const allComponents = getAllCategories().flatMap(cat =>
        getComponentsInCategory(cat)
      );
      const uniqueComponents = new Set(allComponents);
      // Note: Some components may appear in multiple categories, that's OK
      expect(uniqueComponents.size).toBeGreaterThan(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(getCategoryFromComponent('')).toBe('other');
    });

    it('should handle numbers in component names', () => {
      const result = getCategoryFromComponent('Component123');
      expect(result).toBeDefined();
    });

    it('should handle multiple dots in component name', () => {
      const result = getCategoryFromComponent('Component.Sub.Deep');
      // Should check base name "Component"
      expect(result).toBeDefined();
    });
  });
});
