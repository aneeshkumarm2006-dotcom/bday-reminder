import { defineConfig } from "@playwright/test";

/**
 * End-to-end suites: the analytics-hub visual pass and the /seoteam admin panel.
 *
 * Starts the dev server (cookies are non-Secure in dev so http localhost
 * authenticates) with the secrets the proxy + hub need; the specs mint a valid
 * session cookie and stub external APIs with canned data.
 *
 * `MONGODB_URI` is forwarded when it's set but never required: `admin.spec.ts`
 * asserts the *no-database* behaviour (defaults render, admin shows its empty
 * states), and `admin-content.spec.ts` skips itself unless a database is
 * available. Run: `npx playwright install chromium && npm run e2e`.
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
      // An empty string keeps `isDbConfigured()` false, which is exactly what
      // the no-database admin assertions need.
      MONGODB_URI: process.env.MONGODB_URI ?? "",
    },
  },
});
