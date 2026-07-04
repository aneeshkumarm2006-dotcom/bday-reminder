"use client";

import { slugify } from "@/lib/blog/slug";
import { siteConfig } from "@/lib/site";

const HOST = (() => {
  try {
    return new URL(siteConfig.url).host;
  } catch {
    return siteConfig.url.replace(/^https?:\/\//, "");
  }
})();

function truncate(value: string, max: number): string {
  const v = value.trim();
  return v.length > max ? `${v.slice(0, max - 1).trimEnd()}…` : v;
}

/**
 * Live Google-style search result preview. Mirrors the site's metadata
 * precedence: `metaTitle || title` and `excerpt` (which is the meta description
 * on this site). Strings only — no dates or local formatting — so it needs no
 * hydration guard. Truncation ~60 (title) / ~160 (description); Shopify itself
 * truncates around ~70 / ~320.
 */
export function SearchListingPreview({
  title,
  metaTitle,
  excerpt,
  slug,
}: {
  title: string;
  metaTitle: string;
  excerpt: string;
  slug: string;
}) {
  const displayTitle = truncate(metaTitle.trim() || title.trim() || "Untitled post", 60);
  const slugPart = (slug.trim() || slugify(title)) || "post";
  const description = excerpt.trim()
    ? truncate(excerpt, 160)
    : "Add a meta description to control the snippet Google shows here.";

  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4">
      <div className="flex items-center gap-1 text-xs text-ink-secondary">
        <span className="truncate">{HOST}</span>
        <span aria-hidden="true">›</span>
        <span>blog</span>
        <span aria-hidden="true">›</span>
        <span className="truncate">{slugPart}</span>
      </div>
      <p className="mt-1 text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
        {displayTitle}
      </p>
      <p className="mt-0.5 text-sm leading-snug text-ink-secondary">{description}</p>
    </div>
  );
}
