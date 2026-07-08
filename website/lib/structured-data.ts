import { siteConfig } from "@/lib/site";

/**
 * Shared schema.org building blocks so every page's JSON-LD points at the *same*
 * Organization entity (matched by `@id`) with the same logo. The homepage
 * (components/site-json-ld.tsx) emits the full nodes; the blog post schema
 * (components/blog/post-json-ld.tsx) references the same `@id`.
 */

export const ORG_ID = `${siteConfig.url}/#organization`;
export const WEBSITE_ID = `${siteConfig.url}/#website`;

// A real, crawlable 512×512 PNG logo, replacing the old `/icon.svg` (which no
// longer exists — the static file was superseded by the generated `/icon` route).
export const LOGO_URL = `${siteConfig.url}/icons/512`;

/** The Organization node behind the site (also the blog/publisher). */
export function organizationNode() {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    email: siteConfig.contactEmail,
    logo: {
      "@type": "ImageObject",
      url: LOGO_URL,
      width: 512,
      height: 512,
    },
  };
}
