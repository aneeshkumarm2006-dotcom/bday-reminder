import { describe, expect, it } from "vitest";

import {
  APP_NAME_FAQ,
  APP_STORE_URL,
  CLARITY_PROJECT_ID,
  GOOGLE_PLAY_URL,
  HERO_COPY,
  HOME_META,
  migrateHomeMeta,
  migrateLandingSections,
  migrateNavigation,
  migrateSeoPageContent,
  migrateSiteSettings,
} from "../migrations/redesign-2026-11";

/** Shaped like what the admin saved before the redesign. */
const storedSettings = {
  key: "singleton",
  appStores: {
    appStore: { enabled: false, url: "", label: "App Store", eyebrow: "Download on the" },
    googlePlay: { enabled: false, url: "", label: "Google Play", eyebrow: "Get it on" },
  },
  analytics: { ga4MeasurementId: "G-SFK13RXJQR", gtmContainerId: "", metaPixelId: "" },
  identity: { name: "Birthday Reminders" },
};

const storedNav = {
  key: "singleton",
  header: {
    links: [
      { id: "header-1", label: "Features", href: "/#features", order: 0, visible: true, external: false },
      { id: "header-2", label: "How it works", href: "/#how", order: 1, visible: true, external: false },
      { id: "header-3", label: "Coming soon", href: "/#get-the-app", order: 2, visible: true, external: false },
      { id: "custom", label: "Pricing", href: "/pricing", order: 3, visible: true, external: false },
    ],
    ctas: { show: true, signupLabel: "Coming soon", signupHref: "", loginLabel: "Log in" },
  },
  footer: { groups: [] },
};

const storedSections = [
  {
    id: "hero",
    type: "hero",
    visible: true,
    badge: "Free birthday & event reminders",
    heading: "Remember, and act.",
    subheading: "Old copy",
    primaryCta: { label: "Start for free", href: "/signup" },
    secondaryCta: { label: "Log in", href: "/login" },
    footnote: "Free on web, iOS, and Android. No ads, no paid tier.",
  },
  { id: "value-prop", type: "valueProp", visible: true, body: "Untouched" },
  {
    id: "faq",
    type: "faq",
    visible: true,
    items: [{ id: "faq-1", q: "What is a birthday reminder app?", a: "…" }],
  },
  {
    id: "get-the-app",
    type: "getTheApp",
    visible: true,
    heading: "Start with the people you don't want to forget",
    body: "Free forever. Use it on the web right now, or get it on your phone for reminders and the home-screen widget.",
    ctaLabel: "Start for free",
    ctaHref: "/signup",
    storeBadges: true,
    footnote: "Mobile apps coming soon.",
  },
];

describe("redesign migration: site settings", () => {
  it("turns both stores on with the live URLs and sets Clarity", () => {
    const { next, changes } = migrateSiteSettings(storedSettings);
    const stores = next.appStores as Record<string, Record<string, unknown>>;
    expect(stores.appStore).toMatchObject({ enabled: true, url: APP_STORE_URL });
    expect(stores.googlePlay).toMatchObject({ enabled: true, url: GOOGLE_PLAY_URL, eyebrow: "Get it on" });
    expect((next.analytics as Record<string, unknown>).clarityProjectId).toBe(CLARITY_PROJECT_ID);
    expect((next.analytics as Record<string, unknown>).ga4MeasurementId).toBe("G-SFK13RXJQR");
    expect(changes).toHaveLength(3);
  });

  it("keeps a store URL or Clarity ID an editor already set", () => {
    const { next, changes } = migrateSiteSettings({
      appStores: { appStore: { enabled: true, url: "https://apps.apple.com/x" }, googlePlay: { enabled: true, url: "https://play.google.com/y" } },
      analytics: { clarityProjectId: "other123" },
    });
    expect((next.appStores as Record<string, Record<string, unknown>>).appStore.url).toBe("https://apps.apple.com/x");
    expect((next.analytics as Record<string, unknown>).clarityProjectId).toBe("other123");
    expect(changes).toEqual([]);
  });

  it("does not mutate its input", () => {
    const copy = JSON.parse(JSON.stringify(storedSettings));
    migrateSiteSettings(storedSettings);
    expect(storedSettings).toEqual(copy);
  });
});

describe("redesign migration: navigation", () => {
  it("drops Coming soon, adds the new links in order, keeps custom links last", () => {
    const { next } = migrateNavigation(storedNav);
    const header = next.header as { links: Record<string, unknown>[]; ctas: Record<string, unknown> };
    expect(header.links.map((l) => l.label)).toEqual([
      "Features",
      "Screenshots",
      "How it works",
      "FAQ",
      "Blog",
      "Pricing",
    ]);
    expect(header.links.map((l) => l.order)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(header.ctas).toMatchObject({ signupLabel: "Get the app", signupHref: "/#get-the-app", loginLabel: "Log in" });
  });

  it("is idempotent", () => {
    const once = migrateNavigation(storedNav).next;
    const twice = migrateNavigation(once);
    expect(twice.next).toEqual(once);
    expect(twice.changes).toEqual([]);
  });
});

describe("redesign migration: landing sections", () => {
  it("rewrites the hero, adds the app-name FAQ, and fixes Get the app", () => {
    const { next } = migrateLandingSections(storedSections);
    const [hero, valueProp, faq, cta] = next as Record<string, unknown>[];
    expect(hero).toMatchObject({
      heading: HERO_COPY.heading,
      badge: HERO_COPY.badge,
      storeLead: HERO_COPY.storeLead,
      showAppScreens: true,
      primaryCta: { label: "Start free on the web", href: "/signup" },
      secondaryCta: { label: "", href: "/login" },
    });
    expect(valueProp).toEqual(storedSections[1]);
    expect((faq.items as unknown[]).at(-1)).toEqual(APP_NAME_FAQ);
    expect(cta).toMatchObject({ footnote: "", ctaLabel: "Start free on the web", storeBadges: true });
    expect(String(cta.body)).toContain("Circle the date");
  });

  it("is idempotent", () => {
    const once = migrateLandingSections(storedSections).next;
    const twice = migrateLandingSections(once);
    expect(twice.next).toEqual(once);
    expect(twice.changes).toEqual([]);
  });
});

describe("redesign migration: homepage meta", () => {
  it("replaces the pipe-stuffed title and keeps other fields", () => {
    const { next, changes } = migrateHomeMeta({
      path: "/",
      title: "Birthday App | App For Birthdays | Birthday Reminders",
      description: "old",
      canonical: "/",
    });
    expect(next).toMatchObject({ path: "/", canonical: "/", ...HOME_META });
    expect(HOME_META.title.length).toBeLessThanOrEqual(60);
    expect(HOME_META.description.length).toBeGreaterThanOrEqual(140);
    expect(HOME_META.description.length).toBeLessThanOrEqual(160);
    expect(changes).toHaveLength(2);
    expect(migrateHomeMeta(next).changes).toEqual([]);
  });
});

describe("redesign migration: keyword pages", () => {
  it("clears a coming-soon footnote and leaves other fields alone", () => {
    const { next, changes } = migrateSeoPageContent({
      label: "Birthday tracker",
      cta: { heading: "x", footnote: "Mobile apps coming soon." },
    });
    expect(next).toEqual({ label: "Birthday tracker", cta: { heading: "x", footnote: "" } });
    expect(changes).toHaveLength(1);
  });
});
