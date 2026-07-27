import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { LegalEditor } from "@/components/seoteam/admin/legal-editor";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { isDbConfigured } from "@/lib/blog/db";
import { getLegalDoc } from "@/lib/content/get";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Legal & contact" };

export default async function LegalAdminPage() {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const [privacy, terms, contact] = await Promise.all([
    getLegalDoc("privacy"),
    getLegalDoc("terms"),
    getLegalDoc("contact"),
  ]);

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        title="Legal & contact"
        description="The privacy policy, terms, and contact page — editable without a deploy."
      >
        {isDbConfigured() ? (
          <LegalEditor docs={{ privacy, terms, contact }} />
        ) : (
          <DbMissingNotice what="the legal pages" />
        )}
      </AdminPage>
    </>
  );
}
