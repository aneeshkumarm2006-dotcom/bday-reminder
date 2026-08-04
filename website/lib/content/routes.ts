import { getAllSitePages, getAllPageMeta, defaultPageMeta } from "./get";
import { STATIC_ROUTES, type RegistryRoute } from "./static-routes";
import type { PageMeta } from "./types";

/**
 * The registry of every public route the SEO team can tune.
 *
 * Three kinds, deliberately distinguished:
 *   - `static`  — a real page file whose metadata comes from `PageMeta`;
 *   - `custom`  — a page built in the page builder (its meta lives at `/slug`);
 *   - `blog`    — posts, which keep their own per-post SEO in the blog editor.
 *     They appear here as read-only rows so nobody hunts for them in two places.
 *
 * The hardcoded rows live in `./static-routes` so client code can read them
 * without pulling this module's Mongo imports into the browser bundle; they're
 * re-exported here because this is where callers expect to find them.
 */
export { STATIC_ROUTES };
export type { RegistryRoute, RouteKind } from "./static-routes";

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
