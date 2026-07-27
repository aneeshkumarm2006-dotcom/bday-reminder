import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { PagesTable } from "@/components/seoteam/admin/pages-table";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { buttonVariants } from "@/components/ui/button";
import { isDbConfigured } from "@/lib/blog/db";
import { getAllSitePages } from "@/lib/content/get";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Pages" };

export default async function SitePagesPage() {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const pages = await getAllSitePages();

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        wide
        title="Pages"
        description="Block-built pages that live at the site root. Schedule them, tune their SEO, and publish without a deploy."
        actions={
          isDbConfigured() ? (
            <Link href="/seoteam/pages/new" className={buttonVariants({ size: "sm" })}>
              <Plus size={18} aria-hidden="true" />
              New page
            </Link>
          ) : null
        }
      >
        {isDbConfigured() ? (
          <PagesTable pages={pages} />
        ) : (
          <DbMissingNotice what="custom pages" />
        )}
      </AdminPage>
    </>
  );
}
