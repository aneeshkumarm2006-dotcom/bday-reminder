import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { MetaManager } from "@/components/seoteam/admin/meta-manager";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { isDbConfigured } from "@/lib/blog/db";
import { getRouteRows } from "@/lib/content/routes";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Page SEO" };

export default async function MetaManagerPage() {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const rows = await getRouteRows();

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        wide
        title="Page SEO"
        description="Titles, descriptions, keywords, canonicals, social cards, indexing and sitemap tuning — one row per public route."
      >
        {isDbConfigured() ? (
          <MetaManager rows={rows} />
        ) : (
          <DbMissingNotice what="per-page SEO" />
        )}
      </AdminPage>
    </>
  );
}
