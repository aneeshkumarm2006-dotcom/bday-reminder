import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AdminPage } from "@/components/seoteam/admin/layout";
import { PageBuilder } from "@/components/seoteam/admin/page-builder";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { getPageMeta } from "@/lib/content/get";
import { getSitePageById } from "@/lib/content/pages";
import { derivePageVisibility } from "@/lib/content/schedule";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditSitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const { id } = await params;
  const page = await getSitePageById(id);
  if (!page) notFound();

  const meta = await getPageMeta(`/${page.slug}`);
  const visibility = derivePageVisibility(page.status, page.publishedAt);

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        wide
        title={page.title || "Untitled page"}
        description={`/${page.slug} · ${visibility}`}
      >
        <PageBuilder page={page} meta={meta} />
      </AdminPage>
    </>
  );
}
