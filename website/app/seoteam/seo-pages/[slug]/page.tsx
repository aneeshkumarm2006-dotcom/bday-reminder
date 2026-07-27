import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { SeoPageEditor } from "@/components/seoteam/admin/seo-page-editor";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { buttonVariants } from "@/components/ui/button";
import { isDbConfigured } from "@/lib/blog/db";
import { getSeoPageContent } from "@/lib/content/get";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Keyword page" };

export default async function SeoPageEditorRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const { slug } = await params;
  // The draft variant, which falls back to published and then to the built-in
  // copy — so the editor always opens on what's currently live. Null means no
  // page file owns this slug, which for a URL-supplied slug is a 404.
  const page = await getSeoPageContent(slug, "draft");
  if (!page) notFound();

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        wide
        title={page.label}
        description={`/${slug} — rewrite the copy section by section. Save keeps it as a draft; Publish makes it live.`}
        actions={
          <>
            <Link
              href="/seoteam/seo-pages"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              All keyword pages
            </Link>
            <Link
              href={`/${slug}`}
              target="_blank"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <ExternalLink size={18} aria-hidden="true" />
              View live page
            </Link>
          </>
        }
      >
        {isDbConfigured() ? (
          <SeoPageEditor initial={page} />
        ) : (
          <DbMissingNotice what="this page's copy" />
        )}
      </AdminPage>
    </>
  );
}
