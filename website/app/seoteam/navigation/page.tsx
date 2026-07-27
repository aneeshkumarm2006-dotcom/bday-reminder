import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { NavigationEditor } from "@/components/seoteam/admin/navigation-editor";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { isDbConfigured } from "@/lib/blog/db";
import { getAllSitePages, getNavigation } from "@/lib/content/get";
import { derivePageVisibility } from "@/lib/content/schedule";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Navigation" };

export default async function NavigationPage() {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const [navigation, pages] = await Promise.all([getNavigation(), getAllSitePages()]);
  // Only offer link targets that visitors can actually reach.
  const linkablePages = pages.filter(
    (page) => derivePageVisibility(page.status, page.publishedAt) === "published",
  );

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        title="Navigation"
        description="Header links, header buttons, and the footer — applied across every page of the site."
      >
        {isDbConfigured() ? (
          <NavigationEditor initial={navigation} pages={linkablePages} />
        ) : (
          <DbMissingNotice what="navigation" />
        )}
      </AdminPage>
    </>
  );
}
