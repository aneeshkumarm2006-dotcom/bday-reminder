import { SEO_LANDING_PAGES, SEO_LANDING_PATHS } from "./seo-pages";

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

/**
 * Every public route whose code emits a page graph. Used by `revalidate.ts` to
 * fan a structured-data edit out to the pages that embed the Organization and
 * WebSite nodes, not just the homepage.
 */
export const GRAPH_ROUTES: string[] = [
  "/",
  ...SEO_LANDING_PATHS,
  "/blog",
  "/contact",
  "/privacy",
  "/terms",
];

/**
 * The schema types a route's own code already puts in its `@graph`.
 *
 * Lives here rather than in `page-graph.ts` because the Meta manager is a client
 * component and needs it to warn, live, that a pasted block duplicates an entity
 * the page emits anyway. Deliberately a coarse list of type names: it answers
 * "would this collide?", not "what exactly is emitted?".
 */
export function emittedTypesFor(path: string): string[] {
  const site = ["Organization", "WebSite"];
  if (path === "/") {
    return [...site, "WebApplication", "WebPage", "FAQPage", "ImageObject"];
  }
  if (SEO_LANDING_PATHS.includes(path)) {
    return [...site, "WebPage", "FAQPage", "BreadcrumbList"];
  }
  if (path === "/blog") {
    return [...site, "CollectionPage", "Blog", "ItemList", "BreadcrumbList"];
  }
  if (path.startsWith("/blog/")) {
    return [...site, "WebPage", "BlogPosting", "ImageObject", "BreadcrumbList"];
  }
  if (path === "/contact") {
    return [...site, "ContactPage", "ContactPoint", "ImageObject", "BreadcrumbList"];
  }
  // /privacy, /terms and every admin-built page share the same plain shape.
  return [...site, "WebPage", "FAQPage", "BreadcrumbList"];
}
