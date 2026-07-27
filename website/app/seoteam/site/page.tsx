import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { SiteSettingsForm } from "@/components/seoteam/admin/site-settings-form";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { buttonVariants } from "@/components/ui/button";
import { isDbConfigured } from "@/lib/blog/db";
import { getSiteSettings } from "@/lib/content/get";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Site settings" };

export default async function SiteSettingsPage() {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const settings = await getSiteSettings();
  const dbReady = isDbConfigured();

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        title="Site settings"
        description="Identity, SEO defaults, analytics, socials, and the announcement bar — applied across every page."
        actions={
          <Link
            href="/seoteam/structured-data"
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            Structured data
          </Link>
        }
      >
        {dbReady ? (
          <SiteSettingsForm initial={settings} />
        ) : (
          <DbMissingNotice what="site settings" />
        )}
      </AdminPage>
    </>
  );
}
