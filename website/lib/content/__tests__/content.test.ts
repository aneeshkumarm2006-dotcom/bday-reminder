import { describe, expect, it } from "vitest";

import { sanitizePostHtml } from "@/lib/blog/sanitize";

import { blockTitle, BLOCK_BY_TYPE, BLOCK_DEFINITIONS } from "../blocks";
import { DEFAULT_LANDING, DEFAULT_SETTINGS, emptyPageMeta } from "../defaults";
import { ICON_NAMES, isKnownIcon } from "../icons";
import { analyzePageSeo, seoVerdict } from "../page-seo";
import { buildPageMetadata } from "../metadata";
import { derivePageVisibility, isAnnouncementLive } from "../schedule";
import { buildSiteJsonLd, structuredDataWarnings } from "../site-json-ld";
import type { PageBlock } from "../types";
import { pageBlockSchema } from "../validation";

describe("landing defaults", () => {
  it("renders every section by default", () => {
    expect(DEFAULT_LANDING.sections.every((s) => s.visible)).toBe(true);
  });

  it("has unique section ids", () => {
    const ids = DEFAULT_LANDING.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only references icons that exist in the registry", () => {
    for (const section of DEFAULT_LANDING.sections) {
      if (section.type !== "features") continue;
      for (const row of section.rows) expect(isKnownIcon(row.icon)).toBe(true);
      for (const card of section.cards) expect(isKnownIcon(card.icon)).toBe(true);
    }
  });

  it("keeps the FAQ list as the single source for the accordion and the schema", () => {
    const faq = DEFAULT_LANDING.sections.find((s) => s.type === "faq");
    expect(faq && faq.type === "faq" && faq.items.length).toBe(8);
  });
});

describe("announcement scheduling", () => {
  const base = { ...DEFAULT_SETTINGS.announcement, enabled: true, text: "Hello" };
  const now = Date.parse("2026-08-01T12:00:00.000Z");

  it("is hidden when disabled or empty", () => {
    expect(isAnnouncementLive({ ...base, enabled: false }, now)).toBe(false);
    expect(isAnnouncementLive({ ...base, text: "  " }, now)).toBe(false);
  });

  it("is visible with no bounds", () => {
    expect(isAnnouncementLive(base, now)).toBe(true);
  });

  it("respects the start and end bounds", () => {
    expect(isAnnouncementLive({ ...base, startAt: "2026-08-02T00:00:00Z" }, now)).toBe(false);
    expect(isAnnouncementLive({ ...base, startAt: "2026-07-01T00:00:00Z" }, now)).toBe(true);
    expect(isAnnouncementLive({ ...base, endAt: "2026-07-31T00:00:00Z" }, now)).toBe(false);
    expect(isAnnouncementLive({ ...base, endAt: "2026-08-31T00:00:00Z" }, now)).toBe(true);
  });

  it("ignores an unparseable bound rather than hiding the bar", () => {
    expect(isAnnouncementLive({ ...base, startAt: "not a date" }, now)).toBe(true);
  });
});

describe("page visibility", () => {
  const now = Date.parse("2026-08-01T12:00:00.000Z");

  it("treats a future publishedAt as scheduled", () => {
    expect(derivePageVisibility("published", "2026-08-02T09:00:00Z", now)).toBe("scheduled");
  });

  it("treats a past publishedAt as published", () => {
    expect(derivePageVisibility("published", "2026-07-01T09:00:00Z", now)).toBe("published");
  });

  it("treats a published page with no date as published", () => {
    expect(derivePageVisibility("published", null, now)).toBe("published");
  });

  it("keeps a draft a draft whatever the date says", () => {
    expect(derivePageVisibility("draft", "2020-01-01T00:00:00Z", now)).toBe("draft");
  });
});

describe("page SEO checks", () => {
  it("flags a noindex page that's still in the sitemap", () => {
    const analysis = analyzePageSeo({
      ...emptyPageMeta("/x"),
      title: "A perfectly reasonable title of sixty characters or so ok",
      description: "d".repeat(155),
      noindex: true,
    });
    const check = analysis.checks.find((c) => c.id === "index-sitemap-agreement");
    expect(check?.status).toBe("fail");
    expect(analysis.ready).toBe(false);
  });

  it("passes when noindex and sitemap exclusion agree", () => {
    const analysis = analyzePageSeo({
      ...emptyPageMeta("/x"),
      title: "A perfectly reasonable title of sixty characters or so ok",
      description: "d".repeat(155),
      noindex: true,
      sitemap: { exclude: true, changeFrequency: "monthly", priority: 0.5 },
    });
    expect(
      analysis.checks.find((c) => c.id === "index-sitemap-agreement")?.status,
    ).toBe("pass");
  });

  it("reports a verdict that matches the counts", () => {
    const healthy = analyzePageSeo({
      ...emptyPageMeta("/x"),
      title: "A perfectly reasonable title of sixty characters or so ok",
      description: "d".repeat(155),
      canonical: "/x",
      ogTitle: "Share title",
    });
    expect(seoVerdict(healthy)).toEqual({ label: "Healthy", tone: "pass" });
  });

  it("fails a page with no content blocks", () => {
    const analysis = analyzePageSeo(emptyPageMeta("/x"), { hasContent: false });
    expect(analysis.checks.some((c) => c.id === "has-content")).toBe(true);
    expect(analysis.ready).toBe(false);
  });
});

describe("buildPageMetadata", () => {
  it("omits empty fields so the layout's defaults survive", () => {
    const meta = buildPageMetadata(emptyPageMeta("/x"), DEFAULT_SETTINGS);
    expect(meta.title).toBeUndefined();
    expect(meta.description).toBeUndefined();
    expect(meta.alternates?.canonical).toBe("/x");
  });

  it("uses an absolute title only when asked", () => {
    const page = { ...emptyPageMeta("/"), title: "Exact title" };
    expect(buildPageMetadata(page, DEFAULT_SETTINGS).title).toBe("Exact title");
    expect(
      buildPageMetadata(page, DEFAULT_SETTINGS, { absoluteTitle: true }).title,
    ).toEqual({ absolute: "Exact title" });
  });

  it("cascades page title into the OG and Twitter cards", () => {
    const meta = buildPageMetadata(
      { ...emptyPageMeta("/x"), title: "T", description: "D" },
      DEFAULT_SETTINGS,
    );
    expect(meta.openGraph?.title).toBe("T");
    expect(meta.twitter?.title).toBe("T");
    expect(meta.twitter?.description).toBe("D");
  });

  it("lets the sitewide kill-switch override a page that wants indexing", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      seo: { ...DEFAULT_SETTINGS.seo, indexingEnabled: false },
    };
    const meta = buildPageMetadata(emptyPageMeta("/x"), settings);
    expect(meta.robots).toMatchObject({ index: false, follow: false });
  });

  it("honours a per-page noindex while the site is indexable", () => {
    const meta = buildPageMetadata(
      { ...emptyPageMeta("/x"), noindex: true },
      DEFAULT_SETTINGS,
    );
    expect(meta.robots).toMatchObject({ index: false, follow: true });
  });
});

describe("site JSON-LD", () => {
  it("emits Organization, WebSite and WebApplication by default", () => {
    const graph = buildSiteJsonLd(DEFAULT_SETTINGS)["@graph"] as Record<string, unknown>[];
    expect(graph.map((n) => n["@type"])).toEqual([
      "Organization",
      "WebSite",
      "WebApplication",
    ]);
  });

  it("omits a disabled node entirely rather than emitting an empty one", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      structuredData: {
        ...DEFAULT_SETTINGS.structuredData,
        organization: { ...DEFAULT_SETTINGS.structuredData.organization, enabled: false },
      },
    };
    const graph = buildSiteJsonLd(settings)["@graph"] as Record<string, unknown>[];
    expect(graph.some((n) => n["@type"] === "Organization")).toBe(false);
    // …and the WebSite stops claiming a publisher that isn't there.
    expect(graph.find((n) => n["@type"] === "WebSite")?.publisher).toBeUndefined();
  });

  it("builds sameAs from the social profiles, in order", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      socials: [
        { id: "b", platform: "X", url: "https://x.com/ctd", order: 1 },
        { id: "a", platform: "Instagram", url: "https://instagram.com/ctd", order: 0 },
      ],
    };
    const graph = buildSiteJsonLd(settings)["@graph"] as Record<string, unknown>[];
    expect(graph.find((n) => n["@type"] === "Organization")?.sameAs).toEqual([
      "https://instagram.com/ctd",
      "https://x.com/ctd",
    ]);
  });

  it("warns when nothing at all would be emitted", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      structuredData: {
        organization: { ...DEFAULT_SETTINGS.structuredData.organization, enabled: false },
        website: { ...DEFAULT_SETTINGS.structuredData.website, enabled: false },
        softwareApplication: {
          ...DEFAULT_SETTINGS.structuredData.softwareApplication,
          enabled: false,
        },
      },
    };
    expect(structuredDataWarnings(settings)).toContain(
      "No structured data is being emitted at all.",
    );
  });
});

describe("page blocks", () => {
  it("mints a schema-valid block for every palette entry", () => {
    for (const definition of BLOCK_DEFINITIONS) {
      const block = definition.create(`${definition.type}-1`);
      const result = pageBlockSchema.safeParse(block);
      expect(result.success, `${definition.type} should validate`).toBe(true);
      expect(BLOCK_BY_TYPE[definition.type]).toBe(definition);
    }
  });

  it("labels a rich-text block from its text, not its markup", () => {
    const block: PageBlock = {
      id: "r1",
      type: "richText",
      html: "<p>Hello <strong>world</strong></p>",
    };
    expect(blockTitle(block)).toBe("Hello world");
  });

  it("strips scripts and iframes from rich text on save", () => {
    const dirty = '<p>ok</p><script>alert(1)</script><iframe src="https://x"></iframe>';
    const clean = sanitizePostHtml(dirty);
    expect(clean).toBe("<p>ok</p>");
  });
});

describe("icon registry", () => {
  it("exposes a non-empty, de-duplicated allowlist", () => {
    expect(ICON_NAMES.length).toBeGreaterThan(10);
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });

  it("rejects names it doesn't know", () => {
    expect(isKnownIcon("Bell")).toBe(true);
    expect(isKnownIcon("DefinitelyNotAnIcon")).toBe(false);
  });
});
