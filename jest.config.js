// =============================================================================
// Jest Configuration
// =============================================================================
// TypeScript + ESM support for testing normalization utilities
//
// Run: npm test
// =============================================================================

export default {
  // Use ts-jest for TypeScript support
  preset: 'ts-jest/presets/default-esm',

  // Test environment
  testEnvironment: 'node',

  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Transform TypeScript files
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowSyntheticDefaultImports: true
        }
      }
    ]
  },

  // Module name mapping for ESM
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.test.ts'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/index.ts'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],

  // Verbose output
  verbose: true,

  // ESM support
  extensionsToTreatAsEsm: ['.ts']
};
