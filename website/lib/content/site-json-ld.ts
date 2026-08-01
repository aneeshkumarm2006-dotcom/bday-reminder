import { siteConfig } from "@/lib/site";

import type { SiteSettings } from "./types";

/**
 * Stable fragment `@id`s for the three entities the site talks about, so any
 * page's markup can point at the same Organization (the blog's publisher does)
 * instead of describing a second copy of it.
 */
export const ORG_ID = `${siteConfig.url}/#organization`;
export const WEBSITE_ID = `${siteConfig.url}/#website`;
export const APP_ID = `${siteConfig.url}/#app`;

/**
 * Bylines stored on posts written before the 2026 rename still say "Circle the
 * date", a brand that exists nowhere else on the site. The rows live in a
 * database the build can't reach, so the retired names are mapped to the
 * current one at render time instead.
 *
 * An exact-match table rather than a substring replace on purpose: a future
 * author whose own name happens to contain one of these words must come through
 * untouched. `{name}` is filled with the live site name, so a second rename
 * only has to change `siteConfig`.
 */
export const RETIRED_AUTHOR_NAMES: Record<string, string> = {
  "the circle the date team": "The {name} team",
  "circle the date team": "The {name} team",
  "circle the date": "{name}",
};

/** The byline to render for a stored author string (empty → the site itself). */
export function normalizeAuthorName(stored: string, siteName = siteConfig.name): string {
  const name = stored.trim();
  if (!name) return siteName;
  const replacement = RETIRED_AUTHOR_NAMES[name.toLowerCase()];
  return replacement ? replacement.replace("{name}", siteName) : name;
}

/**
 * Builds the site-level JSON-LD `@graph` from admin settings.
 *
 * Pure and separate from the component so the same nodes can be unit-tested and
 * reused (the blog's publisher reference points at the same `@id`). Disabled
 * node types are omitted entirely rather than emitted empty — an Organization
 * with no name is worse than no Organization.
 *
 * Deliberately absent: `aggregateRating` (we don't fabricate ratings) and
 * `SearchAction` (the marketing site has no search endpoint).
 */
export function buildSiteJsonLd(settings: SiteSettings): Record<string, unknown> {
  const { structuredData, identity, socials } = settings;
  const graph: Record<string, unknown>[] = [];

  const sameAs = socials
    .filter((social) => social.url.trim())
    .sort((a, b) => a.order - b.order)
    .map((social) => social.url);

  if (structuredData.organization.enabled) {
    const org = structuredData.organization;
    graph.push({
      "@type": "Organization",
      "@id": ORG_ID,
      name: org.name || identity.name,
      ...(org.legalName ? { legalName: org.legalName } : {}),
      url: siteConfig.url,
      description: org.description || identity.description,
      ...(org.email || identity.contactEmail
        ? { email: org.email || identity.contactEmail }
        : {}),
      ...(org.logoUrl
        ? { logo: { "@type": "ImageObject", url: org.logoUrl, width: 512, height: 512 } }
        : {}),
      ...(sameAs.length > 0 ? { sameAs } : {}),
    });
  }

  if (structuredData.website.enabled) {
    const site = structuredData.website;
    graph.push({
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      name: site.name || identity.name,
      url: siteConfig.url,
      description: site.description || identity.description,
      inLanguage: site.inLanguage || "en-US",
      ...(structuredData.organization.enabled ? { publisher: { "@id": ORG_ID } } : {}),
    });
  }

  // The product used to be a `WebApplication`. Every type in the
  // SoftwareApplication family asks Google for the Software App rich result,
  // and that result *requires* `aggregateRating` or `review` — which we won't
  // invent. A node that can never satisfy the one rich result it applies for is
  // pure error surface (both Semrush's audit and the Rich Results Test flagged
  // it, the latter bucketing it with Product snippets) and wins nothing, since
  // Google draws app rich results from the stores anyway. So the product is
  // modelled as the `Service` it genuinely is — free, provided by the
  // Organization, used at the site's own URL. No rich result validates
  // `Service`, so there is nothing left to fail.
  if (structuredData.softwareApplication.enabled) {
    const app = structuredData.softwareApplication;
    graph.push({
      "@type": "Service",
      "@id": APP_ID,
      name: app.name || identity.name,
      url: siteConfig.url,
      description: app.description || identity.description,
      serviceType: "Birthday and event reminders",
      ...(structuredData.organization.enabled ? { provider: { "@id": ORG_ID } } : {}),
      // A price with no availability or url is the half-offer that reads as a
      // broken product listing; these three make it a complete, free offer.
      offers: {
        "@type": "Offer",
        price: app.price || "0",
        priceCurrency: app.priceCurrency || "USD",
        availability: "https://schema.org/InStock",
        url: siteConfig.url,
      },
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/** Missing-field warnings shown beside the form (Google's required properties). */
export function structuredDataWarnings(settings: SiteSettings): string[] {
  const warnings: string[] = [];
  const { organization, website, softwareApplication } = settings.structuredData;

  if (organization.enabled) {
    if (!(organization.name || settings.identity.name)) {
      warnings.push("Organization needs a name.");
    }
    if (!organization.logoUrl) {
      warnings.push("Organization has no logo — Google needs one for rich results.");
    }
  }
  if (website.enabled && !(website.name || settings.identity.name)) {
    warnings.push("WebSite needs a name.");
  }
  // Category and operating system are no longer emitted — see the Service node
  // above — so there's nothing to warn about there. The offer still needs a price.
  if (softwareApplication.enabled && !softwareApplication.price) {
    warnings.push("The application's offer needs a price (use 0 for free).");
  }
  if (!organization.enabled && !website.enabled && !softwareApplication.enabled) {
    warnings.push("No structured data is being emitted at all.");
  }
  return warnings;
}
