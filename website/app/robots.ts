import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/** Allow all crawlers; point them at the sitemap (Stage 11 SEO). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}
