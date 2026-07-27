import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomJsonLd } from "@/components/custom-json-ld";
import { SeoLandingPage } from "@/components/marketing/seo-landing";
import { getPageMeta, getSeoPageContent } from "@/lib/content/get";
import { seoLandingMetadata } from "@/lib/content/metadata";

/** Keyword landing page — see `/birthday-calendar/page.tsx` for how these work. */
export const revalidate = 3600;

export function generateMetadata(): Promise<Metadata> {
  return seoLandingMetadata("birthday-tracker");
}

export default async function BirthdayTrackerRoute() {
  const [meta, page] = await Promise.all([
    getPageMeta("/birthday-tracker"),
    getSeoPageContent("birthday-tracker", "published"),
  ]);
  if (!page) notFound();

  return (
    <>
      <CustomJsonLd json={meta.customJsonLd} />
      <SeoLandingPage page={page} />
    </>
  );
}
