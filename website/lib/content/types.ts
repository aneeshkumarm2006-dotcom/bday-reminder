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

/**
 * A real photograph on a public page — the one image type on this site that
 * isn't drawn from the design system.
 *
 * The rendered product shots carry the product; these carry the *subject*, so
 * that a page about birthday calendars has something for Google Images to index
 * and a reader something to look at between two walls of type. Blank `imageUrl`
 * renders nothing, which is how a page opts out.
 *
 * `width`/`height` are the file's intrinsic pixel size, not a display size:
 * they go straight onto the `<img>` so the browser can reserve the right box
 * before the bytes land (CLS). The admin never types them — the editor measures
 * the image when it's picked — and `0` simply means "unknown", which renders a
 * dimensionless `<img>` exactly as before.
 */
export interface SitePhoto {
  imageUrl: string;
  /** Describes the photo. Empty is a real SEO/a11y gap, never "decorative". */
  imageAlt: string;
  /** Optional line under the image. Visible copy, so it's indexed too. */
  caption: string;
  width: number;
  height: number;
}

/* --------------------------------- landing -------------------------------- */

export type SectionType =
  | "hero"
  | "valueProp"
  | "features"
  | "howItWorks"
  | "latestPosts"
  | "faq"
  | "getTheApp"
  | "blocks"
  | "photo";

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

/** A photograph band on the homepage, between two designed sections. */
export interface PhotoSection extends BaseSection {
  type: "photo";
  anchor: string;
  heading: string;
  sub: string;
  photo: SitePhoto;
}

/**
 * The escape hatch that makes the homepage as modular as a custom page: an
 * ordered list of page-builder blocks, rendered inline among the built-in
 * sections. Add one of these anywhere in the section list and any block —
 * an image, a gallery, raw HTML, a video, a pricing table — can sit between
 * two designed sections without a code change.
 *
 * Declared after `PageBlock` in this file? No: `PageBlock` is defined further
 * down, and TypeScript hoists type declarations, so the forward reference is
 * fine and the landing types stay grouped together.
 */
export interface BlocksSection extends BaseSection {
  type: "blocks";
  anchor: string;
  heading: string;
  sub: string;
  background: BlockBackground;
  blocks: PageBlock[];
}

export type LandingSection =
  | HeroSection
  | ValuePropSection
  | FeaturesSection
  | HowItWorksSection
  | LatestPostsSection
  | FaqSection
  | GetTheAppSection
  | BlocksSection
  | PhotoSection;

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
    alternateName: string;
    /** ISO `YYYY`, `YYYY-MM` or `YYYY-MM-DD`, or "" for unknown. */
    foundingDate: string;
    logoUrl: string;
    description: string;
    email: string;
    contactPoint: {
      enabled: boolean;
      contactType: string;
      /** "" inherits `organization.email`, then `identity.contactEmail`. */
      email: string;
      telephone: string;
    };
  };
  website: { enabled: boolean; name: string; description: string; inLanguage: string };
  /**
   * The product node. Named for the settings key it has always had; the markup it
   * builds is a `WebApplication` (see `site-json-ld.ts`).
   */
  softwareApplication: {
    enabled: boolean;
    name: string;
    applicationCategory: string;
    applicationSubCategory: string;
    operatingSystem: string;
    browserRequirements: string;
    price: string;
    priceCurrency: string;
    description: string;
  };
}

/**
 * The wordmark in the header and footer.
 *
 * Defaults to the drawn ring + the site name (what shipped), but an uploaded
 * logo replaces either or both — so rebranding the public site is a content
 * change rather than an edit to `components/brand.tsx`.
 */
export interface BrandConfig {
  logoUrl: string;
  /** Optional second file used when the viewer is in dark mode. */
  logoDarkUrl: string;
  logoAlt: string;
  /** Rendered height in px (width follows the image's aspect ratio). */
  logoHeight: number;
  showRing: boolean;
  showWordmark: boolean;
  /** Overrides `identity.name` in the wordmark only. */
  wordmark: string;
  faviconUrl: string;
}

/**
 * Public-site appearance. The colours are emitted as CSS custom properties on
 * the marketing shell, overriding the tokens in `globals.css` — so the palette
 * is editable without a deploy, while every component still reads the same
 * `--biro` / `--radius` variables it always did.
 */
export interface AppearanceConfig {
  /** Accent ("biro") in light mode — any CSS colour. Empty keeps the built-in. */
  accent: string;
  /** Accent in dark mode. Empty falls back to `accent`. */
  accentDark: string;
  /** Corner radius for buttons, cards and inputs, in px. 0 = built-in. */
  radius: number;
  /** Which theme a first-time visitor gets. */
  defaultTheme: "system" | "light" | "dark";
  showThemeToggle: boolean;
  /** Turns the fade/slide-in on scroll off site-wide. */
  animations: boolean;
}

export interface StoreBadgeConfig {
  enabled: boolean;
  url: string;
  /** "" uses the platform's own name. */
  label: string;
  /** The small line above the name, e.g. "Download on the". */
  eyebrow: string;
}

export interface AppStoreConfig {
  appStore: StoreBadgeConfig;
  googlePlay: StoreBadgeConfig;
}

/**
 * One row in the rendered product demo — the interactive "screenshots" that
 * carry the homepage's fold and every keyword page's hero.
 *
 * They are drawn from the real design system rather than being raster images,
 * which is what keeps them crisp and theme-aware — but it also meant the sample
 * names, relationships and greeting were hardcoded marketing copy that only a
 * deploy could change. They live here instead.
 */
export interface DemoRow {
  id: string;
  name: string;
  /** The second line in the feed, e.g. "Brother · turns 29". */
  sub: string;
  /** Days from today. 0 draws the filled "today" ring. */
  offset: number;
  pet: boolean;
}

export interface ProductDemoConfig {
  feedTitle: string;
  thisWeekLabel: string;
  thisMonthLabel: string;
  /** The right-hand count on the day itself. */
  todayLabel: string;
  /** Every other row's count. `{n}` is the number of days. */
  inDaysLabel: string;
  /** Drives both the feed and the widget; the widget shows the first three. */
  rows: DemoRow[];
  reminder: {
    headline: string;
    relation: string;
    greeting: string;
    sendLabel: string;
    doneLabel: string;
    undoLabel: string;
    cancelLabel: string;
    deliveredLabel: string;
    againLabel: string;
  };
  widgetTitle: string;
}

export interface SiteSettings {
  identity: {
    name: string;
    tagline: string;
    description: string;
    contactEmail: string;
  };
  brand: BrandConfig;
  appearance: AppearanceConfig;
  appStores: AppStoreConfig;
  productDemo: ProductDemoConfig;
  seo: {
    /** Next.js title template — must contain `%s`. */
    titleTemplate: string;
    defaultTitle: string;
    defaultDescription: string;
    keywords: string[];
    ogImage: string;
    /** Big line on the generated OG card. Only used when `ogImage` is blank. */
    ogHeadline: string;
    /** The line beneath it on the generated card. */
    ogSubline: string;
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
  | "divider"
  | "image"
  | "gallery"
  | "html"
  | "video"
  | "buttons"
  | "spacer"
  | "logos"
  | "steps"
  | "pricing"
  | "quote"
  | "banner";

/** How wide a block's content sits in the page column. */
export type BlockWidth = "narrow" | "wide" | "full";

/** The band a block paints behind itself. */
export type BlockBackground = "none" | "sunken" | "tint";

export type ButtonVariant = "primary" | "secondary" | "ghost";

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

/* ---------- media, embed and layout blocks (the "anything" set) ---------- */

export interface ImageBlock extends BaseBlock {
  type: "image";
  imageUrl: string;
  imageAlt: string;
  caption: string;
  width: BlockWidth;
  rounded: boolean;
  /** Optional link wrapped around the image. */
  href: string;
}

export interface GalleryItem {
  id: string;
  imageUrl: string;
  imageAlt: string;
  caption: string;
  href: string;
}

export interface GalleryBlock extends BaseBlock {
  type: "gallery";
  heading: string;
  sub: string;
  columns: 2 | 3 | 4;
  items: GalleryItem[];
}

/**
 * Free-form HTML, for anything the typed blocks don't cover.
 *
 * Sanitized on write with `sanitizeEmbedHtml` — a deliberately wider policy
 * than the blog's (tables, spans, divs, classes, inline styles, and iframes
 * from an embed allowlist) but still no `<script>`, no event handlers, and no
 * `javascript:` URLs. See `lib/content/sanitize-embed.ts`.
 */
export interface HtmlBlock extends BaseBlock {
  type: "html";
  html: string;
  width: BlockWidth;
  background: BlockBackground;
}

export interface VideoBlock extends BaseBlock {
  type: "video";
  heading: string;
  /** YouTube / Vimeo page URL, or a direct .mp4/.webm file. */
  url: string;
  caption: string;
  width: BlockWidth;
  /** Poster image for a direct video file. */
  posterUrl: string;
}

export interface ButtonItem {
  id: string;
  label: string;
  href: string;
  variant: ButtonVariant;
  external: boolean;
}

export interface ButtonsBlock extends BaseBlock {
  type: "buttons";
  heading: string;
  align: "left" | "center";
  items: ButtonItem[];
}

export interface SpacerBlock extends BaseBlock {
  type: "spacer";
  size: "sm" | "md" | "lg" | "xl";
  /** Draw a hairline in the middle of the space. */
  rule: boolean;
}

export interface LogoItem {
  id: string;
  imageUrl: string;
  imageAlt: string;
  href: string;
}

export interface LogosBlock extends BaseBlock {
  type: "logos";
  heading: string;
  items: LogoItem[];
  grayscale: boolean;
}

export interface StepItem {
  id: string;
  icon: string;
  title: string;
  body: string;
}

export interface StepsBlock extends BaseBlock {
  type: "steps";
  heading: string;
  sub: string;
  numbered: boolean;
  items: StepItem[];
}

export interface PricingTier {
  id: string;
  name: string;
  price: string;
  period: string;
  body: string;
  features: string[];
  cta: CtaLink;
  highlight: boolean;
}

export interface PricingBlock extends BaseBlock {
  type: "pricing";
  heading: string;
  sub: string;
  tiers: PricingTier[];
}

export interface QuoteBlock extends BaseBlock {
  type: "quote";
  quote: string;
  author: string;
  role: string;
  imageUrl: string;
}

export interface BannerBlock extends BaseBlock {
  type: "banner";
  tone: "info" | "success" | "warning" | "danger";
  icon: string;
  heading: string;
  body: string;
  cta: CtaLink;
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
  | DividerBlock
  | ImageBlock
  | GalleryBlock
  | HtmlBlock
  | VideoBlock
  | ButtonsBlock
  | SpacerBlock
  | LogosBlock
  | StepsBlock
  | PricingBlock
  | QuoteBlock
  | BannerBlock;

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

/* ------------------------------ built-in pages ---------------------------- */

/**
 * Copy for the routes that are *code*, not documents — the blog index, a blog
 * post's furniture, the 404, and the extras on the contact page.
 *
 * Every one of them used to be a hardcoded string in a route file. They live in
 * one singleton so the admin has a single "Built-in pages" screen, and each
 * carries `blocksBefore` / `blocksAfter` so images, HTML, or any other block can
 * be dropped onto a page whose body is generated rather than authored.
 */
export interface BlogIndexConfig {
  heading: string;
  intro: string;
  /** Shown when the blog has no posts yet. */
  emptyText: string;
  /** Shown when the database is unreachable. */
  errorText: string;
  guidesHeading: string;
  /** Supports the `{count}` token. */
  guidesSub: string;
  showGuides: boolean;
  blocksBefore: PageBlock[];
  blocksAfter: PageBlock[];
}

export interface BlogPostConfig {
  /** Label on the "every post" link under the related list. */
  allPostsLabel: string;
  relatedHeading: string;
  showRelated: boolean;
  /** The two breadcrumb labels above a post's title. */
  breadcrumbHome: string;
  breadcrumbBlog: string;
  /** Suffix on the reading-time estimate, e.g. "min read". */
  readingTimeLabel: string;
  /** Appended under every post's body, above the related strip. */
  blocksAfter: PageBlock[];
}

export interface NotFoundConfig {
  eyebrow: string;
  heading: string;
  body: string;
  primaryCta: CtaLink;
  secondaryCta: CtaLink;
  blocksAfter: PageBlock[];
}

export interface ContactPageConfig {
  cardEnabled: boolean;
  cardHeading: string;
  cardBody: string;
  cardIcon: string;
  blocksAfter: PageBlock[];
}

export interface BuiltInPages {
  blogIndex: BlogIndexConfig;
  blogPost: BlogPostConfig;
  notFound: NotFoundConfig;
  contact: ContactPageConfig;
}

export type BuiltInPageKey = keyof BuiltInPages;

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
  | "built-in"
  | "landing"
  | "page"
  | "seo-page"
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
