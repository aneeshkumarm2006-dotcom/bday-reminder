import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { StructuredDataForm } from "@/components/seoteam/admin/structured-data-form";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { isDbConfigured } from "@/lib/blog/db";
import { getSiteSettings } from "@/lib/content/get";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Structured data" };

export default async function StructuredDataPage() {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const settings = await getSiteSettings();

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        title="Structured data"
        description="The Organization, WebSite, and application markup emitted on the homepage — and reused as the publisher on every blog post."
      >
        {isDbConfigured() ? (
          <StructuredDataForm initial={settings} />
        ) : (
          <DbMissingNotice what="structured data" />
        )}
      </AdminPage>
    </>
  );
}
