import { anniversaryReminderAppPage } from "./anniversary-reminder-app";
import { birthdayAlarmPage } from "./birthday-alarm";
import { birthdayCalendarPage } from "./birthday-calendar";
import { birthdayCountdownAppPage } from "./birthday-countdown-app";
import { birthdayTrackerPage } from "./birthday-tracker";
import { birthdayTrackerPrintablePage } from "./birthday-tracker-printable";
import { familyBirthdayCalendarPage } from "./family-birthday-calendar";
import { freePage } from "./free";
import {
  DEFAULT_SEO_SECTION_ORDER,
  type SeoLandingPageDef,
  type SeoLandingPageSource,
  type SeoLayoutItem,
} from "./types";

/**
 * Fill the fields a page file doesn't spell out: the render order, the
 * cross-link strip's copy, and the hero's second button.
 *
 * These are derived rather than authored so the eight page files stay pure
 * copy — but they have to *exist* as complete defaults, because a stored admin
 * override is deep-merged onto them field by field (`merge.ts`). A missing
 * default means a merge with nothing to merge onto.
 */
export function normalizeSeoPage(page: SeoLandingPageSource): SeoLandingPageDef {
  const layout: SeoLayoutItem[] =
    page.layout ??
    DEFAULT_SEO_SECTION_ORDER
      // A page with no file to give away has no download band; including a
      // hidden slot for it would put an empty row in the layout editor.
      .filter((section) => section !== "download" || Boolean(page.download))
      .map((section) => ({
        id: `slot-${section}`,
        kind: "section" as const,
        section,
        visible: true,
      }));

  return {
    ...page,
    hero: {
      ...page.hero,
      secondaryCta: page.hero.secondaryCta ?? {
        label: "See how it works",
        href: "#how",
      },
    },
    related: {
      heading: page.related?.heading ?? "Explore the rest of Birthday Reminders",
      sub:
        page.related?.sub ??
        "One app, one free account — here's the same thing from a few other angles.",
      ctaLabel: page.related?.ctaLabel ?? "Take a look",
    },
    layout,
  };
}

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
  birthdayTrackerPrintablePage,
  birthdayAlarmPage,
  familyBirthdayCalendarPage,
  anniversaryReminderAppPage,
  freePage,
].map(normalizeSeoPage);

/** Every SEO landing page's path, with the leading slash. */
export const SEO_LANDING_PATHS: readonly string[] = SEO_LANDING_PAGES.map(
  (page) => `/${page.slug}`,
);

export function getSeoLandingPage(slug: string): SeoLandingPageDef | undefined {
  return SEO_LANDING_PAGES.find((page) => page.slug === slug);
}

export type { SeoLandingPageDef };
export { DEFAULT_SEO_SECTION_ORDER };
