import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: process.env.INTEGRATION === '1' ? [] : ['**/*.integration.test.ts', '**/node_modules/**'],
  },
});
