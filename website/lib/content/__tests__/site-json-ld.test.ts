import { describe, expect, it } from "vitest";

import { siteConfig } from "@/lib/site";

import { DEFAULT_SETTINGS } from "../defaults";
import {
  APP_ID,
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
  it("emits Organization, WebSite and the product Service by default", () => {
    expect(graphOf(DEFAULT_SETTINGS).map((n) => n["@type"])).toEqual([
      "Organization",
      "WebSite",
      "Service",
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
    expect(nodeOfType(settings, "Service")?.provider).toBeUndefined();
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

  it("never applies for the Software App rich result it can't satisfy", () => {
    // Google requires aggregateRating or review for that result, and we don't
    // have either — so no type in the SoftwareApplication family goes out.
    const types = graphOf(DEFAULT_SETTINGS).map((n) => n["@type"]);
    for (const banned of ["SoftwareApplication", "WebApplication", "MobileApplication"]) {
      expect(types).not.toContain(banned);
    }
    // …and no invented rating sneaks in to make one eligible.
    const json = JSON.stringify(buildSiteJsonLd(DEFAULT_SETTINGS));
    expect(json).not.toContain("aggregateRating");
    expect(json).not.toContain("\"review\"");
  });

  it("gives the product an @id and a complete free offer", () => {
    const service = nodeOfType(DEFAULT_SETTINGS, "Service");
    expect(service?.["@id"]).toBe(APP_ID);
    expect(service?.url).toBe(siteConfig.url);
    expect(service?.offers).toEqual({
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: siteConfig.url,
    });
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
    expect(structuredDataWarnings(settings)).toEqual([
      "The application's offer needs a price (use 0 for free).",
    ]);
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
