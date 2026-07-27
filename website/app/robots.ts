import type { MetadataRoute } from "next";

import { getSiteSettings } from "@/lib/content/get";
import { siteConfig } from "@/lib/site";

// Regenerated per request so a change in Site settings (extra Disallow rules,
// or the site-wide indexing kill-switch) takes effect on the next crawl.
export const dynamic = "force-dynamic";

/**
 * Allow all crawlers except the private dashboards; point them at the sitemap
 * (Stage 11 SEO). `/seoteam` and `/analyticshub` are also noindex via page
 * metadata + an X-Robots-Tag header — the Disallow here is the secondary,
 * crawl-blocking signal.
 *
 * When indexing is switched off in the admin's danger zone this flips to a
 * blanket `Disallow: /` and stops advertising the sitemap, so the two signals
 * (meta robots and robots.txt) always agree.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettings();

  if (!settings.seo.indexingEnabled) {
    return {
      rules: { userAgent: "*", disallow: "/" },
      host: siteConfig.url,
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/seoteam", "/analyticshub", ...settings.robotsExtraDisallows],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
