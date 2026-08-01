import { expect, test, type BrowserContext } from "@playwright/test";

import { createSessionToken } from "../lib/seo-auth/session";

/**
 * Admin panel e2e that needs **no database**.
 *
 * That's the point: the regression this suite guards is the one that would hurt
 * most — the public site must render its built-in defaults, and every admin
 * screen must degrade to a clear empty state, when Mongo is absent or
 * unreachable. The content round-trips that do need a database live in
 * `admin-content.spec.ts`, which skips itself without `MONGODB_URI`.
 */
const BASE = "http://localhost:3100";

async function authenticate(context: BrowserContext) {
  await context.addCookies([
    { name: "seoteam_session", value: createSessionToken(), url: BASE },
  ]);
}

test.describe("access control", () => {
  test("an unauthenticated admin page redirects to the login screen", async ({ page }) => {
    await page.goto("/seoteam/site");
    await expect(page).toHaveURL(/\/seoteam\/login/);
    await expect(page.getByRole("heading", { name: "SEO team sign in" })).toBeVisible();
  });

  test("an unauthenticated admin API returns 401 JSON", async ({ request }) => {
    for (const path of [
      "/seoteam/api/site",
      "/seoteam/api/landing",
      "/seoteam/api/navigation",
      "/seoteam/api/pages",
      "/seoteam/api/redirects",
      "/seoteam/api/export",
    ]) {
      const res = await request.get(path);
      expect(res.status(), `${path} should be gated`).toBe(401);
    }
  });

  test("a mutating admin API is gated too", async ({ request }) => {
    const res = await request.put("/seoteam/api/site", { data: {} });
    expect(res.status()).toBe(401);
  });

  test("the admin subtree is tagged noindex at the HTTP layer", async ({ request }) => {
    const res = await request.get("/seoteam/login");
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
  });
});

test.describe("public site renders its defaults with no database", () => {
  test("the homepage shows every built-in section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Remember, and act." })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Everything you need to never forget" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Frequently asked questions" }),
    ).toBeVisible();
    // The FAQ accordion and its FAQPage schema come from one list.
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.join(" ")).toContain("FAQPage");
  });

  test("the header and footer render the default navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Features" }).first()).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "Privacy" }),
    ).toBeVisible();
  });

  test("the legal pages render their built-in copy", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What we store" })).toBeVisible();

    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of service" })).toBeVisible();

    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: "Contact" })).toBeVisible();
  });

  test("robots.txt allows crawling and points at the sitemap", async ({ request }) => {
    const body = await (await request.get("/robots.txt")).text();
    expect(body).toContain("Allow: /");
    expect(body).toContain("Disallow: /seoteam");
    expect(body).toContain("sitemap.xml");
  });

  test("llms.txt serves the site summary in the llmstxt.org shape", async ({
    request,
  }) => {
    // On by default now (lib/content/defaults.ts), so this serves even with no
    // database — the key pages come from STATIC_ROUTES, not from Mongo.
    const res = await request.get("/llms.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body.startsWith("# Birthday Reminders")).toBe(true);
    expect(body).toContain("\n> ");
    expect(body).toContain("## Key pages");
    // Every item in a section has to be a link, the contact address included.
    expect(body).toContain("](mailto:");
  });

  test("an unknown slug 404s rather than erroring", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-real-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("We couldn't find that page")).toBeVisible();
  });
});

test.describe("admin screens", () => {
  test.beforeEach(async ({ context }) => {
    await authenticate(context);
  });

  test("every section is reachable and explains the missing database", async ({ page }) => {
    const screens: [string, string][] = [
      ["/seoteam", "Overview"],
      ["/seoteam/site", "Site settings"],
      ["/seoteam/landing", "Landing page"],
      ["/seoteam/pages", "Pages"],
      ["/seoteam/meta", "Page SEO"],
      ["/seoteam/navigation", "Navigation"],
      ["/seoteam/redirects", "Redirects"],
      ["/seoteam/legal", "Legal & contact"],
      ["/seoteam/structured-data", "Structured data"],
      ["/seoteam/activity", "Activity"],
    ];
    for (const [path, heading] of screens) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      await expect(page.getByText("The database isn't connected.")).toBeVisible();
    }
  });

  test("the section nav marks the current screen", async ({ page }) => {
    await page.goto("/seoteam/redirects");
    const nav = page.getByRole("navigation", { name: "Admin sections" });
    await expect(nav.getByRole("link", { name: "Redirects" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("Ctrl+K opens the command palette and jumps to a screen", async ({ page }) => {
    await page.goto("/seoteam");
    await page.keyboard.press("Control+k");
    const search = page.getByRole("textbox", { name: "Search the admin" });
    await expect(search).toBeVisible();
    await search.fill("redirects");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/seoteam\/redirects/);
  });

  test("the login form offers the attribution name field", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/seoteam/login");
    await expect(page.getByLabel("Your name (optional)")).toBeVisible();
    // By role: the field shares its label with the show/hide toggle button.
    await expect(page.getByRole("textbox", { name: "Password" })).toBeVisible();
  });
});
