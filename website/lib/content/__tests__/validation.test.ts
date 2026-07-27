import { describe, expect, it } from "vitest";

import { isReservedSlug, RESERVED_SLUGS } from "../reserved-slugs";
import {
  createSitePageSchema,
  navigationSchema,
  normalizePath,
  pageMetaSchema,
  redirectSchema,
  saveLandingSchema,
  siteSettingsSchema,
  validateJsonLd,
} from "../validation";

describe("normalizePath", () => {
  it("adds a leading slash and strips a trailing one", () => {
    expect(normalizePath("about")).toBe("/about");
    expect(normalizePath("/about/")).toBe("/about");
    expect(normalizePath("  /about/  ")).toBe("/about");
  });

  it("collapses repeated slashes", () => {
    expect(normalizePath("//a//b//")).toBe("/a/b");
  });

  it("keeps the root as a bare slash", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("")).toBe("/");
  });
});

describe("reserved slugs", () => {
  it("rejects every existing top-level route", () => {
    for (const slug of RESERVED_SLUGS) expect(isReservedSlug(slug)).toBe(true);
  });

  it("rejects an empty slug", () => {
    expect(isReservedSlug("")).toBe(true);
    expect(isReservedSlug("   ")).toBe(true);
  });

  it("judges a nested slug by its first segment", () => {
    expect(isReservedSlug("blog/anything")).toBe(true);
    expect(isReservedSlug("gift-guide/2026")).toBe(false);
  });

  it("is case- and slash-insensitive", () => {
    expect(isReservedSlug("/BLOG/")).toBe(true);
  });

  it("allows an ordinary marketing slug", () => {
    expect(isReservedSlug("gift-guide")).toBe(false);
  });

  it("is enforced by the page schema, not just the UI", () => {
    const result = createSitePageSchema.safeParse({ title: "Blog", slug: "blog" });
    expect(result.success).toBe(false);
  });
});

describe("site settings schema", () => {
  it("fills every field from an empty object", () => {
    const parsed = siteSettingsSchema.parse({});
    expect(parsed.seo.indexingEnabled).toBe(true);
    expect(parsed.analytics.ga4MeasurementId).toBe("");
    expect(parsed.socials).toEqual([]);
  });

  it("requires %s in the title template", () => {
    expect(
      siteSettingsSchema.safeParse({ seo: { titleTemplate: "no placeholder" } }).success,
    ).toBe(false);
    expect(
      siteSettingsSchema.safeParse({ seo: { titleTemplate: "%s · Site" } }).success,
    ).toBe(true);
  });

  it("rejects analytics IDs that aren't shaped like IDs", () => {
    expect(
      siteSettingsSchema.safeParse({ analytics: { ga4MeasurementId: "<script>" } }).success,
    ).toBe(false);
    expect(
      siteSettingsSchema.safeParse({ analytics: { gtmContainerId: "'; alert(1);'" } })
        .success,
    ).toBe(false);
    expect(
      siteSettingsSchema.safeParse({ analytics: { metaPixelId: "not-a-number" } }).success,
    ).toBe(false);
  });

  it("accepts well-formed analytics IDs", () => {
    const parsed = siteSettingsSchema.parse({
      analytics: {
        ga4MeasurementId: "G-ABC123",
        gtmContainerId: "GTM-XYZ789",
        metaPixelId: "123456789012",
      },
    });
    expect(parsed.analytics.ga4MeasurementId).toBe("G-ABC123");
  });

  it("normalizes extra robots disallow paths", () => {
    const parsed = siteSettingsSchema.parse({ robotsExtraDisallows: ["private/"] });
    expect(parsed.robotsExtraDisallows).toEqual(["/private"]);
  });
});

describe("link and redirect targets", () => {
  it("rejects javascript: and data: hrefs on nav links", () => {
    const bad = navigationSchema.safeParse({
      header: {
        links: [
          { id: "a", label: "Bad", href: "javascript:alert(1)", order: 0, visible: true, external: false },
        ],
      },
    });
    expect(bad.success).toBe(false);
  });

  it("accepts internal paths, anchors, mailto and https", () => {
    const good = navigationSchema.safeParse({
      header: {
        links: [
          { id: "a", label: "Features", href: "/#features", order: 0, visible: true, external: false },
          { id: "b", label: "Mail", href: "mailto:hi@example.com", order: 1, visible: true, external: false },
          { id: "c", label: "Docs", href: "https://example.com", order: 2, visible: true, external: true },
        ],
      },
    });
    expect(good.success).toBe(true);
  });

  it("only allows internal paths or https for redirect targets", () => {
    expect(redirectSchema.safeParse({ from: "/a", to: "javascript:alert(1)" }).success).toBe(
      false,
    );
    expect(redirectSchema.safeParse({ from: "/a", to: "http://example.com" }).success).toBe(
      false,
    );
    expect(redirectSchema.safeParse({ from: "/a", to: "https://example.com" }).success).toBe(
      true,
    );
    expect(redirectSchema.safeParse({ from: "/a", to: "/b" }).success).toBe(true);
  });

  it("rejects a redirect that points at itself", () => {
    expect(redirectSchema.safeParse({ from: "/a", to: "/a" }).success).toBe(false);
    // …including when only the trailing slash differs.
    expect(redirectSchema.safeParse({ from: "a/", to: "/a" }).success).toBe(false);
  });
});

describe("page meta schema", () => {
  it("normalizes the path and defaults the sitemap block", () => {
    const parsed = pageMetaSchema.parse({ path: "contact/" });
    expect(parsed.path).toBe("/contact");
    expect(parsed.sitemap).toEqual({
      exclude: false,
      changeFrequency: "monthly",
      priority: 0.5,
    });
  });

  it("rejects an out-of-range sitemap priority", () => {
    expect(
      pageMetaSchema.safeParse({ path: "/", sitemap: { priority: 5 } }).success,
    ).toBe(false);
  });
});

describe("validateJsonLd", () => {
  it("accepts an empty value", () => {
    expect(validateJsonLd("").ok).toBe(true);
    expect(validateJsonLd("   ").ok).toBe(true);
  });

  it("rejects malformed JSON", () => {
    expect(validateJsonLd("{ nope }").ok).toBe(false);
  });

  it("accepts an allowlisted @type", () => {
    expect(validateJsonLd('{"@type":"FAQPage"}').ok).toBe(true);
  });

  it("rejects a type outside the allowlist, however deeply nested", () => {
    const result = validateJsonLd(
      '{"@type":"WebPage","mainEntity":{"@type":"EvilThing"}}',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("EvilThing");
  });

  it("rejects an oversized payload", () => {
    expect(validateJsonLd(`{"@type":"WebPage","x":"${"a".repeat(20_001)}"}`).ok).toBe(false);
  });

  it("is enforced by the page meta schema", () => {
    expect(
      pageMetaSchema.safeParse({ path: "/", customJsonLd: '{"@type":"Nope"}' }).success,
    ).toBe(false);
  });
});

describe("landing schema", () => {
  it("accepts a minimal hero section and fills the rest", () => {
    const parsed = saveLandingSchema.parse({
      sections: [{ id: "hero", type: "hero" }],
      mode: "draft",
    });
    expect(parsed.sections).toHaveLength(1);
    const [hero] = parsed.sections;
    if (hero.type !== "hero") throw new Error("expected the hero section");
    expect(hero.visible).toBe(true);
    expect(hero.primaryCta).toEqual({ label: "", href: "/" });
  });

  it("rejects an unknown section type", () => {
    expect(
      saveLandingSchema.safeParse({ sections: [{ id: "x", type: "carousel" }] }).success,
    ).toBe(false);
  });

  it("rejects an icon outside the curated registry", () => {
    const result = saveLandingSchema.safeParse({
      sections: [
        {
          id: "features",
          type: "features",
          cards: [{ id: "c1", icon: "NotARealIcon", title: "x", body: "y" }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("defaults the save mode to draft so publishing is always explicit", () => {
    expect(saveLandingSchema.parse({ sections: [] }).mode).toBe("draft");
  });
});
