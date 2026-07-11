import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Data-layer tests run in node; UI component/scenario tests (test/ui/*.test.tsx)
// opt into jsdom per-file via `// @vitest-environment jsdom` (SPEC-002 REQ-008).
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    environment: 'node',
    setupFiles: ['test/ui/setup.ts'],
  },
});
