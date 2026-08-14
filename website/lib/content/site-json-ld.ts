import { siteConfig } from "@/lib/site";

import type { SiteSettings } from "./types";

/**
 * Stable fragment `@id`s for the entities the site talks about, so any page's
 * markup can point at the same Organization (every page's graph does) instead of
 * describing a second copy of it.
 *
 * These strings are load-bearing: a consumer that has already resolved
 * `…/#organization` reconciles new markup against it by exact match. Changing
 * one resets the entity, so they don't change.
 */
export const ORG_ID = `${siteConfig.url}/#organization`;
export const WEBSITE_ID = `${siteConfig.url}/#website`;
export const APP_ID = `${siteConfig.url}/#app`;
export const LOGO_ID = `${siteConfig.url}/#logo`;

/** Where a visitor actually starts using the app. */
export const SIGNUP_URL = `${siteConfig.url}/signup`;

export type JsonLdNode = Record<string, unknown>;

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
export function normalizeAuthorName(stored: string, siteName: string = siteConfig.name): string {
  const name = stored.trim();
  if (!name) return siteName;
  const replacement = RETIRED_AUTHOR_NAMES[name.toLowerCase()];
  return replacement ? replacement.replace("{name}", siteName) : name;
}

/**
 * True when a stored byline names the company rather than a person — either it's
 * empty, or it normalises to the site's own name or "The <site> team".
 */
export function isBrandAuthor(stored: string, siteName: string = siteConfig.name): boolean {
  const name = stored.trim();
  if (!name) return true;
  const normalized = normalizeAuthorName(name, siteName).toLowerCase();
  return normalized === siteName.toLowerCase() || normalized === `the ${siteName} team`.toLowerCase();
}

/**
 * The `author` value for a post.
 *
 * A brand is an Organization, not a Person — and when nothing is stored, the
 * page renders no byline at all, so a reference to the publisher is the only
 * honest claim available. Only a real, human-looking name becomes a `Person`.
 */
export function authorNode(stored: string, siteName: string = siteConfig.name): JsonLdNode {
  if (isBrandAuthor(stored, siteName)) return { "@id": ORG_ID };
  return { "@type": "Person", name: normalizeAuthorName(stored, siteName) };
}

/* ------------------------------- site entities ---------------------------- */

function sameAsFrom(settings: SiteSettings): string[] {
  return settings.socials
    .filter((social) => social.url.trim())
    .sort((a, b) => a.order - b.order)
    .map((social) => social.url);
}

/** The logo as its own node, so `primaryImageOfPage` can point at it by `@id`. */
export function logoNode(settings: SiteSettings): JsonLdNode | null {
  const { logoUrl } = settings.structuredData.organization;
  if (!logoUrl) return null;
  return {
    "@type": "ImageObject",
    "@id": LOGO_ID,
    url: logoUrl,
    contentUrl: logoUrl,
    width: 512,
    height: 512,
    caption: settings.structuredData.organization.name || settings.identity.name,
  };
}

function contactPointNode(settings: SiteSettings): JsonLdNode | null {
  const org = settings.structuredData.organization;
  const { contactPoint } = org;
  if (!contactPoint.enabled) return null;
  const email = contactPoint.email || org.email || settings.identity.contactEmail;
  const telephone = contactPoint.telephone;
  // A contact point with no way to make contact says nothing — omit it rather
  // than emit an empty shell.
  if (!email && !telephone) return null;
  return {
    "@type": "ContactPoint",
    contactType: contactPoint.contactType,
    ...(email ? { email } : {}),
    ...(telephone ? { telephone } : {}),
    url: `${siteConfig.url}/contact`,
    availableLanguage: ["en"],
  };
}

/**
 * The Organization.
 *
 * `full` is only true on the two pages that describe the company — the homepage
 * and /contact. Everywhere else a four-property stub goes out instead: it
 * resolves the `@id` every page graph references, without publishing a second,
 * competing description of the same entity on fifty URLs.
 */
export function organizationNode(
  settings: SiteSettings,
  { full = false }: { full?: boolean } = {},
): JsonLdNode | null {
  const org = settings.structuredData.organization;
  if (!org.enabled) return null;

  const name = org.name || settings.identity.name;
  if (!full) {
    return { "@type": "Organization", "@id": ORG_ID, name, url: siteConfig.url };
  }

  const sameAs = sameAsFrom(settings);
  const email = org.email || settings.identity.contactEmail;
  const contactPoint = contactPointNode(settings);

  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name,
    ...(org.alternateName ? { alternateName: org.alternateName } : {}),
    ...(org.legalName ? { legalName: org.legalName } : {}),
    url: siteConfig.url,
    description: org.description || settings.identity.description,
    ...(org.foundingDate ? { foundingDate: org.foundingDate } : {}),
    ...(email ? { email } : {}),
    ...(org.logoUrl ? { logo: { "@id": LOGO_ID }, image: { "@id": LOGO_ID } } : {}),
    ...(contactPoint ? { contactPoint: [contactPoint] } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

/**
 * The WebSite. Google's site-name feature reads this from the domain root only,
 * so the full node is a homepage thing; elsewhere it's a stub that exists to
 * resolve `isPartOf`.
 */
export function webSiteNode(
  settings: SiteSettings,
  { full = false }: { full?: boolean } = {},
): JsonLdNode | null {
  const site = settings.structuredData.website;
  if (!site.enabled) return null;

  const name = site.name || settings.identity.name;
  if (!full) {
    return { "@type": "WebSite", "@id": WEBSITE_ID, name, url: siteConfig.url };
  }

  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name,
    url: siteConfig.url,
    description: site.description || settings.identity.description,
    inLanguage: site.inLanguage || "en-US",
    ...(settings.structuredData.organization.enabled ? { publisher: { "@id": ORG_ID } } : {}),
    // No `potentialAction`/SearchAction: Google retired the sitelinks searchbox
    // in November 2024, and the marketing site has no search endpoint to point at.
  };
}

/**
 * The product.
 *
 * This is a `WebApplication` — a SoftwareApplication subtype — and it is emitted
 * on the homepage only. Two consequences, both deliberate:
 *
 * 1. Google's Software App rich result requires `aggregateRating` or `review`.
 *    We have neither and won't invent them, so Search Console will report this
 *    node as an invalid item, permanently. That is expected and correct: real
 *    app rich results are drawn from the app stores, not from a marketing site,
 *    so the error costs nothing, while the type buys `featureList`,
 *    `applicationCategory`, `browserRequirements` and `isAccessibleForFree` —
 *    none of which exist on `Service`, which this node used to be. The
 *    acceptance criterion is *one* URL with *one* error; anything else means
 *    something changed.
 * 2. Landing pages reference `{ "@id": APP_ID }` rather than repeating the node.
 *    A copy per page would be five rival software entities for one product, and
 *    would multiply the invalid item across seven more URLs.
 *
 * Every property here is true today. `installUrl` is /signup because that is
 * where a person starts using it; there is no store listing, no download, no
 * screenshot URL and no version, so none of those appear. `operatingSystem` is
 * "Any" — naming iOS or Android would claim shipped native apps that, as of the
 * "coming soon" badges on the page, don't exist.
 */
export function appNode(
  settings: SiteSettings,
  { featureList = [] }: { featureList?: string[] } = {},
): JsonLdNode | null {
  const app = settings.structuredData.softwareApplication;
  if (!app.enabled) return null;

  const price = app.price || "0";

  return {
    "@type": "WebApplication",
    "@id": APP_ID,
    name: app.name || settings.identity.name,
    url: siteConfig.url,
    description: app.description || settings.identity.description,
    ...(app.applicationCategory ? { applicationCategory: app.applicationCategory } : {}),
    ...(app.applicationSubCategory
      ? { applicationSubCategory: app.applicationSubCategory }
      : {}),
    ...(app.operatingSystem ? { operatingSystem: app.operatingSystem } : {}),
    ...(app.browserRequirements ? { browserRequirements: app.browserRequirements } : {}),
    installUrl: SIGNUP_URL,
    ...(price === "0" ? { isAccessibleForFree: true } : {}),
    inLanguage: settings.structuredData.website.inLanguage || "en-US",
    ...(featureList.length > 0 ? { featureList } : {}),
    ...(settings.structuredData.organization.enabled ? { provider: { "@id": ORG_ID } } : {}),
    // A price with no availability or url is the half-offer that reads as a
    // broken product listing; these three make it a complete, free offer.
    offers: {
      "@type": "Offer",
      price,
      priceCurrency: app.priceCurrency || "USD",
      availability: "https://schema.org/InStock",
      url: SIGNUP_URL,
    },
  };
}

/**
 * The site-level entities, fully described: Organization, its logo, WebSite and
 * the app. This is what the homepage graph embeds and what the admin's preview
 * pane renders. Disabled nodes are omitted entirely rather than emitted empty —
 * an Organization with no name is worse than no Organization.
 *
 * Deliberately absent: `aggregateRating` and `review`. A rating we don't have
 * would be fabricated, and one sourced from a store listing may only appear once
 * the stars are also rendered on the page.
 */
export function buildSiteJsonLd(settings: SiteSettings): Record<string, unknown> {
  const graph = [
    organizationNode(settings, { full: true }),
    logoNode(settings),
    webSiteNode(settings, { full: true }),
    appNode(settings),
  ].filter((node): node is JsonLdNode => node !== null);

  return { "@context": "https://schema.org", "@graph": graph };
}

/** Missing-field warnings shown beside the form. */
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
    if (
      organization.contactPoint.enabled &&
      !organization.contactPoint.email &&
      !organization.contactPoint.telephone &&
      !organization.email &&
      !settings.identity.contactEmail
    ) {
      warnings.push("Contact point is on but has no email or phone, so nothing is emitted.");
    }
  }
  if (website.enabled && !(website.name || settings.identity.name)) {
    warnings.push("WebSite needs a name.");
  }
  if (softwareApplication.enabled) {
    if (!softwareApplication.price) {
      warnings.push("The application's offer needs a price (use 0 for free).");
    }
    // Said plainly so the next person to open Search Console doesn't "fix" it by
    // inventing a rating.
    warnings.push(
      "Expected: Search Console will report the homepage's app markup as missing a rating. Google's Software App result requires one, and inventing it would breach their review policy — real app ratings come from the app stores. Leave it.",
    );
  }
  if (settings.socials.filter((social) => social.url.trim()).length === 0) {
    warnings.push(
      "No social profiles are set, so the Organization has no sameAs — the strongest signal for tying this brand to a known entity. Add them under Site settings.",
    );
  }
  if (!organization.enabled && !website.enabled && !softwareApplication.enabled) {
    warnings.push("No structured data is being emitted at all.");
  }
  return warnings;
}
