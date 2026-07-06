import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Unit tests for the analytics hub's pure logic (crypto, dates, scale, colors,
 * URL dispatch). jsdom environment + the `@/*` path alias so tests import the
 * same modules the app does. Playwright e2e lives separately (playwright.config).
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    include: ["lib/analyticshub/__tests__/**/*.test.ts"],
    globals: true,
  },
});
