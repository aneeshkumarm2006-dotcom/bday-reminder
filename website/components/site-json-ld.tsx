import { jsonLdScript } from "@/lib/blog/url";
import { getSiteSettings } from "@/lib/content/get";
import { buildSiteJsonLd } from "@/lib/content/site-json-ld";

/**
 * Site-level structured data for the homepage: an Organization, the WebSite it
 * publishes, and the product itself as a free Service. Bundled in one
 * `@graph` so the nodes cross-reference by `@id`. Emitted as
 * <script type="application/ld+json"> with the same XSS-safe escaping the blog
 * schema uses.
 *
 * The nodes are built from admin settings (/seoteam/structured-data), falling
 * back to `lib/content/defaults.ts`; the graph builder lives in
 * `lib/content/site-json-ld.ts` so it can be unit-tested on its own.
 */
export async function SiteJsonLd() {
  const settings = await getSiteSettings();
  const graph = buildSiteJsonLd(settings);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdScript(graph) }}
    />
  );
}
