import { describe, expect, it } from "vitest";

import { siteConfig } from "@/lib/site";

import { DEFAULT_SETTINGS } from "../defaults";
import {
  APP_ID,
  LOGO_ID,
  ORG_ID,
  authorNode,
  buildSiteJsonLd,
  normalizeAuthorName,
  structuredDataWarnings,
} from "../site-json-ld";
import type { SiteSettings } from "../types";

function graphOf(settings: SiteSettings) {
  return buildSiteJsonLd(settings)["@graph"] as Record<string, unknown>[];
}

function nodeOfType(settings: SiteSettings, type: string) {
  return graphOf(settings).find((node) => node["@type"] === type);
}

describe("site JSON-LD", () => {
  it("emits Organization, its logo, WebSite and the product by default", () => {
    expect(graphOf(DEFAULT_SETTINGS).map((n) => n["@type"])).toEqual([
      "Organization",
      "ImageObject",
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
    expect(nodeOfType(settings, "Organization")).toBeUndefined();
    // …and the nodes that referenced it stop claiming a publisher/provider
    // that isn't in the graph.
    expect(nodeOfType(settings, "WebSite")?.publisher).toBeUndefined();
    expect(nodeOfType(settings, "WebApplication")?.provider).toBeUndefined();
  });

  it("builds sameAs from the social profiles, in order", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      socials: [
        { id: "b", platform: "X", url: "https://x.com/ctd", order: 1 },
        { id: "a", platform: "Instagram", url: "https://instagram.com/ctd", order: 0 },
      ],
    };
    expect(nodeOfType(settings, "Organization")?.sameAs).toEqual([
      "https://instagram.com/ctd",
      "https://x.com/ctd",
    ]);
  });

  it("never invents a rating to satisfy the Software App rich result", () => {
    // The app node is a WebApplication, so Google will report it as missing the
    // aggregateRating that result requires. That error is accepted and permanent
    // — real app ratings come from the stores, and fabricating one here would
    // breach Google's review policy. This assertion is what stops a future
    // "fix" for that Search Console row.
    const json = JSON.stringify(buildSiteJsonLd(DEFAULT_SETTINGS));
    expect(json).not.toContain("aggregateRating");
    expect(json).not.toContain('"review"');
  });

  it("makes no machine-readable claim about a platform that isn't shipped", () => {
    // The native apps are still "coming soon" on the page and still named for
    // the retired brand in app.json, so `operatingSystem` says "Any" — the
    // schema.org convention for something that runs in a browser — and the
    // store-shaped properties are absent entirely.
    //
    // Scoped to the structured fields on purpose: `description` mirrors the
    // marketing copy, iOS mention and all, and markup that repeats what the page
    // says is exactly what's wanted. It's the machine-readable assertion that
    // must not run ahead of reality.
    const app = nodeOfType(DEFAULT_SETTINGS, "WebApplication") as Record<string, unknown>;
    expect(app.operatingSystem).toBe("Any");
    for (const claim of ["downloadUrl", "screenshot", "softwareVersion", "fileSize"]) {
      expect(app).not.toHaveProperty(claim);
    }
    expect(String(app.operatingSystem)).not.toMatch(/iOS|Android/);
    expect(app.installUrl).toBe(`${siteConfig.url}/signup`);
  });

  it("gives the product an @id and a complete free offer", () => {
    const app = nodeOfType(DEFAULT_SETTINGS, "WebApplication");
    expect(app?.["@id"]).toBe(APP_ID);
    expect(app?.url).toBe(siteConfig.url);
    expect(app?.isAccessibleForFree).toBe(true);
    expect(app?.offers).toEqual({
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: `${siteConfig.url}/signup`,
    });
  });

  it("keeps the logo a referenceable node rather than an inline object", () => {
    // So a page's `primaryImageOfPage` can point at the same image instead of
    // describing a second copy of it.
    const org = nodeOfType(DEFAULT_SETTINGS, "Organization");
    expect(org?.logo).toEqual({ "@id": LOGO_ID });
    expect(nodeOfType(DEFAULT_SETTINGS, "ImageObject")?.["@id"]).toBe(LOGO_ID);
  });

  it("emits a contact point only when there is a way to make contact", () => {
    const org = nodeOfType(DEFAULT_SETTINGS, "Organization") as Record<string, unknown>;
    expect(org.contactPoint).toEqual([
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: DEFAULT_SETTINGS.identity.contactEmail,
        url: `${siteConfig.url}/contact`,
        availableLanguage: ["en"],
      },
    ]);

    const settings = {
      ...DEFAULT_SETTINGS,
      identity: { ...DEFAULT_SETTINGS.identity, contactEmail: "" },
      structuredData: {
        ...DEFAULT_SETTINGS.structuredData,
        organization: { ...DEFAULT_SETTINGS.structuredData.organization, email: "" },
      },
    };
    expect(nodeOfType(settings, "Organization")?.contactPoint).toBeUndefined();
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

  it("warns about a priceless offer but not about a missing app category", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      structuredData: {
        ...DEFAULT_SETTINGS.structuredData,
        softwareApplication: {
          ...DEFAULT_SETTINGS.structuredData.softwareApplication,
          price: "",
          applicationCategory: "",
        },
      },
    };
    const warnings = structuredDataWarnings(settings);
    expect(warnings).toContain("The application's offer needs a price (use 0 for free).");
    expect(warnings.join(" ")).not.toContain("category");
  });

  it("tells the reader the Search Console rating error is expected", () => {
    // Left as a standing note rather than a one-off: the row never goes away, so
    // whoever opens the report next needs to find the reason without digging.
    expect(structuredDataWarnings(DEFAULT_SETTINGS).join(" ")).toContain(
      "Search Console will report the homepage's app markup as missing a rating",
    );
  });

  it("flags an empty sameAs, the biggest missing entity signal", () => {
    expect(structuredDataWarnings(DEFAULT_SETTINGS).join(" ")).toContain("no sameAs");
    const withSocial = {
      ...DEFAULT_SETTINGS,
      socials: [{ id: "a", platform: "X", url: "https://x.com/br", order: 0 }],
    };
    expect(structuredDataWarnings(withSocial).join(" ")).not.toContain("no sameAs");
  });
});

describe("authorNode", () => {
  it("returns the Organization for a brand byline, which is what the page shows", () => {
    // Nothing stored means no byline renders, so a Person would be marking up
    // content that isn't on the page — and a company isn't a person anyway.
    expect(authorNode("")).toEqual({ "@id": ORG_ID });
    expect(authorNode("   ")).toEqual({ "@id": ORG_ID });
    expect(authorNode("circle the date")).toEqual({ "@id": ORG_ID });
    expect(authorNode("The Circle the date team")).toEqual({ "@id": ORG_ID });
    expect(authorNode(siteConfig.name)).toEqual({ "@id": ORG_ID });
  });

  it("returns a Person for a name a person actually has", () => {
    expect(authorNode("Aneesh")).toEqual({ "@type": "Person", name: "Aneesh" });
    expect(authorNode("Dana Circle")).toEqual({ "@type": "Person", name: "Dana Circle" });
  });
});

describe("normalizeAuthorName", () => {
  it("maps the retired brand onto the current one", () => {
    expect(normalizeAuthorName("The Circle the date team")).toBe(
      `The ${siteConfig.name} team`,
    );
    expect(normalizeAuthorName("circle the date")).toBe(siteConfig.name);
  });

  it("falls back to the site name for a missing byline", () => {
    expect(normalizeAuthorName("")).toBe(siteConfig.name);
    expect(normalizeAuthorName("   ")).toBe(siteConfig.name);
  });

  it("leaves every other author alone", () => {
    expect(normalizeAuthorName("Aneesh")).toBe("Aneesh");
    // Narrow by design: only an exact match is a retired brand, so a real
    // person whose name contains one of those words survives.
    expect(normalizeAuthorName("Dana Circle")).toBe("Dana Circle");
  });
});
