import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";

import { PageBlocks } from "@/components/marketing/page-blocks";
import { PageGraph } from "@/components/page-graph";
import { getPageMeta, getPublishedSitePage } from "@/lib/content/get";
import { buildPageMetadata } from "@/lib/content/metadata";
import { getSiteSettings } from "@/lib/content/get";
import { faqItemsFromBlocks } from "@/lib/content/page-graph";
import { resolveRedirect, recordNotFound } from "@/lib/content/redirects";

/**
 * Renderer for admin-built custom pages.
 *
 * `force-dynamic` for the same reason `/blog` is: the publish gate is evaluated
 * per request, so a page scheduled for 09:00 appears at 09:00 exactly — no cron
 * job, no ISR lag, nothing to keep running.
 *
 * A slug that matches no published page falls through to the redirect table
 * before 404ing. That lookup lives here, on the miss path, rather than in
 * `proxy.ts` — see `lib/content/redirects.ts` for why.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedSitePage(slug);
  if (!page) return { title: "Not found", robots: { index: false, follow: false } };

  const [meta, settings] = await Promise.all([
    getPageMeta(`/${page.slug}`),
    getSiteSettings(),
  ]);
  // A page with no SEO override still gets a sensible title from the page itself.
  return buildPageMetadata(
    { ...meta, title: meta.title || page.title },
    settings,
  );
}

export default async function CustomPage({ params }: Params) {
  const { slug } = await params;
  const page = await getPublishedSitePage(slug);

  if (!page) {
    const rule = await resolveRedirect(`/${slug}`);
    if (rule) {
      // permanentRedirect emits 308 (the modern 301); redirect emits 307.
      if (rule.type === 301) permanentRedirect(rule.to);
      redirect(rule.to);
    }
    await recordNotFound(`/${slug}`);
    notFound();
  }

  const meta = await getPageMeta(`/${page.slug}`);

  return (
    <>
      {/* One FAQPage for the page, merged from every faq block on it — the
          per-block markup this replaced emitted a second FAQPage for a second
          block, which describes two pages that don't exist. */}
      <PageGraph
        path={`/${page.slug}`}
        name={meta.title || page.title}
        description={meta.description}
        breadcrumb={[{ name: "Home", path: "/" }, { name: page.title }]}
        faq={faqItemsFromBlocks(page.blocks)}
        datePublished={page.publishedAt ?? undefined}
        dateModified={page.updatedAt}
        customJsonLd={meta.customJsonLd}
      />
      <PageBlocks blocks={page.blocks} />
    </>
  );
}
