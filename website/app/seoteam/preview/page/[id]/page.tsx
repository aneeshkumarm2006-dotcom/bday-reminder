import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PageBlocks } from "@/components/marketing/page-blocks";
import { PreviewBanner, SiteChrome } from "@/components/site-chrome";
import { getSitePageById } from "@/lib/content/pages";
import { derivePageVisibility } from "@/lib/content/schedule";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

// Belt and braces: the /seoteam layout marks the subtree noindex and the proxy
// gates it — but a preview URL must never be indexed even if that changes.
export const metadata: Metadata = {
  title: "Page preview",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Full-page preview of ANY custom page — draft, scheduled, or published —
 * inside the real public chrome. Fetched by id, so the publish read-gate that
 * hides it from visitors doesn't hide it from the editor.
 */
export default async function SitePagePreview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const { id } = await params;
  const page = await getSitePageById(id);
  if (!page) notFound();

  const visibility = derivePageVisibility(page.status, page.publishedAt);

  return (
    <SiteChrome>
      <PreviewBanner
        message={
          visibility === "published"
            ? `Preview of /${page.slug} — this page is live.`
            : visibility === "scheduled"
              ? `Preview of /${page.slug} — scheduled, not visible yet.`
              : `Preview of /${page.slug} — draft, not visible to anyone else.`
        }
        action={
          <Link
            href={`/seoteam/pages/${page.id}/edit`}
            className="inline-flex items-center gap-1.5 font-medium underline hover:no-underline"
          >
            <ArrowLeft size={15} aria-hidden="true" /> Back to the builder
          </Link>
        }
      />
      <main className="flex-1">
        <PageBlocks blocks={page.blocks} />
      </main>
    </SiteChrome>
  );
}
