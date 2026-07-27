import type { Metadata } from "next";

import { getPageMeta, getSiteSettings } from "./get";
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
