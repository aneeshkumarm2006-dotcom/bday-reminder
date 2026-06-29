import type { MetadataRoute } from "next";

import { isDbConfigured } from "@/lib/blog/db";
import { getPublishedSlugs } from "@/lib/blog/posts";
import { siteConfig } from "@/lib/site";

// Regenerate per request so newly published posts enter the sitemap instantly.
export const dynamic = "force-dynamic";

type ChangeFrequency = "daily" | "weekly" | "monthly" | "yearly";

/** Sitemap for the marketing pages + published blog posts (Stage 11 SEO). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const routes: { path: string; priority: number; changeFrequency: ChangeFrequency }[] = [
    { path: "/", priority: 1, changeFrequency: "monthly" },
    { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
    { path: "/privacy", priority: 0.5, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.5, changeFrequency: "yearly" },
    { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  ];

  const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
    url: `${siteConfig.url}${route.path === "/" ? "" : route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // Published posts only (drafts and /seoteam are intentionally excluded).
  let postEntries: MetadataRoute.Sitemap = [];
  if (isDbConfigured()) {
    try {
      const posts = await getPublishedSlugs();
      postEntries = posts.map((post) => ({
        url: `${siteConfig.url}/blog/${post.slug}`,
        lastModified: new Date(post.updatedAt),
        changeFrequency: "monthly",
        priority: 0.6,
      }));
    } catch {
      postEntries = [];
    }
  }

  return [...staticEntries, ...postEntries];
}
