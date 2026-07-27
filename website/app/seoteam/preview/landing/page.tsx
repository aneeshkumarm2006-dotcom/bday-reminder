import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LandingSections } from "@/components/marketing/landing-sections";
import { PreviewBanner, SiteChrome } from "@/components/site-chrome";
import { SmoothScroll } from "@/components/smooth-scroll";
import { getLandingContent } from "@/lib/content/get";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

// Belt and braces: the /seoteam layout already marks the subtree noindex and
// the proxy matcher gates it — but a preview URL must never be indexed even if
// that changes.
export const metadata: Metadata = {
  title: "Landing preview",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The homepage rendered from the **draft** landing content, inside the real
 * public chrome. Same components as `/`, different variant — so what you see
 * here is exactly what Publish will ship.
 */
export default async function LandingPreviewPage() {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const { sections } = await getLandingContent("draft");

  return (
    <SiteChrome>
      <PreviewBanner
        message="Draft preview — this is not what visitors see until you publish."
        action={
          <Link
            href="/seoteam/landing"
            className="inline-flex items-center gap-1.5 font-medium underline hover:no-underline"
          >
            <ArrowLeft size={15} aria-hidden="true" /> Back to the editor
          </Link>
        }
      />
      <main className="flex-1">
        <SmoothScroll />
        <LandingSections sections={sections} />
      </main>
    </SiteChrome>
  );
}
