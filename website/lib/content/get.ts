import { cache } from "react";

import { connectDb, isDbConfigured } from "@/lib/blog/db";

import {
  DEFAULT_LANDING,
  DEFAULT_LEGAL,
  DEFAULT_NAV,
  DEFAULT_PAGE_META,
  DEFAULT_SETTINGS,
  SECTION_TEMPLATES,
  emptyPageMeta,
} from "./defaults";
import { deepMerge, mergeById } from "./merge";
import {
  LandingContentModel,
  LegalDocModel,
  NavigationConfigModel,
  PageMetaModel,
  SINGLETON,
  SiteSettingsModel,
  SitePageModel,
  type SitePageDoc,
} from "./models";
import type {
  ContentVariant,
  LandingSection,
  LandingVariant,
  LegalDoc,
  LegalDocKey,
  NavigationConfig,
  PageMeta,
  SectionType,
  SitePage,
  SiteSettings,
} from "./types";

/**
 * Every public read of admin-managed content goes through here.
 *
 * Two invariants hold for all of it:
 *   1. **Never throws.** No DB configured, connection refused, malformed doc —
 *      the caller gets the hardcoded defaults, so the marketing site renders.
 *   2. **Deep-merged.** A partial document fills in from `defaults.ts` field by
 *      field (see `merge.ts`), so a half-finished admin edit can't blank a section.
 *
 * Each getter is wrapped in React `cache()`, which dedupes per request — that's
 * what stops `generateMetadata` and the page component from each hitting Mongo.
 */

/** Run a DB read, falling back to `fallback` on any failure (incl. no DB). */
async function safeRead<T>(fallback: T, read: () => Promise<T>): Promise<T> {
  if (!isDbConfigured()) return fallback;
  try {
    await connectDb();
    return await read();
  } catch {
    return fallback;
  }
}

/* ------------------------------ site settings ----------------------------- */

/**
 * Uncached read. Route handlers call this *after* a write: `getSiteSettings` is
 * memoized per request and has usually already run (for the revision snapshot),
 * so it would hand back the pre-save value.
 */
export async function readSiteSettings(): Promise<SiteSettings> {
  return safeRead(DEFAULT_SETTINGS, async () => {
    const doc = await SiteSettingsModel.findOne({ key: SINGLETON }).lean();
    if (!doc) return DEFAULT_SETTINGS;
    return deepMerge(DEFAULT_SETTINGS, doc as unknown as Record<string, unknown>);
  });
}

export const getSiteSettings = cache(readSiteSettings);

/* --------------------------------- landing -------------------------------- */

/** Fill a stored section from the default with the same id, else its type template. */
function sectionTemplate(item: Record<string, unknown>): LandingSection | null {
  const type = item.type as SectionType | undefined;
  if (!type || !(type in SECTION_TEMPLATES)) return null;
  return SECTION_TEMPLATES[type];
}

function mergeLanding(raw: unknown): LandingVariant {
  const sections = mergeById(
    DEFAULT_LANDING.sections,
    (raw as { sections?: unknown } | null)?.sections,
    sectionTemplate,
  );
  return { sections };
}

/**
 * The landing page's section list. `published` is what the public homepage
 * renders; `draft` is what the editor and `/seoteam/preview/landing` render.
 * An untouched draft falls through to the published variant (and from there to
 * the defaults), so the editor always opens on today's live copy.
 */
export const getLandingContent = cache(
  async (variant: ContentVariant = "published"): Promise<LandingVariant> =>
    safeRead(DEFAULT_LANDING, async () => {
      const doc = await LandingContentModel.findOne({ key: SINGLETON }).lean();
      if (!doc) return DEFAULT_LANDING;
      const stored = variant === "draft" ? doc.draft : doc.published;
      const hasSections =
        Array.isArray((stored as { sections?: unknown } | null)?.sections) &&
        ((stored as { sections: unknown[] }).sections.length > 0);
      if (!hasSections) {
        // Never-published (or never-drafted) → show the other variant, which
        // itself falls back to the hardcoded landing page.
        const other = variant === "draft" ? doc.published : doc.draft;
        return mergeLanding(other);
      }
      return mergeLanding(stored);
    }),
);

/* ------------------------------- navigation ------------------------------- */

export const getNavigation = cache(async (): Promise<NavigationConfig> =>
  safeRead(DEFAULT_NAV, async () => {
    const doc = await NavigationConfigModel.findOne({ key: SINGLETON }).lean();
    if (!doc) return DEFAULT_NAV;
    return deepMerge(DEFAULT_NAV, doc as unknown as Record<string, unknown>);
  }),
);

/** Visible header links, ordered. */
export function visibleHeaderLinks(nav: NavigationConfig) {
  return [...nav.header.links]
    .filter((l) => l.visible && l.label.trim() && l.href.trim())
    .sort((a, b) => a.order - b.order);
}

/** Footer groups with their visible links ordered; empty groups dropped. */
export function visibleFooterGroups(nav: NavigationConfig) {
  return nav.footer.groups
    .map((g) => ({
      ...g,
      links: [...g.links]
        .filter((l) => l.visible !== false && l.label.trim() && l.href.trim())
        .sort((a, b) => a.order - b.order),
    }))
    .filter((g) => g.links.length > 0);
}

/* -------------------------------- page meta ------------------------------- */

/** The hardcoded metadata for a route (empty shell for unknown paths). */
export function defaultPageMeta(path: string): PageMeta {
  return DEFAULT_PAGE_META[path] ?? emptyPageMeta(path);
}

/**
 * Effective metadata for one route: the admin's `PageMeta` doc merged over the
 * page's hardcoded defaults. Safe to call from `generateMetadata`.
 */
export const getPageMeta = cache(async (path: string): Promise<PageMeta> => {
  const fallback = defaultPageMeta(path);
  return safeRead(fallback, async () => {
    const doc = await PageMetaModel.findOne({ path }).lean();
    if (!doc) return fallback;
    return deepMerge(fallback, doc as unknown as Record<string, unknown>);
  });
});

/** Every stored override, keyed by path (admin table + sitemap use this). */
export const getAllPageMeta = cache(
  async (): Promise<Record<string, PageMeta>> =>
    safeRead({}, async () => {
      const docs = await PageMetaModel.find({}).lean();
      const out: Record<string, PageMeta> = {};
      for (const doc of docs) {
        const path = String(doc.path);
        out[path] = deepMerge(
          defaultPageMeta(path),
          doc as unknown as Record<string, unknown>,
        );
      }
      return out;
    }),
);

/* ---------------------------------- legal --------------------------------- */

export const getLegalDoc = cache(async (key: LegalDocKey): Promise<LegalDoc> =>
  safeRead(DEFAULT_LEGAL[key], async () => {
    const doc = await LegalDocModel.findOne({ key }).lean();
    if (!doc) return DEFAULT_LEGAL[key];
    return deepMerge(DEFAULT_LEGAL[key], doc as unknown as Record<string, unknown>);
  }),
);

/* ------------------------------- site pages ------------------------------- */

export function serializeSitePage(doc: SitePageDoc): SitePage {
  return {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    status: doc.status,
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : null,
    blocks: (Array.isArray(doc.blocks) ? doc.blocks : []) as SitePage["blocks"],
    showInSitemap: doc.showInSitemap !== false,
    author: doc.author ?? "",
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

/**
 * Match filter for custom pages that are publicly visible *right now* — the
 * same read-gate the blog uses, so scheduling needs no cron and has zero lag on
 * a force-dynamic route. Fresh object per call so `new Date()` is query-time.
 */
export function publishedPageFilter() {
  return {
    status: "published" as const,
    $or: [
      { publishedAt: { $lte: new Date() } },
      { publishedAt: { $exists: false } },
      { publishedAt: null },
    ],
  };
}

export const getPublishedSitePage = cache(
  async (slug: string): Promise<SitePage | null> =>
    safeRead(null as SitePage | null, async () => {
      const doc = await SitePageModel.findOne({
        slug: slug.toLowerCase(),
        ...publishedPageFilter(),
      }).lean();
      return doc ? serializeSitePage(doc as unknown as SitePageDoc) : null;
    }),
);

/** Published + sitemap-eligible pages (slug + updatedAt) for `app/sitemap.ts`. */
export const getPublishedSitePages = cache(
  async (): Promise<{ slug: string; updatedAt: string }[]> =>
    safeRead([] as { slug: string; updatedAt: string }[], async () => {
      const docs = await SitePageModel.find({
        ...publishedPageFilter(),
        showInSitemap: { $ne: false },
      })
        .select("slug updatedAt")
        .lean();
      return (docs as unknown as { slug: string; updatedAt: Date }[]).map((d) => ({
        slug: d.slug,
        updatedAt: new Date(d.updatedAt).toISOString(),
      }));
    }),
);

/** Every custom page (admin table). */
export const getAllSitePages = cache(async (): Promise<SitePage[]> =>
  safeRead([] as SitePage[], async () => {
    const docs = await SitePageModel.find({}).sort({ updatedAt: -1 }).lean();
    return (docs as unknown as SitePageDoc[]).map(serializeSitePage);
  }),
);
