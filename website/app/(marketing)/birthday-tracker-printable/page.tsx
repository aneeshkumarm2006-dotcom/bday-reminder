import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeoLandingPage } from "@/components/marketing/seo-landing";
import { getSeoPageContent } from "@/lib/content/get";
import { seoLandingMetadata } from "@/lib/content/metadata";

/**
 * Keyword landing page — see `/birthday-calendar/page.tsx` for how these work.
 * The file this page gives away is `public/birthday-tracker-printable.pdf`,
 * served statically; only the copy around it is admin-editable.
 */
export const revalidate = 3600;

export function generateMetadata(): Promise<Metadata> {
  return seoLandingMetadata("birthday-tracker-printable");
}

export default async function BirthdayTrackerPrintableRoute() {
  const page = await getSeoPageContent("birthday-tracker-printable", "published");
  if (!page) notFound();

  return (
    <>
      <SeoLandingPage page={page} />
    </>
  );
}
