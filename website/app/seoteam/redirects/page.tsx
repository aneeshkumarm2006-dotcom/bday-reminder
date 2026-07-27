import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { RedirectsManager } from "@/components/seoteam/admin/redirects-manager";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { isDbConfigured } from "@/lib/blog/db";
import { listNotFoundHits, listRedirects } from "@/lib/content/redirects";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Redirects" };

export default async function RedirectsPage() {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const [redirects, hits] = await Promise.all([listRedirects(), listNotFoundHits()]);

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        title="Redirects"
        description="Keep old URLs (and their rankings) working, and see which broken links visitors are actually hitting."
      >
        {isDbConfigured() ? (
          <RedirectsManager redirects={redirects} hits={hits} />
        ) : (
          <DbMissingNotice what="redirects" />
        )}
      </AdminPage>
    </>
  );
}
