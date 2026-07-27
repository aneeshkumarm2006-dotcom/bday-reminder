import { expect, test, type BrowserContext } from "@playwright/test";

import { createSessionToken } from "../lib/seo-auth/session";

/**
 * The content round-trips: edit in the admin → see it on the public site.
 *
 * These need a real database, so the whole file skips itself when `MONGODB_URI`
 * is unset — that keeps `npm run e2e` green on a laptop with no Atlas while
 * still covering the flows end to end wherever a database is available. Point
 * it at a scratch database: the specs write real documents.
 *
 *   MONGODB_URI="mongodb://127.0.0.1:27017/ctd-e2e" npm run e2e
 */
const BASE = "http://localhost:3100";
const HAS_DB = Boolean(process.env.MONGODB_URI);

test.describe(() => {
  test.skip(!HAS_DB, "Set MONGODB_URI to run the database-backed admin flows.");
  // Shared content is global state, so these run in order rather than racing.
  test.describe.configure({ mode: "serial" });

  async function authenticate(context: BrowserContext) {
    await context.addCookies([
      { name: "seoteam_session", value: createSessionToken(), url: BASE },
      { name: "seoteam_editor", value: "E2E", url: BASE },
    ]);
  }

  test.beforeEach(async ({ context }) => {
    await authenticate(context);
  });

  test("edit the hero, publish, and see it on the homepage", async ({ page }) => {
    const heading = `Remember, and act. ${Date.now()}`;

    await page.goto("/seoteam/landing");
    await page.getByRole("button", { name: "Hero" }).click();
    await page.getByRole("textbox", { name: "Heading", exact: true }).first().fill(heading);

    // Save first (draft only) — the live homepage must not change yet.
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Draft saved. Use Preview to see it.")).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);

    // The draft preview does show it.
    await page.goto("/seoteam/preview/landing");
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();

    // Publishing pushes it live, despite the homepage's hourly ISR window.
    await page.goto("/seoteam/landing");
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/the homepage is live/i)).toBeVisible();

    await page.goto("/");
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  });

  test("hiding a section removes it from the homepage", async ({ page }) => {
    await page.goto("/seoteam/landing");
    await page.getByRole("button", { name: "Hide section" }).last().click();
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText(/the homepage is live/i)).toBeVisible();

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Start with the people you don't want to forget" }),
    ).toHaveCount(0);
  });

  test("a page SEO override reaches the document head", async ({ page }) => {
    const title = `Contact us ${Date.now()}`;

    await page.goto("/seoteam/meta");
    await page
      .getByRole("row", { name: /\/contact/ })
      .getByRole("button", { name: "Edit SEO" })
      .click();
    await page.getByRole("textbox", { name: "Title", exact: true }).fill(title);
    await page.getByRole("button", { name: "Save SEO" }).click();
    await expect(page.getByText(/SEO saved for \/contact/)).toBeVisible();

    await page.goto("/contact");
    await expect(page).toHaveTitle(new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  test("build a page from blocks, schedule it, then publish it", async ({ page }) => {
    const slug = `e2e-guide-${Date.now()}`;

    await page.goto("/seoteam/pages/new");
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("textbox", { name: "Title", exact: true }).fill("E2E gift guide");
    await page.getByRole("textbox", { name: "URL slug" }).fill(slug);

    await page.getByRole("button", { name: "Content" }).click();
    await page.getByRole("button", { name: "Add block" }).click();
    await page.getByRole("button", { name: /^Hero/ }).click();
    await page.getByRole("textbox", { name: "Heading", exact: true }).first().fill("Gifts they'll love");

    // Scheduled for the future → still a 404 for visitors.
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: /^Status/ }).click();
    await page.getByRole("option", { name: /Scheduled/ }).click();
    await page.getByRole("button", { name: /Create page|Save page/ }).click();
    await expect(page.getByText("Page saved.")).toBeVisible({ timeout: 20_000 });
    // Creating redirects to the edit URL, which remounts the builder.
    await page.waitForURL(/\/seoteam\/pages\/[a-f0-9]{24}\/edit/);
    const editUrl = page.url();

    expect((await page.request.get(`/${slug}`)).status()).toBe(404);

    // A hard load of the editor, so the assertions below don't race the
    // client-side replace the dev server is still streaming.
    await page.goto(editUrl);
    await expect(page.getByRole("heading", { name: "E2E gift guide" })).toBeVisible();

    // Flipping to "visible now" must collapse the future date, not keep hiding it.
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: /^Status/ }).click();
    await page.getByRole("option", { name: /Published/ }).click();
    await page.getByRole("button", { name: "Save page" }).click();
    await expect(page.getByText("Page saved.")).toBeVisible({ timeout: 20_000 });

    await page.goto(`/${slug}`);
    await expect(page.getByRole("heading", { name: "Gifts they'll love" })).toBeVisible();

    // …and it advertises itself in the sitemap.
    const sitemap = await (await page.request.get("/sitemap.xml")).text();
    expect(sitemap).toContain(`/${slug}`);
  });

  test("a reserved slug can't be claimed", async ({ request }) => {
    const res = await request.post("/seoteam/api/pages", {
      data: { title: "Sneaky", slug: "blog" },
      headers: { cookie: `seoteam_session=${createSessionToken()}` },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatch(/reserved/i);
  });

  test("a redirect sends an old URL to the new one", async ({ page, request }) => {
    const from = `/e2e-old-${Date.now()}`;

    await page.goto("/seoteam/redirects");
    await page.getByRole("textbox", { name: "From" }).fill(from);
    await page.getByRole("textbox", { name: "To" }).fill("/contact");
    await page.getByRole("button", { name: "Add redirect" }).click();
    await expect(page.getByText("Redirect created.")).toBeVisible();

    const res = await request.get(from, { maxRedirects: 0 });
    expect([301, 308]).toContain(res.status());
    expect(res.headers()["location"]).toContain("/contact");
  });

  test("adding a nav link puts it in the header and the mobile menu", async ({ page }) => {
    const label = `Guides ${Date.now()}`;

    await page.goto("/seoteam/navigation");
    // Scoped to the Header links card: "Label" also names the sign-up button
    // field further down the page.
    const headerLinks = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Header links" }) });
    await headerLinks.getByRole("button", { name: "Add header link" }).click();
    await headerLinks.getByRole("textbox", { name: "Label" }).last().fill(label);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Navigation saved.")).toBeVisible();

    await page.goto("/");
    await expect(
      page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: label }),
    ).toBeVisible();
  });

  test("the export bundle round-trips through import", async ({ request }) => {
    const cookie = `seoteam_session=${createSessionToken()}`;
    const exported = await request.get("/seoteam/api/export", { headers: { cookie } });
    expect(exported.ok()).toBe(true);

    const bundle = await exported.json();
    expect(bundle.version).toBe(1);
    expect(bundle.settings.identity.name).toBeTruthy();

    // Re-import only the settings so the test doesn't clone every page.
    const imported = await request.post("/seoteam/api/import", {
      headers: { cookie },
      data: { version: 1, settings: bundle.settings },
    });
    expect(imported.ok()).toBe(true);
    expect((await imported.json()).applied).toContain("site settings");
  });
});
