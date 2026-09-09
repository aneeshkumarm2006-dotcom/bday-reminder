import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BuiltInEditor } from "@/components/seoteam/admin/built-in-editor";
import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { isDbConfigured } from "@/lib/blog/db";
import { getBuiltInPages } from "@/lib/content/get";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Built-in pages" };

/**
 * The four public routes that build their own body — the blog index, a post
 * page's furniture, the 404, and the contact page's extras.
 *
 * They can't be Pages (nothing to author) and they can't be Legal documents
 * (they aren't one document), so they get their own screen. With that, every
 * public URL on the site is editable from this panel.
 */
export default async function BuiltInPagesEditor() {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const pages = await getBuiltInPages();

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        wide
        title="Built-in pages"
        description="The blog index, blog posts, the 404, and the contact page. Reword them, and drop blocks onto pages you can't otherwise author."
      >
        {isDbConfigured() ? (
          <BuiltInEditor initial={pages} />
        ) : (
          <DbMissingNotice what="the built-in pages" />
        )}
      </AdminPage>
    </>
  );
}
