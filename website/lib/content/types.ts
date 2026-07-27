/**
 * Shared content-model types for the admin panel (the `/seoteam` expansion).
 *
 * These describe the *effective* shape the public site renders — the result of
 * deep-merging a (possibly partial) Mongo document over the hardcoded defaults
 * in `defaults.ts`. Everything here is plain data: safe to import from client
 * components, server components, and the Mongoose models alike.
 */

export interface CtaLink {
  label: string;
  href: string;
}

/* --------------------------------- landing -------------------------------- */

export type SectionType =
  | "hero"
  | "valueProp"
  | "features"
  | "howItWorks"
  | "latestPosts"
  | "faq"
  | "getTheApp";

export interface BaseSection {
  /** Stable id — used for reordering, revisions, and merging over defaults. */
  id: string;
  type: SectionType;
  visible: boolean;
}

export interface HeroSection extends BaseSection {
  type: "hero";
  badge: string;
  heading: string;
  subheading: string;
  primaryCta: CtaLink;
  secondaryCta: CtaLink;
  footnote: string;
}

/**
 * The value-prop heading is a single sentence with two coloured spans, so it's
 * stored as five parts rather than one string — that keeps the design intact
 * while every word stays editable.
 */
export interface ValuePropSection extends BaseSection {
  type: "valueProp";
  headingParts: {
    lead: string;
    muted: string;
    mid: string;
    accent: string;
    tail: string;
  };
  body: string;
}

/** Which rendered product shot sits beside a feature row (or none). */
export type FeaturePreview = "app" | "reminder" | "widget" | "none";

export interface FeatureRow {
  id: string;
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  preview: FeaturePreview;
  reverse: boolean;
}

export interface FeatureCard {
  id: string;
  icon: string;
  title: string;
  body: string;
}

export interface FeaturesSection extends BaseSection {
  type: "features";
  anchor: string;
  heading: string;
  sub: string;
  rows: FeatureRow[];
  cards: FeatureCard[];
}

export interface HowItWorksStep {
  id: string;
  /** Days from today for the step's ring (negative = past, 0 = today). */
  offset: number;
  title: string;
  body: string;
}

export interface HowItWorksSection extends BaseSection {
  type: "howItWorks";
  anchor: string;
  heading: string;
  steps: HowItWorksStep[];
}

export interface LatestPostsSection extends BaseSection {
  type: "latestPosts";
  anchor: string;
  heading: string;
  sub: string;
  ctaLabel: string;
}

export interface FaqItem {
  id: string;
  q: string;
  a: string;
}

export interface FaqSection extends BaseSection {
  type: "faq";
  anchor: string;
  heading: string;
  sub: string;
  items: FaqItem[];
}

export interface GetTheAppSection extends BaseSection {
  type: "getTheApp";
  anchor: string;
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  storeBadges: boolean;
  footnote: string;
}

export type LandingSection =
  | HeroSection
  | ValuePropSection
  | FeaturesSection
  | HowItWorksSection
  | LatestPostsSection
  | FaqSection
  | GetTheAppSection;

export interface LandingVariant {
  sections: LandingSection[];
}

export type ContentVariant = "draft" | "published";

/* ------------------------------ site settings ----------------------------- */

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
  order: number;
}

export interface AnnouncementConfig {
  enabled: boolean;
  text: string;
  linkLabel: string;
  linkHref: string;
  dismissible: boolean;
  /** ISO strings, or null for "no bound". Compared at request time (no cron). */
  startAt: string | null;
  endAt: string | null;
}

export interface StructuredDataConfig {
  organization: {
    enabled: boolean;
    name: string;
    legalName: string;
    logoUrl: string;
    description: string;
    email: string;
  };
  website: { enabled: boolean; name: string; description: string; inLanguage: string };
  softwareApplication: {
    enabled: boolean;
    name: string;
    applicationCategory: string;
    operatingSystem: string;
    price: string;
    priceCurrency: string;
    description: string;
  };
}

export interface SiteSettings {
  identity: {
    name: string;
    tagline: string;
    description: string;
    contactEmail: string;
  };
  seo: {
    /** Next.js title template — must contain `%s`. */
    titleTemplate: string;
    defaultTitle: string;
    defaultDescription: string;
    keywords: string[];
    ogImage: string;
    twitterHandle: string;
    verification: { google: string; bing: string; pinterest: string };
    /** Sitewide noindex kill-switch (danger zone). */
    indexingEnabled: boolean;
  };
  /** IDs only — never raw script blobs (a shared-password admin must not be an XSS vector). */
  analytics: {
    ga4MeasurementId: string;
    gtmContainerId: string;
    metaPixelId: string;
  };
  socials: SocialLink[];
  announcement: AnnouncementConfig;
  robotsExtraDisallows: string[];
  llmsTxtEnabled: boolean;
  structuredData: StructuredDataConfig;
}

/* -------------------------------- page meta ------------------------------- */

export type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface PageMeta {
  path: string;
  title: string;
  description: string;
  keywords: string[];
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  noindex: boolean;
  nofollow: boolean;
  sitemap: { exclude: boolean; changeFrequency: ChangeFrequency; priority: number };
  /** Validated JSON string, rendered through `jsonLdScript()`. */
  customJsonLd: string;
}

/* ------------------------------- navigation ------------------------------- */

export interface NavLink {
  id: string;
  label: string;
  href: string;
  order: number;
  visible: boolean;
  external: boolean;
}

export interface FooterGroup {
  id: string;
  title: string;
  links: NavLink[];
}

export interface NavigationConfig {
  header: {
    links: NavLink[];
    ctas: { show: boolean; signupLabel: string; signupHref: string; loginLabel: string };
  };
  footer: {
    groups: FooterGroup[];
    tagline: string;
    /** Supports the `{year}` and `{name}` tokens. */
    legalLine: string;
  };
}

/* ------------------------------- page builder ----------------------------- */

export type BlockType =
  | "hero"
  | "richText"
  | "featureGrid"
  | "faq"
  | "cta"
  | "imageText"
  | "stats"
  | "testimonials"
  | "comparisonTable"
  | "divider";

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface HeroBlock extends BaseBlock {
  type: "hero";
  eyebrow: string;
  heading: string;
  body: string;
  primaryCta: CtaLink;
  secondaryCta: CtaLink;
}

export interface RichTextBlock extends BaseBlock {
  type: "richText";
  /** Sanitized on write (no iframes/scripts — lib/blog/sanitize.ts policy). */
  html: string;
}

export interface FeatureGridBlock extends BaseBlock {
  type: "featureGrid";
  heading: string;
  sub: string;
  items: { id: string; icon: string; title: string; body: string }[];
}

export interface FaqBlock extends BaseBlock {
  type: "faq";
  heading: string;
  sub: string;
  items: FaqItem[];
}

export interface CtaBlock extends BaseBlock {
  type: "cta";
  heading: string;
  body: string;
  cta: CtaLink;
  footnote: string;
}

export interface ImageTextBlock extends BaseBlock {
  type: "imageText";
  heading: string;
  body: string;
  imageUrl: string;
  imageAlt: string;
  imageSide: "left" | "right";
  cta: CtaLink;
}

export interface StatsBlock extends BaseBlock {
  type: "stats";
  heading: string;
  items: { id: string; value: string; label: string }[];
}

export interface TestimonialsBlock extends BaseBlock {
  type: "testimonials";
  heading: string;
  items: { id: string; quote: string; author: string; role: string }[];
}

export interface ComparisonTableBlock extends BaseBlock {
  type: "comparisonTable";
  heading: string;
  columns: string[];
  rows: { id: string; cells: string[] }[];
}

export interface DividerBlock extends BaseBlock {
  type: "divider";
  label: string;
}

export type PageBlock =
  | HeroBlock
  | RichTextBlock
  | FeatureGridBlock
  | FaqBlock
  | CtaBlock
  | ImageTextBlock
  | StatsBlock
  | TestimonialsBlock
  | ComparisonTableBlock
  | DividerBlock;

export type PageStatus = "draft" | "published";

/** Serialized SitePage as returned by the API / passed into client components. */
export interface SitePage {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  /** Future value = scheduled (read-gated, no cron). */
  publishedAt: string | null;
  blocks: PageBlock[];
  showInSitemap: boolean;
  author: string;
  createdAt: string;
  updatedAt: string;
}

/* --------------------------------- legal ---------------------------------- */

export type LegalDocKey = "privacy" | "terms" | "contact";

export interface LegalDoc {
  key: LegalDocKey;
  title: string;
  intro: string;
  updated: string;
  /** Sanitized rich HTML. */
  html: string;
}

/* -------------------------------- redirects ------------------------------- */

export interface Redirect {
  id: string;
  from: string;
  to: string;
  type: 301 | 302;
  enabled: boolean;
  note: string;
  hits: number;
  lastHitAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotFoundHit {
  id: string;
  path: string;
  count: number;
  lastSeenAt: string;
  referrer: string;
}

/* --------------------------- revisions & audit ---------------------------- */

export type EntityType =
  | "site"
  | "landing"
  | "page"
  | "navigation"
  | "meta"
  | "structured-data"
  | "legal";

export interface ContentRevision {
  id: string;
  entityType: EntityType;
  entityId: string;
  snapshot: unknown;
  savedBy: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: EntityType | "media" | "post";
  entityId: string;
  summary: string;
  editor: string;
  createdAt: string;
}
