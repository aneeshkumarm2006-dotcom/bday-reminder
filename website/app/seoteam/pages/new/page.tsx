import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { PageBuilder } from "@/components/seoteam/admin/page-builder";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { isDbConfigured } from "@/lib/blog/db";
import { emptyPageMeta } from "@/lib/content/defaults";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New page" };

export default async function NewSitePage() {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        wide
        title="New page"
        description="Add blocks, set the slug, then save as a draft or schedule it."
      >
        {isDbConfigured() ? (
          // The path is rewritten to the real slug on first save.
          <PageBuilder page={null} meta={emptyPageMeta("/")} />
        ) : (
          <DbMissingNotice what="custom pages" />
        )}
      </AdminPage>
    </>
  );
}
