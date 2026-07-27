import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { SeoLandingPage } from "@/components/marketing/seo-landing";
import { PreviewBanner, SiteChrome } from "@/components/site-chrome";
import { SmoothScroll } from "@/components/smooth-scroll";
import { getSeoPageContent } from "@/lib/content/get";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

// Belt and braces: the /seoteam layout already marks the subtree noindex and
// the proxy matcher gates it — but a preview URL must never be indexed even if
// that changes.
export const metadata: Metadata = {
  title: "Keyword page preview",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * One keyword landing page rendered from its **draft** content, inside the real
 * public chrome. Same component as `/[slug]`, different variant — so what you
 * see here is exactly what Publish will ship.
 *
 * The sibling cross-links still read *published* copy, because that's what a
 * visitor would see: this preview is of one page, not of the whole cluster.
 */
export default async function SeoPagePreviewRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const { slug } = await params;
  const page = await getSeoPageContent(slug, "draft");
  if (!page) notFound();

  return (
    <SiteChrome>
      <PreviewBanner
        message="Draft preview — this is not what visitors see until you publish."
        action={
          <Link
            href={`/seoteam/seo-pages/${slug}`}
            className="inline-flex items-center gap-1.5 font-medium underline hover:no-underline"
          >
            <ArrowLeft size={15} aria-hidden="true" /> Back to the editor
          </Link>
        }
      />
      <main className="flex-1">
        <SmoothScroll />
        <SeoLandingPage page={page} />
      </main>
    </SiteChrome>
  );
}
