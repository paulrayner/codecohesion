import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      // Use V8's built-in instrumentation for accurate coverage data
      provider: 'v8',
      // Scope coverage to lib utilities only — exclude god objects and entry points
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/**/*.test.ts',
        'src/lib/**/*.spec.ts',
        'src/lib/test-fixtures/**',
      ],
      reporter: ['text', 'json-summary'],
      // Pre-existing test failures in ForceDirectedLayoutStrategy and data-loader
      // must not block coverage reporting — thresholds are the green gate
      reportOnFailure: true,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
      },
    },
  },
});
