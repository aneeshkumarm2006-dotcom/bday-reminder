import { mkdirSync } from "node:fs";

import { test, type BrowserContext, type Page } from "@playwright/test";

import { createSessionToken } from "../lib/seo-auth/session";
import {
  buildAll,
  notConnected,
  okStatus,
  partialStatus,
  sourceResponse,
  wizardStatus,
} from "./fixtures";

const DIR = "e2e/screenshots";
mkdirSync(DIR, { recursive: true });
const BASE = "http://localhost:3100";

async function authenticate(context: BrowserContext) {
  await context.addCookies([{ name: "seoteam_session", value: createSessionToken(), url: BASE }]);
}

async function stubStatus(page: Page, status: unknown) {
  await page.route("**/analyticshub/api/status", (r) => r.fulfill({ json: status as object }));
  await page.route("**/analyticshub/api/google/options", (r) =>
    r.fulfill({ json: { mode: null, selection: {}, properties: [], sites: [] } }),
  );
}

test.beforeEach(async ({ context }) => {
  await authenticate(context);
});

test("overview with data", async ({ page }) => {
  await stubStatus(page, okStatus());
  await page.route("**/analyticshub/api/data/all**", (r) => r.fulfill({ json: buildAll() }));
  await page.goto("/analyticshub");
  await page.getByText("New signups").first().waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/overview-data.png`, fullPage: true });
});

test("source page (analytics)", async ({ page }) => {
  await stubStatus(page, okStatus());
  await page.route("**/analyticshub/api/data/ga4**", (r) => r.fulfill({ json: sourceResponse("ga4") }));
  await page.goto("/analyticshub/analytics");
  await page.getByRole("heading", { name: "Analytics" }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/source-ga4.png`, fullPage: true });
});

test("not connected", async ({ page }) => {
  await stubStatus(page, partialStatus());
  await page.route("**/analyticshub/api/data/ga4**", (r) => r.fulfill({ json: notConnected("ga4") }));
  await page.goto("/analyticshub/analytics");
  await page.getByText("Connect in settings").waitFor();
  await page.screenshot({ path: `${DIR}/not-connected.png`, fullPage: true });
});

test("settings", async ({ page }) => {
  await stubStatus(page, partialStatus());
  await page.goto("/analyticshub/settings");
  await page.getByRole("heading", { name: "Settings" }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/settings.png`, fullPage: true });
});

test("first-run wizard", async ({ page }) => {
  await stubStatus(page, wizardStatus());
  await page.goto("/analyticshub");
  await page.getByText("Set up your analytics hub").waitFor();
  await page.screenshot({ path: `${DIR}/wizard.png`, fullPage: true });
});

test("mobile overview", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stubStatus(page, okStatus());
  await page.route("**/analyticshub/api/data/all**", (r) => r.fulfill({ json: buildAll() }));
  await page.goto("/analyticshub");
  await page.getByText("New signups").first().waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/overview-mobile.png`, fullPage: true });
});
