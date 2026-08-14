import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SeoLandingPage } from "@/components/marketing/seo-landing";
import { getSeoPageContent } from "@/lib/content/get";
import { seoLandingMetadata } from "@/lib/content/metadata";

/** Keyword landing page — see `/birthday-calendar/page.tsx` for how these work. */
export const revalidate = 3600;

export function generateMetadata(): Promise<Metadata> {
  return seoLandingMetadata("family-birthday-calendar");
}

export default async function FamilyBirthdayCalendarRoute() {
  const page = await getSeoPageContent("family-birthday-calendar", "published");
  if (!page) notFound();

  return (
    <>
      <SeoLandingPage page={page} />
    </>
  );
}
