"use client";

import { siteConfig } from "@/lib/site";

/**
 * Google result + social card previews for any route.
 *
 * The blog editor has its own version keyed to `/blog/<slug>`
 * (`search-listing-preview.tsx`); this one takes an arbitrary path so the meta
 * manager and the page builder can share it. Strings only — no dates, no
 * locale formatting — so it needs no hydration guard.
 */
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

export function GoogleSnippetPreview({
  path,
  title,
  description,
}: {
  path: string;
  title: string;
  description: string;
}) {
  const crumbs = path.split("/").filter(Boolean);
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4">
      <div className="flex flex-wrap items-center gap-1 text-xs text-ink-secondary">
        <span className="truncate">{HOST}</span>
        {crumbs.map((crumb) => (
          <span key={crumb} className="flex items-center gap-1">
            <span aria-hidden="true">›</span>
            <span className="truncate">{crumb}</span>
          </span>
        ))}
      </div>
      <p className="mt-1 text-lg leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
        {truncate(title || "Untitled page", 60)}
      </p>
      <p className="mt-0.5 text-sm leading-snug text-ink-secondary">
        {description.trim()
          ? truncate(description, 160)
          : "Add a meta description to control the snippet Google shows here."}
      </p>
    </div>
  );
}

export function SocialCardPreview({
  path,
  title,
  description,
  image,
}: {
  path: string;
  title: string;
  description: string;
  image: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
      {image ? (
        // Intentionally a plain <img>: the URL is arbitrary admin input and may
        // point at a host that isn't in next.config's image allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          className="aspect-[1.91/1] w-full bg-surface-sunken object-cover"
        />
      ) : (
        <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-surface-sunken text-xs text-ink-muted">
          No image — the generated Open Graph image is used
        </div>
      )}
      <div className="border-t border-border-subtle px-4 py-3">
        <p className="text-[11px] uppercase tracking-wide text-ink-muted">
          {HOST}
          {path === "/" ? "" : path}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium text-ink">
          {title || "Untitled page"}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs text-ink-secondary">
          {description || "No description set."}
        </p>
      </div>
    </div>
  );
}
