import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/**
 * Allow all crawlers except the private SEO dashboard; point them at the
 * sitemap (Stage 11 SEO). `/seoteam` is also noindex via page metadata — the
 * Disallow here is the secondary, crawl-blocking signal.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/seoteam",
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
