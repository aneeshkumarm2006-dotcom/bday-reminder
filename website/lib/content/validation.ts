import { z } from "zod";

import { isReservedSlug } from "./reserved-slugs";
import { ICON_NAMES } from "./icons";

/**
 * Zod schemas for every admin payload. Validation happens in the route handler
 * *before* anything reaches Mongo — the shared-password admin is trusted-ish,
 * but "trusted-ish" is exactly the threat model that needs a schema (a stray
 * `javascript:` href or a 5 MB blocks array is a real risk, not a theoretical one).
 *
 * Two house rules carried over from `lib/blog/validation.ts`:
 *   - no `.url()` / `.datetime()` (their behaviour varies across zod majors) —
 *     hand-rolled refinements instead;
 *   - every field carries a `.default()`, so a stored document is always
 *     complete and the read-time deep-merge only has to handle legacy/garbage.
 */

/* --------------------------------- helpers -------------------------------- */

const MAX_HTML = 200_000;

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** A link the site may render: internal path, anchor, mailto/tel, or http(s). */
const linkHref = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (v) =>
      v === "" ||
      v.startsWith("/") ||
      v.startsWith("#") ||
      /^(mailto:|tel:)/i.test(v) ||
      isHttpUrl(v),
    { message: "Links must be an internal path, an anchor, mailto/tel, or an http(s) URL." },
  );

/** Redirect targets are stricter: internal path or https URL only. */
const redirectTarget = z
  .string()
  .trim()
  .min(1, "A target is required.")
  .max(2048)
  .refine((v) => v.startsWith("/") || /^https:\/\//i.test(v), {
    message: "Redirect targets must be an internal path or an https:// URL.",
  });

/** Image URL: empty, http(s), or a Cloudinary/absolute path. */
const imageUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || v.startsWith("/") || isHttpUrl(v), {
    message: "Images must be an http(s) URL or an absolute path.",
  });

const iconName = z
  .string()
  .trim()
  .max(60)
  .refine((v) => v === "" || ICON_NAMES.includes(v), {
    message: "Pick an icon from the list.",
  })
  .default("Sparkles");

/** Nullable ISO-ish date string ("" and null both mean "unset"). */
const nullableDate = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), {
    message: "Enter a valid date.",
  })
  .nullable()
  .transform((v) => (v === "" ? null : v));

const idString = z.string().trim().min(1).max(80);

const cta = z
  .object({
    label: z.string().trim().max(80).default(""),
    href: linkHref.default("/"),
  })
  .default({ label: "", href: "/" });

/** Normalize an incoming path to the stored form: leading slash, no trailing slash. */
export function normalizePath(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "/";
  let path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  path = path.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  return path || "/";
}

const routePath = z
  .string()
  .trim()
  .min(1, "A path is required.")
  .max(512)
  .transform(normalizePath);

/* ----------------------------- site settings ------------------------------ */

export const socialLinkSchema = z.object({
  id: idString,
  platform: z.string().trim().max(60).default(""),
  url: linkHref.default(""),
  order: z.number().int().min(0).max(999).default(0),
});

export const structuredDataSchema = z.object({
  organization: z
    .object({
      enabled: z.boolean().default(true),
      name: z.string().trim().max(200).default(""),
      legalName: z.string().trim().max(200).default(""),
      logoUrl: imageUrl.default(""),
      description: z.string().trim().max(1000).default(""),
      email: z.string().trim().max(200).default(""),
    })
    .prefault({}),
  website: z
    .object({
      enabled: z.boolean().default(true),
      name: z.string().trim().max(200).default(""),
      description: z.string().trim().max(1000).default(""),
      inLanguage: z.string().trim().max(20).default("en-US"),
    })
    .prefault({}),
  softwareApplication: z
    .object({
      enabled: z.boolean().default(true),
      name: z.string().trim().max(200).default(""),
      applicationCategory: z.string().trim().max(120).default(""),
      operatingSystem: z.string().trim().max(120).default(""),
      price: z.string().trim().max(20).default("0"),
      priceCurrency: z.string().trim().max(10).default("USD"),
      description: z.string().trim().max(1000).default(""),
    })
    .prefault({}),
});

/**
 * Analytics is IDs only — never a raw `<script>` textarea. The IDs are
 * interpolated into a fixed `<Script>` template, and the format guards below
 * keep even that interpolation free of anything script-shaped.
 */
export const siteSettingsSchema = z.object({
  identity: z
    .object({
      name: z.string().trim().max(120).default(""),
      tagline: z.string().trim().max(200).default(""),
      description: z.string().trim().max(1000).default(""),
      contactEmail: z.string().trim().max(200).default(""),
    })
    .prefault({}),
  seo: z
    .object({
      titleTemplate: z
        .string()
        .trim()
        .max(200)
        .refine((v) => v === "" || v.includes("%s"), {
          message: "The title template must contain %s.",
        })
        .default(""),
      defaultTitle: z.string().trim().max(200).default(""),
      defaultDescription: z.string().trim().max(500).default(""),
      keywords: z.array(z.string().trim().max(120)).max(50).default([]),
      ogImage: imageUrl.default(""),
      twitterHandle: z.string().trim().max(60).default(""),
      verification: z
        .object({
          google: z.string().trim().max(200).default(""),
          bing: z.string().trim().max(200).default(""),
          pinterest: z.string().trim().max(200).default(""),
        })
        .prefault({}),
      indexingEnabled: z.boolean().default(true),
    })
    .prefault({}),
  analytics: z
    .object({
      ga4MeasurementId: z
        .string()
        .trim()
        .max(40)
        .refine((v) => v === "" || /^G-[A-Z0-9]+$/i.test(v), {
          message: "A GA4 measurement ID looks like G-XXXXXXX.",
        })
        .default(""),
      gtmContainerId: z
        .string()
        .trim()
        .max(40)
        .refine((v) => v === "" || /^GTM-[A-Z0-9]+$/i.test(v), {
          message: "A GTM container ID looks like GTM-XXXXXX.",
        })
        .default(""),
      metaPixelId: z
        .string()
        .trim()
        .max(40)
        .refine((v) => v === "" || /^\d{8,20}$/.test(v), {
          message: "A Meta Pixel ID is a 8–20 digit number.",
        })
        .default(""),
    })
    .prefault({}),
  socials: z.array(socialLinkSchema).max(20).default([]),
  announcement: z
    .object({
      enabled: z.boolean().default(false),
      text: z.string().trim().max(300).default(""),
      linkLabel: z.string().trim().max(80).default(""),
      linkHref: linkHref.default(""),
      dismissible: z.boolean().default(true),
      startAt: nullableDate.default(null),
      endAt: nullableDate.default(null),
    })
    .prefault({}),
  robotsExtraDisallows: z
    .array(z.string().trim().max(200).transform(normalizePath))
    .max(100)
    .default([]),
  llmsTxtEnabled: z.boolean().default(false),
  structuredData: structuredDataSchema.prefault({}),
});

/* --------------------------------- landing -------------------------------- */

const heroSection = z.object({
  id: idString,
  type: z.literal("hero"),
  visible: z.boolean().default(true),
  badge: z.string().trim().max(120).default(""),
  heading: z.string().trim().max(200).default(""),
  subheading: z.string().trim().max(600).default(""),
  primaryCta: cta,
  secondaryCta: cta,
  footnote: z.string().trim().max(200).default(""),
});

const valuePropSection = z.object({
  id: idString,
  type: z.literal("valueProp"),
  visible: z.boolean().default(true),
  headingParts: z
    .object({
      lead: z.string().trim().max(200).default(""),
      muted: z.string().trim().max(120).default(""),
      // Untrimmed for the same reason as the SEO pages' contrast heading: the
      // renderer emits `{muted}{mid}` with no separator, so a `mid` that starts
      // with a word rather than punctuation needs its leading space kept.
      mid: z.string().max(200).default(""),
      accent: z.string().trim().max(120).default(""),
      tail: z.string().trim().max(200).default(""),
    })
    .prefault({}),
  body: z.string().trim().max(800).default(""),
});

const featureRow = z.object({
  id: idString,
  icon: iconName,
  eyebrow: z.string().trim().max(120).default(""),
  title: z.string().trim().max(200).default(""),
  body: z.string().trim().max(900).default(""),
  points: z.array(z.string().trim().max(240)).max(12).default([]),
  preview: z.enum(["app", "reminder", "widget", "none"]).default("none"),
  reverse: z.boolean().default(false),
});

const featureCard = z.object({
  id: idString,
  icon: iconName,
  title: z.string().trim().max(200).default(""),
  body: z.string().trim().max(600).default(""),
});

const featuresSection = z.object({
  id: idString,
  type: z.literal("features"),
  visible: z.boolean().default(true),
  anchor: z.string().trim().max(60).default("features"),
  heading: z.string().trim().max(200).default(""),
  sub: z.string().trim().max(600).default(""),
  rows: z.array(featureRow).max(12).default([]),
  cards: z.array(featureCard).max(24).default([]),
});

const howItWorksSection = z.object({
  id: idString,
  type: z.literal("howItWorks"),
  visible: z.boolean().default(true),
  anchor: z.string().trim().max(60).default("how"),
  heading: z.string().trim().max(200).default(""),
  steps: z
    .array(
      z.object({
        id: idString,
        offset: z.number().int().min(-365).max(365).default(0),
        title: z.string().trim().max(200).default(""),
        body: z.string().trim().max(600).default(""),
      }),
    )
    .max(8)
    .default([]),
});

const latestPostsSection = z.object({
  id: idString,
  type: z.literal("latestPosts"),
  visible: z.boolean().default(true),
  anchor: z.string().trim().max(60).default("blog"),
  heading: z.string().trim().max(200).default(""),
  sub: z.string().trim().max(600).default(""),
  ctaLabel: z.string().trim().max(80).default(""),
});

const faqItem = z.object({
  id: idString,
  q: z.string().trim().max(300).default(""),
  a: z.string().trim().max(2000).default(""),
});

const faqSection = z.object({
  id: idString,
  type: z.literal("faq"),
  visible: z.boolean().default(true),
  anchor: z.string().trim().max(60).default("faq"),
  heading: z.string().trim().max(200).default(""),
  sub: z.string().trim().max(600).default(""),
  items: z.array(faqItem).max(50).default([]),
});

const getTheAppSection = z.object({
  id: idString,
  type: z.literal("getTheApp"),
  visible: z.boolean().default(true),
  anchor: z.string().trim().max(60).default("get-the-app"),
  heading: z.string().trim().max(200).default(""),
  body: z.string().trim().max(600).default(""),
  ctaLabel: z.string().trim().max(80).default(""),
  ctaHref: linkHref.default("/signup"),
  storeBadges: z.boolean().default(true),
  footnote: z.string().trim().max(200).default(""),
});

export const landingSectionSchema = z.discriminatedUnion("type", [
  heroSection,
  valuePropSection,
  featuresSection,
  howItWorksSection,
  latestPostsSection,
  faqSection,
  getTheAppSection,
]);

export const landingVariantSchema = z.object({
  sections: z.array(landingSectionSchema).max(30).default([]),
});

export const saveLandingSchema = z.object({
  sections: z.array(landingSectionSchema).max(30),
  /** "draft" saves; "publish" copies the incoming draft into `published` too. */
  mode: z.enum(["draft", "publish"]).default("draft"),
});

/* ---------------------------- seo landing pages --------------------------- */

/**
 * The editable shape of a keyword landing page (`lib/content/seo-pages/`).
 *
 * Note what's *absent*: `slug`. The route is a real file, so the slug is the
 * key, never a payload field — an editor rewriting the copy must not be able to
 * move the page out from under its own URL.
 *
 * Every field defaults, as everywhere else here, because the stored document is
 * a partial override deep-merged over the page's built-in copy: a blanked field
 * falls back to what shipped rather than rendering an empty section.
 */
const seoVisual = z.enum(["app", "reminder", "widget"]);

const seoFeatureRow = z.object({
  id: idString,
  icon: iconName,
  eyebrow: z.string().trim().max(120).default(""),
  title: z.string().trim().max(200).default(""),
  body: z.string().trim().max(900).default(""),
  points: z.array(z.string().trim().max(240)).max(12).default([]),
  preview: seoVisual.default("app"),
});

const seoFeatureCard = z.object({
  id: idString,
  icon: iconName,
  title: z.string().trim().max(200).default(""),
  body: z.string().trim().max(900).default(""),
  points: z.array(z.string().trim().max(240)).max(12).default([]),
});

export const seoPageContentSchema = z.object({
  label: z.string().trim().max(80).default(""),
  blurb: z.string().trim().max(240).default(""),
  title: z.string().trim().max(200).default(""),
  description: z.string().trim().max(500).default(""),
  keywords: z.array(z.string().trim().max(120)).max(50).default([]),
  hero: z
    .object({
      badge: z.string().trim().max(120).default(""),
      heading: z.string().trim().max(200).default(""),
      subheading: z.string().trim().max(600).default(""),
      primaryCta: cta,
      footnote: z.string().trim().max(200).default(""),
      // At least one product shot, at most two — the hero layout has room for
      // exactly that, and an empty array would render a blank band.
      visuals: z.array(seoVisual).min(1).max(2).default(["app"]),
    })
    .prefault({}),
  // Optional because only a file-intent page has one (see `SeoDownload`). It's
  // `.optional()` rather than `.prefault({})` on purpose: prefaulting would
  // conjure an empty download band onto the other six pages the first time one
  // of them was saved.
  download: z
    .object({
      heading: z.string().trim().max(200).default(""),
      body: z.string().trim().max(800).default(""),
      href: linkHref.default(""),
      ctaLabel: z.string().trim().max(80).default(""),
      fileName: z.string().trim().max(120).default(""),
      meta: z.string().trim().max(120).default(""),
      points: z.array(z.string().trim().max(240)).max(12).default([]),
      secondaryCta: cta,
    })
    .optional(),
  contrast: z
    .object({
      headingParts: z
        .object({
          lead: z.string().trim().max(200).default(""),
          muted: z.string().trim().max(120).default(""),
          // Deliberately NOT trimmed. The renderer joins `{muted}{mid}` with no
          // space between them, so that `mid` can start with punctuation (". The
          // point is to"). A heading that continues with a word instead has to
          // carry its own leading space — trimming it would silently glue two
          // words together the first time the page was saved.
          mid: z.string().max(200).default(""),
          accent: z.string().trim().max(120).default(""),
          tail: z.string().trim().max(200).default(""),
        })
        .prefault({}),
      body: z.string().trim().max(800).default(""),
    })
    .prefault({}),
  features: z
    .object({
      heading: z.string().trim().max(200).default(""),
      sub: z.string().trim().max(600).default(""),
      rows: z.array(seoFeatureRow).max(6).default([]),
      cards: z.array(seoFeatureCard).max(24).default([]),
    })
    .prefault({}),
  howItWorks: z
    .object({
      heading: z.string().trim().max(200).default(""),
      steps: z
        .array(
          z.object({
            id: idString,
            offset: z.number().int().min(-365).max(365).default(0),
            title: z.string().trim().max(200).default(""),
            body: z.string().trim().max(600).default(""),
          }),
        )
        .max(8)
        .default([]),
    })
    .prefault({}),
  faq: z
    .object({
      heading: z.string().trim().max(200).default(""),
      sub: z.string().trim().max(600).default(""),
      items: z.array(faqItem).max(50).default([]),
    })
    .prefault({}),
  cta: z
    .object({
      heading: z.string().trim().max(200).default(""),
      body: z.string().trim().max(600).default(""),
      ctaLabel: z.string().trim().max(80).default(""),
      ctaHref: linkHref.default("/signup"),
      footnote: z.string().trim().max(200).default(""),
    })
    .prefault({}),
});

export const saveSeoPageSchema = z.object({
  content: seoPageContentSchema,
  /** "draft" saves; "publish" copies the incoming draft into `published` too. */
  mode: z.enum(["draft", "publish"]).default("draft"),
});

/* -------------------------------- page meta ------------------------------- */

const JSON_LD_TYPES = new Set([
  "Article",
  "BlogPosting",
  "BreadcrumbList",
  "Course",
  "Event",
  "FAQPage",
  "HowTo",
  "ItemList",
  "LocalBusiness",
  "Organization",
  "Person",
  "Product",
  "Question",
  "Recipe",
  "Review",
  "SoftwareApplication",
  "VideoObject",
  "WebApplication",
  "WebPage",
  "WebSite",
]);

/**
 * Custom JSON-LD is parsed, then every `@type` in the tree is checked against
 * an allowlist. Rendering still goes through `jsonLdScript()` (which escapes
 * `</script>`), so this is the second of two locks, not the only one.
 */
export function validateJsonLd(raw: string): { ok: true } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: true };
  if (value.length > 20_000) return { ok: false, error: "JSON-LD is too large (20 KB max)." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { ok: false, error: "That isn't valid JSON." };
  }
  const bad: string[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const rec = node as Record<string, unknown>;
    const type = rec["@type"];
    for (const t of Array.isArray(type) ? type : [type]) {
      if (typeof t === "string" && !JSON_LD_TYPES.has(t)) bad.push(t);
    }
    Object.values(rec).forEach(walk);
  };
  walk(parsed);
  if (bad.length > 0) {
    return { ok: false, error: `Unsupported @type: ${[...new Set(bad)].join(", ")}.` };
  }
  return { ok: true };
}

const customJsonLd = z
  .string()
  .max(20_000)
  .default("")
  .refine((v) => validateJsonLd(v).ok, {
    message: "Custom JSON-LD must be valid JSON using a supported @type.",
  });

export const pageMetaSchema = z.object({
  path: routePath,
  title: z.string().trim().max(200).default(""),
  description: z.string().trim().max(500).default(""),
  keywords: z.array(z.string().trim().max(120)).max(50).default([]),
  canonical: linkHref.default(""),
  ogTitle: z.string().trim().max(200).default(""),
  ogDescription: z.string().trim().max(500).default(""),
  ogImage: imageUrl.default(""),
  twitterTitle: z.string().trim().max(200).default(""),
  twitterDescription: z.string().trim().max(500).default(""),
  noindex: z.boolean().default(false),
  nofollow: z.boolean().default(false),
  sitemap: z
    .object({
      exclude: z.boolean().default(false),
      changeFrequency: z
        .enum(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"])
        .default("monthly"),
      priority: z.number().min(0).max(1).default(0.5),
    })
    .prefault({}),
  customJsonLd,
});

/* ------------------------------- navigation ------------------------------- */

const navLinkSchema = z.object({
  id: idString,
  label: z.string().trim().max(80).default(""),
  href: linkHref.default("/"),
  order: z.number().int().min(0).max(999).default(0),
  visible: z.boolean().default(true),
  external: z.boolean().default(false),
});

export const navigationSchema = z.object({
  header: z
    .object({
      links: z.array(navLinkSchema).max(20).default([]),
      ctas: z
        .object({
          show: z.boolean().default(true),
          signupLabel: z.string().trim().max(60).default(""),
          signupHref: linkHref.default("/signup"),
          loginLabel: z.string().trim().max(60).default(""),
        })
        .prefault({}),
    })
    .prefault({}),
  footer: z
    .object({
      groups: z
        .array(
          z.object({
            id: idString,
            title: z.string().trim().max(80).default(""),
            links: z.array(navLinkSchema).max(20).default([]),
          }),
        )
        .max(8)
        .default([]),
      tagline: z.string().trim().max(240).default(""),
      legalLine: z.string().trim().max(240).default(""),
    })
    .prefault({}),
});

/* ------------------------------- page builder ----------------------------- */

const blockSchemas = [
  z.object({
    id: idString,
    type: z.literal("hero"),
    eyebrow: z.string().trim().max(120).default(""),
    heading: z.string().trim().max(200).default(""),
    body: z.string().trim().max(900).default(""),
    primaryCta: cta,
    secondaryCta: cta,
  }),
  z.object({
    id: idString,
    type: z.literal("richText"),
    html: z.string().max(MAX_HTML).default(""),
  }),
  z.object({
    id: idString,
    type: z.literal("featureGrid"),
    heading: z.string().trim().max(200).default(""),
    sub: z.string().trim().max(600).default(""),
    items: z
      .array(
        z.object({
          id: idString,
          icon: iconName,
          title: z.string().trim().max(200).default(""),
          body: z.string().trim().max(600).default(""),
        }),
      )
      .max(24)
      .default([]),
  }),
  z.object({
    id: idString,
    type: z.literal("faq"),
    heading: z.string().trim().max(200).default(""),
    sub: z.string().trim().max(600).default(""),
    items: z.array(faqItem).max(50).default([]),
  }),
  z.object({
    id: idString,
    type: z.literal("cta"),
    heading: z.string().trim().max(200).default(""),
    body: z.string().trim().max(600).default(""),
    cta,
    footnote: z.string().trim().max(200).default(""),
  }),
  z.object({
    id: idString,
    type: z.literal("imageText"),
    heading: z.string().trim().max(200).default(""),
    body: z.string().trim().max(900).default(""),
    imageUrl: imageUrl.default(""),
    imageAlt: z.string().trim().max(200).default(""),
    imageSide: z.enum(["left", "right"]).default("left"),
    cta,
  }),
  z.object({
    id: idString,
    type: z.literal("stats"),
    heading: z.string().trim().max(200).default(""),
    items: z
      .array(
        z.object({
          id: idString,
          value: z.string().trim().max(40).default(""),
          label: z.string().trim().max(120).default(""),
        }),
      )
      .max(12)
      .default([]),
  }),
  z.object({
    id: idString,
    type: z.literal("testimonials"),
    heading: z.string().trim().max(200).default(""),
    items: z
      .array(
        z.object({
          id: idString,
          quote: z.string().trim().max(900).default(""),
          author: z.string().trim().max(120).default(""),
          role: z.string().trim().max(120).default(""),
        }),
      )
      .max(12)
      .default([]),
  }),
  z.object({
    id: idString,
    type: z.literal("comparisonTable"),
    heading: z.string().trim().max(200).default(""),
    columns: z.array(z.string().trim().max(80)).max(6).default([]),
    rows: z
      .array(
        z.object({
          id: idString,
          cells: z.array(z.string().trim().max(200)).max(6).default([]),
        }),
      )
      .max(30)
      .default([]),
  }),
  z.object({
    id: idString,
    type: z.literal("divider"),
    label: z.string().trim().max(120).default(""),
  }),
] as const;

export const pageBlockSchema = z.discriminatedUnion("type", [...blockSchemas]);

const pageSlug = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .refine((v) => v === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v), {
    message: "Slugs may only contain lowercase letters, numbers, and hyphens.",
  })
  .refine((v) => v === "" || !isReservedSlug(v), {
    message: "That slug is reserved by an existing page.",
  });

export const createSitePageSchema = z.object({
  title: z.string().trim().min(1, "A title is required.").max(200),
  slug: pageSlug.default(""),
  status: z.enum(["draft", "published"]).default("draft"),
  publishedAt: nullableDate.optional(),
  blocks: z.array(pageBlockSchema).max(60).default([]),
  showInSitemap: z.boolean().default(true),
  author: z.string().trim().max(120).default(""),
});

export const updateSitePageSchema = createSitePageSchema.partial();

/* -------------------------------- redirects ------------------------------- */

export const redirectSchema = z
  .object({
    from: routePath,
    to: redirectTarget,
    type: z.union([z.literal(301), z.literal(302)]).default(301),
    enabled: z.boolean().default(true),
    note: z.string().trim().max(240).default(""),
  })
  .refine((v) => normalizePath(v.from) !== v.to.trim(), {
    message: "A redirect can't point at itself.",
    path: ["to"],
  });

export const updateRedirectSchema = z.object({
  from: routePath.optional(),
  to: redirectTarget.optional(),
  type: z.union([z.literal(301), z.literal(302)]).optional(),
  enabled: z.boolean().optional(),
  note: z.string().trim().max(240).optional(),
});

/* ---------------------------------- legal --------------------------------- */

export const legalDocSchema = z.object({
  key: z.enum(["privacy", "terms", "contact"]),
  title: z.string().trim().max(200).default(""),
  intro: z.string().trim().max(1000).default(""),
  updated: z.string().trim().max(80).default(""),
  html: z.string().max(MAX_HTML).default(""),
});

/* ------------------------------ export / import --------------------------- */

export const importBundleSchema = z.object({
  version: z.number().int().min(1).max(1).default(1),
  settings: siteSettingsSchema.optional(),
  landing: landingVariantSchema.optional(),
  navigation: navigationSchema.optional(),
  meta: z.array(pageMetaSchema).max(500).optional(),
  pages: z.array(createSitePageSchema).max(500).optional(),
  // Keyed by slug, since the route files — not the bundle — own which pages exist.
  seoPages: z
    .array(z.object({ slug: z.string().trim().max(120), content: seoPageContentSchema }))
    .max(50)
    .optional(),
  redirects: z.array(redirectSchema).max(1000).optional(),
  legal: z.array(legalDocSchema).max(10).optional(),
});

export type SiteSettingsBody = z.infer<typeof siteSettingsSchema>;
export type SaveLandingBody = z.infer<typeof saveLandingSchema>;
export type SeoPageContentBody = z.infer<typeof seoPageContentSchema>;
export type SaveSeoPageBody = z.infer<typeof saveSeoPageSchema>;
export type PageMetaBody = z.infer<typeof pageMetaSchema>;
export type NavigationBody = z.infer<typeof navigationSchema>;
export type CreateSitePageBody = z.infer<typeof createSitePageSchema>;
export type UpdateSitePageBody = z.infer<typeof updateSitePageSchema>;
export type RedirectBody = z.infer<typeof redirectSchema>;
export type LegalDocBody = z.infer<typeof legalDocSchema>;
export type ImportBundle = z.infer<typeof importBundleSchema>;
