import { revalidatePath } from "next/cache";

import { SEO_LANDING_PATHS } from "./seo-pages";
import { GRAPH_ROUTES } from "./static-routes";
import type { EntityType } from "./types";

/**
 * One place that maps "what was just saved" → "which cached paths must die".
 *
 * The homepage is ISR (`revalidate = 3600`), so without this an admin edit
 * looks stuck for up to an hour — the single most confusing failure mode of a
 * DB-backed marketing site. Settings and navigation feed the root layout
 * (title template, header, footer), so those revalidate with `type: "layout"`,
 * which invalidates that layout and everything nested beneath it.
 *
 * Never throws: revalidation is a cache hint, and a failed hint must not turn a
 * successful save into a 500.
 */
function safeRevalidate(path: string, type?: "page" | "layout"): void {
  try {
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  } catch (err) {
    console.error(`revalidatePath("${path}") failed:`, err);
  }
}

export interface RevalidateTarget {
  /** For `meta` — the route whose metadata changed. */
  path?: string;
  /** For `page` and `seo-page` — the page's slug. */
  slug?: string;
  /** For `legal` — which document. */
  legalKey?: string;
}

export function revalidateFor(entity: EntityType, target: RevalidateTarget = {}): void {
  switch (entity) {
    case "site":
    case "structured-data":
      // Title template, verification codes, analytics, announcement bar, JSON-LD:
      // all of it is layout-level, so everything downstream has to go.
      safeRevalidate("/", "layout");
      // Belt and braces for the JSON-LD specifically. Every public page now
      // embeds the Organization and WebSite nodes in its own graph, not just the
      // homepage, so renaming the organisation has to reach all of them — and
      // these are the ISR routes where being wrong means being wrong for an hour.
      for (const path of GRAPH_ROUTES) safeRevalidate(path);
      safeRevalidate("/robots.txt");
      safeRevalidate("/sitemap.xml");
      safeRevalidate("/llms.txt");
      break;
    case "navigation":
      safeRevalidate("/", "layout");
      break;
    case "landing":
      safeRevalidate("/");
      break;
    case "meta": {
      const path = target.path ?? "/";
      safeRevalidate(path);
      safeRevalidate("/sitemap.xml");
      break;
    }
    case "page": {
      if (target.slug) safeRevalidate(`/${target.slug}`);
      safeRevalidate("/sitemap.xml");
      break;
    }
    case "seo-page": {
      // The edited page itself, plus its five siblings: every landing page
      // renders the others' label and blurb in its cross-link strip, so a
      // rename that only refreshed one page would leave the cluster
      // disagreeing about what this page is called.
      for (const path of SEO_LANDING_PATHS) safeRevalidate(path);
      break;
    }
    case "legal": {
      if (target.legalKey) safeRevalidate(`/${target.legalKey}`);
      safeRevalidate("/sitemap.xml");
      break;
    }
  }
}

/** Redirects resolve on the 404 path, which is dynamic — only the sitemap caches. */
export function revalidateRedirects(): void {
  safeRevalidate("/sitemap.xml");
}
