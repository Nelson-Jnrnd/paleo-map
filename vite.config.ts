import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Static SPA (SPEC-002 REQ-003). `pnpm run build` emits static assets under
// `dist/`; the snapshot data artifact is written into `public/data/` by the
// `prebuild` step (see scripts/gen_web_data.ts) and copied verbatim, so the
// runtime reads a prebuilt local file only — no backend, no upstream egress
// (SPEC-003 NFR-001, SPEC-002 REQ-001/006).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
