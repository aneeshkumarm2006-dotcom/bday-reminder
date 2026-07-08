import { jsonLdScript } from "@/lib/blog/url";
import { siteConfig } from "@/lib/site";
import { ORG_ID, WEBSITE_ID, organizationNode } from "@/lib/structured-data";

/**
 * Site-level structured data for the homepage: an Organization, the WebSite it
 * publishes, and the product itself as a WebApplication. Bundled in one
 * `@graph` so the nodes cross-reference by `@id`. Emitted as
 * <script type="application/ld+json"> with the same XSS-safe escaping the blog
 * schema uses.
 *
 * Note: no `aggregateRating` — we don't fabricate ratings — and no SearchAction,
 * since the marketing site has no search endpoint. `offers` reflects the real
 * "free forever, no paid tier" pricing.
 */
export function SiteJsonLd() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      organizationNode(),
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description,
        inLanguage: "en-US",
        publisher: { "@id": ORG_ID },
      },
      {
        "@type": "WebApplication",
        name: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description,
        applicationCategory: "LifestyleApplication",
        operatingSystem: "Web browser",
        browserRequirements: "Requires JavaScript.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": ORG_ID },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript(graph) }}
    />
  );
}
