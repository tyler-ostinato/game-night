import { defineConfig } from 'vitest/config';

// Lightweight unit tests for pure logic only (no database, no browser). Run with `npm test`.
export default defineConfig({
  test: { include: ['server/src/**/*.test.ts', 'client/src/**/*.test.ts'], environment: 'node' },
});
