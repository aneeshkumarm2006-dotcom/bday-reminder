import { Download } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeoLandingPage } from "@/components/marketing/seo-landing";
import { getSeoPageContent } from "@/lib/content/get";
import { seoLandingMetadata } from "@/lib/content/metadata";

/** Keyword landing page — see `/birthday-calendar/page.tsx` for how these work. */
export const revalidate = 3600;

export function generateMetadata(): Promise<Metadata> {
  return seoLandingMetadata("birthday-tracker");
}

export default async function BirthdayTrackerRoute() {
  const page = await getSeoPageContent("birthday-tracker", "published");
  if (!page) notFound();

  return (
    <>
      <SeoLandingPage page={page} />
      <PrintableFootnote />
    </>
  );
}

/**
 * The one place outside `/birthday-tracker-printable` that hands over the PDF.
 *
 * This page's pitch is that you shouldn't have to fill a tracker in by hand, so
 * a reader who wanted paper after all is being argued out of something we give
 * away for free anyway. Sending them off with the file is the honest end to
 * that argument, and it is the printable's only inbound link from anywhere else
 * on the site.
 *
 * It lives in the route rather than the shared landing renderer because it is
 * true of this page only, and sits below the closing call to action because it
 * is a consolation prize, not the offer. One link, deliberately: the page it
 * belongs to is already linked from the cross-link strip above.
 */
function PrintableFootnote() {
  return (
    <section className="border-t border-border-subtle bg-surface-sunken/60">
      <div className="mx-auto w-full max-w-5xl px-5 py-10">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-secondary">
          <Download
            size={15}
            aria-hidden="true"
            className="mr-1.5 inline-block align-[-2px] text-biro"
          />
          Rather have it on paper? The{" "}
          <a
            href="/birthday-tracker-printable.pdf"
            download="birthday-tracker-printable.pdf"
            className="font-medium text-biro underline underline-offset-4"
          >
            free printable birthday tracker PDF
          </a>{" "}
          is one page: twelve months, three lines under each, no email asked for.
        </p>
      </div>
    </section>
  );
}
