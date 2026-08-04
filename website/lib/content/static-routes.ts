import { SEO_LANDING_PAGES } from "./seo-pages";

/**
 * The hardcoded half of the route registry, kept in its own module because it
 * has to stay importable from client code.
 *
 * `routes.ts` reads Mongo (`./get` → `./models` → mongoose) to merge admin
 * overrides onto these rows. Anything that only needs the *list* of paths —
 * `lib/blog/link-normalize.ts` runs in the blog editor's preview — must import
 * it from here instead, or the bundler drags mongoose into the browser build
 * and the page dies on `models.SiteSettings` at module evaluation.
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
