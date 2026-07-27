import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LandingEditor } from "@/components/seoteam/admin/landing-editor";
import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { buttonVariants } from "@/components/ui/button";
import { isDbConfigured } from "@/lib/blog/db";
import { getLandingContent } from "@/lib/content/get";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Landing page" };

export default async function LandingEditorPage() {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  // The draft variant, which falls back to published and then to the built-in
  // copy — so the editor always opens on what's currently live.
  const { sections } = await getLandingContent("draft");

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        wide
        title="Landing page"
        description="Reorder, hide, and rewrite every section of the homepage. Save keeps it as a draft; Publish makes it live."
        actions={
          <Link
            href="/"
            target="_blank"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <ExternalLink size={18} aria-hidden="true" />
            View live homepage
          </Link>
        }
      >
        {isDbConfigured() ? (
          <LandingEditor initial={sections} />
        ) : (
          <DbMissingNotice what="the landing page" />
        )}
      </AdminPage>
    </>
  );
}
