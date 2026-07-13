import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config (SPEC-002 REQ-008). Drives the built static app in a real
 * browser over the MVP validation scenarios and the real MapLibre map. Browsers
 * are provided by the environment (PLAYWRIGHT_BROWSERS_PATH); this config does
 * not download them. Run with `pnpm run e2e`. Promoting this to a required CI
 * gate is a recorded follow-up (SPEC-003 assumption A-3).
 */
export default defineConfig({
  testDir: './test/e2e',
  testMatch: /.*\.e2e\.ts/,
  // Serial: the tests share one preview server and a software-WebGL context;
  // running them in parallel just starves first map paint.
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Desktop Chrome'],
    // WebGL (for MapLibre) via SwiftShader so the map renders headless. When the
    // environment provides a prebuilt browser, point at it with PW_CHROMIUM_PATH
    // instead of `playwright install`.
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      ...(process.env['PW_CHROMIUM_PATH']
        ? { executablePath: process.env['PW_CHROMIUM_PATH'] }
        : {}),
    },
  },
  webServer: {
    command: 'pnpm run build && pnpm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
