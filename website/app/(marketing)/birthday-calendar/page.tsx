import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomJsonLd } from "@/components/custom-json-ld";
import { SeoLandingPage } from "@/components/marketing/seo-landing";
import { getPageMeta, getSeoPageContent } from "@/lib/content/get";
import { seoLandingMetadata } from "@/lib/content/metadata";

/**
 * Keyword landing page — the copy is editable at `/seoteam/seo-pages` and falls
 * back to the briefs that ship in `lib/content/seo-pages/`, so the page renders
 * with no database and an admin edit only ever overrides what it touches. The
 * markup is in `components/marketing/seo-landing.tsx`. This file exists only to
 * claim the route, which is also why it sits above `(marketing)/[slug]`: a
 * static segment always wins over the page builder's catch-all, so nobody can
 * shadow it from the admin.
 *
 * The metadata has two editors, hence `seoLandingMetadata`: the title and
 * description on `/seoteam/seo-pages` are this route's defaults and anything set
 * for it on `/seoteam/meta` wins over them.
 *
 * ISR like the homepage, and both admin writes are wired to it: publishing the
 * copy revalidates all six landing paths (`revalidateFor("seo-page")`, because
 * every page names its five siblings) and saving the SEO metadata revalidates
 * this one (`revalidateFor("meta")`) — so an edit is never stuck behind the
 * window.
 */
export const revalidate = 3600;

export function generateMetadata(): Promise<Metadata> {
  return seoLandingMetadata("birthday-calendar");
}

export default async function BirthdayCalendarRoute() {
  const [meta, page] = await Promise.all([
    getPageMeta("/birthday-calendar"),
    getSeoPageContent("birthday-calendar", "published"),
  ]);
  // Only null for a slug with no page file, and this route hardcodes one that
  // exists — the guard is for the type, not for reality.
  if (!page) notFound();

  return (
    <>
      <CustomJsonLd json={meta.customJsonLd} />
      <SeoLandingPage page={page} />
    </>
  );
}
