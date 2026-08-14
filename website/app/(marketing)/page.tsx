import type { Metadata } from "next";

import { LandingSections } from "@/components/marketing/landing-sections";
import { PageGraph } from "@/components/page-graph";
import { SmoothScroll } from "@/components/smooth-scroll";
import { getLandingContent, getPageMeta } from "@/lib/content/get";
import { metadataForPath } from "@/lib/content/metadata";
import {
  faqItemsFromLandingSections,
  featureListFromSections,
} from "@/lib/content/page-graph";

// Static-friendly homepage, refreshed hourly so newly published posts surface in
// the "From the blog" strip without a redeploy (the /blog index is force-dynamic).
// Admin saves call revalidatePath("/") so content edits are never stuck behind
// this window — see lib/content/revalidate.ts.
export const revalidate = 3600;

/**
 * Home-page SEO. `absoluteTitle` opts out of the root layout's `%s · <name>`
 * template so the exact keyword-led title is used verbatim — same behaviour as
 * before, now editable at /seoteam/meta.
 */
export function generateMetadata(): Promise<Metadata> {
  return metadataForPath("/", { absoluteTitle: true });
}

/**
 * The landing page is a renderer, not a document: it maps over the *published*
 * section list from the admin panel (falling back to `DEFAULT_LANDING`, the
 * copy that used to be hardcoded here). Reordering, hiding, and rewording any
 * section is a content change; the markup lives in `landing-sections.tsx`.
 */
export default async function Home() {
  const [{ sections }, meta] = await Promise.all([
    getLandingContent("published"),
    getPageMeta("/"),
  ]);

  return (
    <>
      {/* The one page that describes the company and the product in full, so it
          carries the complete Organization, WebSite and WebApplication nodes;
          every other route references them by @id. The FAQ and feature list are
          read back off the same sections the page renders, so hiding a section
          in the admin removes it from the markup too. */}
      <PageGraph
        path="/"
        name={meta.title}
        description={meta.description}
        about="app"
        fullOrganization
        includeApp
        faq={faqItemsFromLandingSections(sections)}
        featureList={featureListFromSections(sections)}
        customJsonLd={meta.customJsonLd}
      />
      <SmoothScroll />
      <LandingSections sections={sections} />
    </>
  );
}
