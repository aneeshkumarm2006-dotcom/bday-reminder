import { siteConfig } from "@/lib/site";

import type { SiteSettings } from "./types";

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
export const ORG_ID = `${siteConfig.url}/#organization`;
export const WEBSITE_ID = `${siteConfig.url}/#website`;

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

  if (structuredData.softwareApplication.enabled) {
    const app = structuredData.softwareApplication;
    graph.push({
      "@type": "WebApplication",
      name: app.name || identity.name,
      url: siteConfig.url,
      description: app.description || identity.description,
      applicationCategory: app.applicationCategory || "LifestyleApplication",
      operatingSystem: app.operatingSystem || "Web browser",
      browserRequirements: "Requires JavaScript.",
      offers: {
        "@type": "Offer",
        price: app.price || "0",
        priceCurrency: app.priceCurrency || "USD",
      },
      ...(structuredData.organization.enabled ? { publisher: { "@id": ORG_ID } } : {}),
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
  if (softwareApplication.enabled) {
    if (!softwareApplication.applicationCategory) {
      warnings.push("SoftwareApplication needs an application category.");
    }
    if (!softwareApplication.price) {
      warnings.push("SoftwareApplication needs a price (use 0 for free).");
    }
  }
  if (!organization.enabled && !website.enabled && !softwareApplication.enabled) {
    warnings.push("No structured data is being emitted at all.");
  }
  return warnings;
}
