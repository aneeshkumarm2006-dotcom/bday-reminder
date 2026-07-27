import type { MetadataRoute } from "next";

import { isDbConfigured } from "@/lib/blog/db";
import { getPublishedSlugs } from "@/lib/blog/posts";
import { getAllPageMeta, getPublishedSitePages, getSiteSettings } from "@/lib/content/get";
import { STATIC_ROUTES } from "@/lib/content/routes";
import { siteConfig } from "@/lib/site";

// Regenerate per request so newly published posts and pages enter the sitemap
// instantly, and a `sitemap.exclude` toggle takes effect on the next fetch.
export const dynamic = "force-dynamic";

/**
 * Sitemap for the marketing pages, published blog posts, and admin-built custom
 * pages.
 *
 * Per-route `changeFrequency` / `priority` / `exclude` come from `PageMeta`, so
 * the same drawer that sets a page's title also controls how it's advertised.
 * A route that's marked noindex is dropped as well — telling Google not to
 * index a URL while still listing it in the sitemap just wastes crawl budget.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const settings = await getSiteSettings();

  // The danger-zone kill-switch: an unindexable site advertises nothing.
  if (!settings.seo.indexingEnabled) return [];

  const overrides = await getAllPageMeta();
  const url = (path: string) => `${siteConfig.url}${path === "/" ? "" : path}`;

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.flatMap((route) => {
    const meta = overrides[route.path];
    const sitemapMeta = meta?.sitemap;
    if (sitemapMeta?.exclude || meta?.noindex) return [];
    return [
      {
        url: url(route.path),
        lastModified: now,
        changeFrequency: sitemapMeta?.changeFrequency ?? defaultFrequency(route.path),
        priority: sitemapMeta?.priority ?? defaultPriority(route.path),
      },
    ];
  });

  // Published posts only (drafts, scheduled posts, and /seoteam are excluded).
  let postEntries: MetadataRoute.Sitemap = [];
  let pageEntries: MetadataRoute.Sitemap = [];
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

    const pages = await getPublishedSitePages();
    pageEntries = pages.flatMap((page) => {
      const meta = overrides[`/${page.slug}`];
      if (meta?.sitemap.exclude || meta?.noindex) return [];
      return [
        {
          url: `${siteConfig.url}/${page.slug}`,
          lastModified: new Date(page.updatedAt),
          changeFrequency: meta?.sitemap.changeFrequency ?? "monthly",
          priority: meta?.sitemap.priority ?? 0.6,
        },
      ];
    });
  }

  return [...staticEntries, ...postEntries, ...pageEntries];
}

function defaultPriority(path: string): number {
  if (path === "/") return 1;
  if (path === "/blog") return 0.7;
  return 0.5;
}

function defaultFrequency(path: string): "monthly" | "weekly" | "yearly" {
  if (path === "/") return "monthly";
  if (path === "/blog") return "weekly";
  return "yearly";
}
