import { getAllSitePages, getAllPageMeta, defaultPageMeta } from "./get";
import { SEO_LANDING_PAGES } from "./seo-pages";
import type { PageMeta } from "./types";

/**
 * The registry of every public route the SEO team can tune.
 *
 * Three kinds, deliberately distinguished:
 *   - `static`  — a real page file whose metadata comes from `PageMeta`;
 *   - `custom`  — a page built in the page builder (its meta lives at `/slug`);
 *   - `blog`    — posts, which keep their own per-post SEO in the blog editor.
 *     They appear here as read-only rows so nobody hunts for them in two places.
 */
export type RouteKind = "static" | "custom" | "blog";

export interface RegistryRoute {
  path: string;
  label: string;
  kind: RouteKind;
  /** Where the SEO team edits this route's metadata. */
  editHref?: string;
  /**
   * The homepage opts out of the `%s · Site name` template so its exact
   * keyword-led title is used verbatim (this was already true before the admin).
   */
  absoluteTitle?: boolean;
}

export const STATIC_ROUTES: RegistryRoute[] = [
  { path: "/", label: "Home", kind: "static", absoluteTitle: true },
  // The keyword landing pages. Their copy is code, but their metadata is tuned
  // here like any other route — and like the homepage they use their brief's
  // title verbatim, so they opt out of the `%s · Site name` template too.
  ...SEO_LANDING_PAGES.map(
    (page): RegistryRoute => ({
      path: `/${page.slug}`,
      label: page.label,
      kind: "static",
      absoluteTitle: true,
    }),
  ),
  { path: "/blog", label: "Blog index", kind: "static" },
  { path: "/contact", label: "Contact", kind: "static" },
  { path: "/privacy", label: "Privacy policy", kind: "static" },
  { path: "/terms", label: "Terms of service", kind: "static" },
];

export interface RouteRow extends RegistryRoute {
  /** Effective metadata (override merged over the route's hardcoded defaults). */
  meta: PageMeta;
  /** True when an admin override exists for this path. */
  hasOverride: boolean;
}

/**
 * Every tunable route with its effective metadata. Custom pages are appended
 * after the static ones; blog posts are intentionally excluded (they'd swamp
 * the table and already have a dedicated editor) — the UI links out instead.
 */
export async function getRouteRows(): Promise<RouteRow[]> {
  const [overrides, pages] = await Promise.all([getAllPageMeta(), getAllSitePages()]);

  const rows: RouteRow[] = STATIC_ROUTES.map((route) => ({
    ...route,
    meta: overrides[route.path] ?? defaultPageMeta(route.path),
    hasOverride: Boolean(overrides[route.path]),
  }));

  for (const page of pages) {
    const path = `/${page.slug}`;
    rows.push({
      path,
      label: page.title || page.slug,
      kind: "custom",
      editHref: `/seoteam/pages/${page.id}/edit`,
      meta: overrides[path] ?? {
        ...defaultPageMeta(path),
        // A custom page with no override still has a sensible title/description
        // from the page itself, so the table shows what actually renders.
        title: page.title,
      },
      hasOverride: Boolean(overrides[path]),
    });
  }

  return rows;
}
