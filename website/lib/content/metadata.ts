import type { Metadata } from "next";

import { defaultPageMeta, getPageMeta, getSeoPageContent, getSiteSettings } from "./get";
import type { PageMeta, SiteSettings } from "./types";

/**
 * Turn a route's effective `PageMeta` into a Next.js `Metadata` object.
 *
 * Precedence, highest first: the page's own override → the page's hardcoded
 * default (already merged in by `getPageMeta`) → the sitewide SEO defaults from
 * Site settings. Anything still empty is omitted entirely so the root layout's
 * value survives — returning `""` would blank it instead.
 *
 * Indexability is an AND: a page is indexed only when the site-wide switch is
 * on *and* the page isn't marked noindex. That way the danger-zone kill-switch
 * can't be defeated by a per-page setting.
 */
export function buildPageMetadata(
  meta: PageMeta,
  settings: SiteSettings,
  options: { absoluteTitle?: boolean } = {},
): Metadata {
  const title = meta.title.trim();
  const description = meta.description.trim() || undefined;
  const ogTitle = meta.ogTitle.trim() || title;
  const ogDescription = meta.ogDescription.trim() || description;
  const ogImage = meta.ogImage.trim() || settings.seo.ogImage.trim();
  const twitterTitle = meta.twitterTitle.trim() || ogTitle;
  const twitterDescription = meta.twitterDescription.trim() || ogDescription;

  const indexable = settings.seo.indexingEnabled && !meta.noindex;
  const followable = settings.seo.indexingEnabled && !meta.nofollow;

  return {
    ...(title
      ? { title: options.absoluteTitle ? { absolute: title } : title }
      : {}),
    ...(description ? { description } : {}),
    ...(meta.keywords.length > 0 ? { keywords: meta.keywords } : {}),
    alternates: { canonical: meta.canonical.trim() || meta.path },
    openGraph: {
      ...(ogTitle ? { title: ogTitle } : {}),
      ...(ogDescription ? { description: ogDescription } : {}),
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
      url: meta.path,
    },
    twitter: {
      ...(twitterTitle ? { title: twitterTitle } : {}),
      ...(twitterDescription ? { description: twitterDescription } : {}),
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    robots: {
      index: indexable,
      follow: followable,
      ...(indexable && followable
        ? {}
        : { googleBot: { index: indexable, follow: followable } }),
    },
  };
}

/**
 * One-line `generateMetadata` for any admin-managed route. Both reads are
 * memoized by React `cache()`, so a page that also renders content shares the
 * same two DB round-trips rather than doubling them.
 */
export async function metadataForPath(
  path: string,
  options: { absoluteTitle?: boolean } = {},
): Promise<Metadata> {
  const [meta, settings] = await Promise.all([getPageMeta(path), getSiteSettings()]);
  return buildPageMetadata(meta, settings, options);
}

/**
 * True when the Page SEO screen actually set this field. `getPageMeta` has
 * already collapsed the override into the route's shipped default, so "still
 * byte-identical to what shipped" is the only signal left for "untouched".
 */
function isTuned(effective: string | string[], shipped: string | string[]): boolean {
  return String(effective) !== String(shipped);
}

/**
 * `generateMetadata` for a keyword landing page.
 *
 * Same precedence as every other route with one layer slipped into the middle:
 * the Page SEO override still wins, but the default beneath it is the title and
 * description held in the page's *own* editor, not the brief that shipped in
 * `lib/content/seo-pages/`. Without this the fields the SEO page editor calls
 * "this route's defaults" would be the only edits on that screen that never
 * reach a visitor — the body copy would rename itself and the tab wouldn't.
 *
 * `absoluteTitle` is fixed rather than an option: these titles carry the brand
 * already, so the `%s · Birthday Reminders` template would say it twice.
 *
 * The one ambiguous case is an override typed to match the shipped text exactly
 * — it reads as untouched and the page editor's value wins. Same intent, more
 * recently stated, so it resolves the way the editor would expect anyway.
 */
export async function seoLandingMetadata(slug: string): Promise<Metadata> {
  const path = `/${slug}`;
  const [meta, settings, page] = await Promise.all([
    getPageMeta(path),
    getSiteSettings(),
    getSeoPageContent(slug, "published"),
  ]);
  // Null only for a slug with no page file; the callers hardcode their own.
  if (!page) return buildPageMetadata(meta, settings, { absoluteTitle: true });

  const shipped = defaultPageMeta(path);
  return buildPageMetadata(
    {
      ...meta,
      title: isTuned(meta.title, shipped.title) ? meta.title : page.title || meta.title,
      description: isTuned(meta.description, shipped.description)
        ? meta.description
        : page.description || meta.description,
      keywords: isTuned(meta.keywords, shipped.keywords)
        ? meta.keywords
        : [...page.keywords],
    },
    settings,
    { absoluteTitle: true },
  );
}
