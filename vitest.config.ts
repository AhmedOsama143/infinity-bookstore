import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // happy-dom (≈3x faster than jsdom) for the handful of component tests
    // we ship in v1.0.0; nothing here exercises browser-only APIs like
    // canvas or webgl yet.
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'lib/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['lib/**/*.ts', 'lib/**/*.tsx'],
      exclude: [
        'lib/**/*.test.ts',
        'lib/**/types.ts',
        'lib/supabase/**', // thin client wrappers
      ],
      // CLAUDE.md says 80% for business logic, 100% for security-critical
      // and payment paths. Keep the floor moderate to start; tighten in CI
      // when there's a real baseline.
      thresholds: {
        lines: 70,
        branches: 70,
        functions: 70,
        statements: 70,
      },
    },
    // Deterministic — no clock dependence, no network. Fix the seed so
    // anything stochastic (currently nothing) stays reproducible.
    sequence: { seed: 42 },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
