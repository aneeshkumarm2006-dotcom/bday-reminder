import { getSiteSettings } from "@/lib/content/get";
import { buildSiteJsonLd, ORG_ID, WEBSITE_ID } from "@/lib/content/site-json-ld";
import { siteConfig } from "@/lib/site";

/**
 * Shared schema.org building blocks so every page's JSON-LD points at the *same*
 * Organization entity (matched by `@id`) with the same logo. The homepage
 * (components/site-json-ld.tsx) emits the full graph; the blog post schema
 * (components/blog/post-json-ld.tsx) reuses the Organization node as its
 * publisher.
 *
 * Now admin-driven: the node is derived from Site settings → Structured data,
 * with `lib/content/defaults.ts` as the fallback, so editing the organization
 * name in one place updates the homepage and every blog post at once.
 */

export { ORG_ID, WEBSITE_ID };

// A real, crawlable 512×512 PNG logo, replacing the old `/icon.svg` (which no
// longer exists — the static file was superseded by the generated `/icon` route).
export const LOGO_URL = `${siteConfig.url}/icons/512`;

/** The Organization node behind the site (also the blog/publisher). */
export async function organizationNode(): Promise<Record<string, unknown>> {
  const settings = await getSiteSettings();
  const graph = buildSiteJsonLd(settings)["@graph"] as Record<string, unknown>[];
  const org = graph.find((node) => node["@type"] === "Organization");
  if (org) return org;

  // Structured data can be switched off entirely in the admin, but a
  // BlogPosting still needs a publisher — fall back to the minimum Google wants.
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: settings.identity.name,
    url: siteConfig.url,
    logo: { "@type": "ImageObject", url: LOGO_URL, width: 512, height: 512 },
  };
}
