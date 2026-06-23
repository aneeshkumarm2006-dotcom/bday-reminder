import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E config (TODO Stage 13). Drives the exported web app against an
 * ephemeral in-memory backend — no Atlas, no external services. Two web servers
 * boot automatically:
 *   1. backend  → `npm run dev:memory` (in-memory Mongo + dev reminder triggers) on :4040
 *   2. web app  → `npm run serve:dist` (the static Expo web export)            on :8081
 *
 * The app's API base URL is baked into the export at build time and defaults to
 * http://localhost:4040, matching the dev backend. Run `npm run build:app` (or
 * `npm run test:ci`) first so `app/dist` exists. Browser: `npm run install:browsers`.
 */
const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4040';
const APP_URL = process.env.E2E_APP_URL ?? 'http://localhost:8081';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: APP_URL,
    // Pin the browser to UTC so the app's device-local "today" matches the
    // UTC-timezone test user the backend resolves reminders against.
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm --prefix ../backend run dev:memory',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
    },
    {
      command: 'npm --prefix ../app run serve:dist',
      url: APP_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'pipe',
    },
  ],
});
