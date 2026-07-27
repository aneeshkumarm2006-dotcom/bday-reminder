import type { CtaLink, FaqItem, HowItWorksStep } from "../types";

/**
 * The shape of a keyword-targeted SEO landing page.
 *
 * These pages are *code*, not admin content: each one targets a specific
 * keyword cluster and its copy was written against a brief, so it lives in the
 * repo where it can be reviewed and diffed. Only the SEO metadata is
 * admin-tunable (via `/seoteam/meta`), because that's the part the SEO team
 * iterates on after launch.
 *
 * The design isn't editable here either — a page is pure data, and
 * `components/marketing/seo-landing.tsx` renders it with the same section
 * components the homepage uses. Adding a page is one data file plus a
 * three-line route.
 */

/** Which rendered product shot ("screenshot") illustrates a hero or feature row. */
export type SeoVisual = "app" | "reminder" | "widget";

export interface SeoHero {
  /** Small pill above the ring. Keep it under ~40 characters. */
  badge: string;
  heading: string;
  subheading: string;
  primaryCta: CtaLink;
  /** The line under the buttons, e.g. "Free on web, iOS, and Android…". */
  footnote: string;
  /** One or two product shots below the hero copy, left to right. */
  visuals: SeoVisual[];
}

/**
 * The "why a countdown/calendar/alarm alone isn't enough" band.
 *
 * The heading is stored as five parts because the renderer colours two of them
 * (`muted` grey, `accent` biro) — same trick as the homepage's value prop, so
 * every word stays editable without the design drifting. It renders as:
 * `{lead} {muted}{mid}` + line break + `{accent} {tail}`.
 */
export interface SeoContrast {
  headingParts: {
    lead: string;
    muted: string;
    mid: string;
    accent: string;
    tail: string;
  };
  body: string;
}

/** A headline feature: full-width row beside a rendered product shot. */
export interface SeoFeatureRow {
  id: string;
  /** Must exist in `lib/content/icons.ts` — `isKnownIcon()` is asserted in tests. */
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  preview: SeoVisual;
}

/** A supporting feature: same content, rendered as a card in a grid. */
export interface SeoFeatureCard {
  id: string;
  icon: string;
  title: string;
  body: string;
  /** Optional — a card with no points renders as a plain card. */
  points: string[];
}

export interface SeoFeatures {
  heading: string;
  sub: string;
  /** Exactly three, one per preview ("app", "reminder", "widget"). */
  rows: SeoFeatureRow[];
  cards: SeoFeatureCard[];
}

export interface SeoHowItWorks {
  heading: string;
  steps: HowItWorksStep[];
}

export interface SeoFaq {
  heading: string;
  sub: string;
  /** Rendered as an accordion *and* as FAQPage JSON-LD, from this one list. */
  items: FaqItem[];
}

export interface SeoCta {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  /** Shown under the store badges. */
  footnote: string;
}

export interface SeoLandingPageDef {
  /** URL segment, no leading slash. Must also be in `RESERVED_SLUGS`. */
  slug: string;
  /** Short name for the footer, breadcrumb, and related-pages cards. */
  label: string;
  /** One line describing the page, shown on the related-pages cards. */
  blurb: string;
  /** `<title>`, used verbatim (these pages opt out of the title template). */
  title: string;
  description: string;
  keywords: string[];
  hero: SeoHero;
  contrast: SeoContrast;
  features: SeoFeatures;
  howItWorks: SeoHowItWorks;
  faq: SeoFaq;
  cta: SeoCta;
}
