import { birthdayAlarmPage } from "./birthday-alarm";
import { birthdayCalendarPage } from "./birthday-calendar";
import { birthdayCountdownAppPage } from "./birthday-countdown-app";
import { birthdayTrackerPage } from "./birthday-tracker";
import { familyBirthdayCalendarPage } from "./family-birthday-calendar";
import { freePage } from "./free";
import type { SeoLandingPageDef } from "./types";

/**
 * The keyword landing-page cluster.
 *
 * Each page targets its own keyword group so none of them competes with the
 * homepage ("birthday app") or with each other. They're deliberately *not*
 * page-builder pages: the copy was written against SEO briefs and belongs in
 * review, and the design has to stay identical to the homepage's.
 *
 * This array is the single source for: the routes' rendered content, their
 * default SEO metadata (`DEFAULT_PAGE_META` spreads it), the route registry the
 * sitemap and `/seoteam/meta` read, the footer's "Explore" group, and the
 * cross-links each page shows for its siblings. Adding a page here plus a
 * three-line route file wires up all of it.
 *
 * Order is display order (footer + related cards), not importance.
 */
export const SEO_LANDING_PAGES: readonly SeoLandingPageDef[] = [
  birthdayCalendarPage,
  birthdayCountdownAppPage,
  birthdayTrackerPage,
  birthdayAlarmPage,
  familyBirthdayCalendarPage,
  freePage,
] as const;

/** Every SEO landing page's path, with the leading slash. */
export const SEO_LANDING_PATHS: readonly string[] = SEO_LANDING_PAGES.map(
  (page) => `/${page.slug}`,
);

export function getSeoLandingPage(slug: string): SeoLandingPageDef | undefined {
  return SEO_LANDING_PAGES.find((page) => page.slug === slug);
}

export type { SeoLandingPageDef };
