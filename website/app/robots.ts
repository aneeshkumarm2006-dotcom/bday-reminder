import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/**
 * Allow all crawlers except the private dashboards; point them at the sitemap
 * (Stage 11 SEO). `/seoteam` and `/analyticshub` are also noindex via page
 * metadata + an X-Robots-Tag header — the Disallow here is the secondary,
 * crawl-blocking signal.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/seoteam", "/analyticshub"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
