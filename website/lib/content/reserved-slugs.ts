/**
 * Slugs a custom page may never claim. The page builder renders at
 * `/(marketing)/[slug]`, which sits at the site root — so any slug matching an
 * existing top-level route would be shadowed by (or would shadow) real app
 * routes, and the discovery files must stay reachable.
 *
 * Enforced server-side (Zod + the API handler), not just in the UI, and backed
 * by the unique index on `SitePage.slug`.
 */
export const RESERVED_SLUGS: readonly string[] = [
  // Marketing + auth routes
  "blog",
  "login",
  "signup",
  "contact",
  "privacy",
  "terms",
  // Keyword landing pages (real route files — see lib/content/seo-pages/)
  "birthday-calendar",
  "birthday-countdown-app",
  "birthday-tracker",
  "birthday-alarm",
  "family-birthday-calendar",
  "free",
  // Authenticated app routes
  "dashboard",
  "people",
  "reminders",
  "calendar",
  "lists",
  "settings",
  "import",
  "invite",
  "auth",
  // Private dashboards + APIs
  "seoteam",
  "analyticshub",
  "api",
  // Generated / discovery files and icon routes
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
  "manifest.json",
  "llms.txt",
  "icon",
  "icons",
  "opengraph-image",
  "favicon.ico",
  "_next",
  "static",
] as const;

const RESERVED = new Set(RESERVED_SLUGS);

/** True when the slug collides with an existing route or discovery file. */
export function isReservedSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase().replace(/^\/+|\/+$/g, "");
  if (!normalized) return true;
  // A nested slug is judged by its first segment ("blog/foo" is still /blog).
  return RESERVED.has(normalized) || RESERVED.has(normalized.split("/")[0]);
}
