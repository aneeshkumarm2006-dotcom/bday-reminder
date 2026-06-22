import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site";

/** Sitemap for the marketing pages (Stage 11 SEO). */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: { path: string; priority: number; changeFrequency: "monthly" | "yearly" }[] = [
    { path: "/", priority: 1, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.5, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.5, changeFrequency: "yearly" },
    { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
  ];
  return routes.map((route) => ({
    url: `${siteConfig.url}${route.path === "/" ? "" : route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
