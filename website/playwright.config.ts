import { defineConfig } from "@playwright/test";

/**
 * Analytics-hub visual e2e. Starts the dev server (cookies are non-Secure in dev
 * so http localhost authenticates) with the secrets the proxy + hub need; the
 * spec mints a valid session cookie and stubs the catch-all API with canned data
 * to screenshot every state. Run: `npx playwright install chromium && npm run e2e`.
 */
const PORT = 3100;
const SESSION_SECRET = "analyticshub-e2e-session-secret-32chars-min";

// Share the session secret with the spec process so its minted cookie verifies.
process.env.SESSION_SECRET = SESSION_SECRET;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: `next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/analyticshub/setup`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      SESSION_SECRET,
      SEO_DASHBOARD_PASSWORD: "e2e-password",
      ANALYTICSHUB_SECRET_KEY: Buffer.alloc(32, 5).toString("base64"),
    },
  },
});
