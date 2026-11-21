import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    include: ['lib/**/*.test.ts', 'components/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'components/**/*.tsx'],
      exclude: ['**/*.test.*', 'lib/game/__checks__/**'],
      reporter: ['text-summary', 'text'],
      // The game logic is the part that must not regress; keep it near-complete.
      thresholds: {
        'lib/game/*.ts': { statements: 95, branches: 90, functions: 95, lines: 95 },
      },
    },
  },
});
