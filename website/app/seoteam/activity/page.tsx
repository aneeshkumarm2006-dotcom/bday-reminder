import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ActivityView } from "@/components/seoteam/admin/activity-view";
import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { isDbConfigured } from "@/lib/blog/db";
import { listAudit, listEditors } from "@/lib/content/audit";
import { listRevisions } from "@/lib/content/revisions";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const [entries, revisions, editors] = await Promise.all([
    listAudit({ limit: 200 }),
    listRevisions({ limit: 60 }),
    listEditors(),
  ]);

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        title="Activity"
        description="Who changed what, the snapshots taken before each save, and the export/import backups."
      >
        {isDbConfigured() ? (
          <ActivityView entries={entries} revisions={revisions} editors={editors} />
        ) : (
          <DbMissingNotice what="activity and revisions" />
        )}
      </AdminPage>
    </>
  );
}
