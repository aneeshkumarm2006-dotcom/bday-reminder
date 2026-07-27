import type { Metadata } from "next";

import { CustomJsonLd } from "@/components/custom-json-ld";
import { LandingSections } from "@/components/marketing/landing-sections";
import { SiteJsonLd } from "@/components/site-json-ld";
import { SmoothScroll } from "@/components/smooth-scroll";
import { getLandingContent, getPageMeta } from "@/lib/content/get";
import { metadataForPath } from "@/lib/content/metadata";

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
      <SiteJsonLd />
      <CustomJsonLd json={meta.customJsonLd} />
      <SmoothScroll />
      <LandingSections sections={sections} />
    </>
  );
}
