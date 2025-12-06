import { defineConfig } from 'vitest/config';

// Vitest configuration for this small TypeScript Node project.
// - Test files: look for common .test/.spec patterns and _tests_ folder
// - Environment: node (this repo targets Node runtime)
// - Globals: enable Jest-like globals for simpler tests
// - Coverage: use V8 provider (devDependency present)

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      '**/_tests_/**/*.test.{js,ts,mjs,mts}',
      '**/_tests_/**/*.spec.{js,ts,mjs,mts}',
      '**/*.test.{js,ts,mjs,mts}',
      '**/*.spec.{js,ts,mjs,mts}'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
