import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PostArticle } from "@/components/blog/post-article";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getPostById } from "@/lib/blog/posts";
import type { Post } from "@/lib/blog/types";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

// Belt-and-suspenders: the parent /seoteam layout already marks the subtree
// noindex, and the proxy matcher gates it — but a preview URL must never be
// indexed even if that changes.
export const metadata: Metadata = {
  title: "Preview",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Full-page, themed preview of ANY post (draft/scheduled/published) using the
 * real public site chrome. Lives under /seoteam so the proxy auth guard covers
 * it; we also re-check auth here (defense in depth) and fetch by id regardless
 * of status. JSON-LD and view-tracking are intentionally omitted.
 */
export default async function PreviewPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const { id } = await params;

  let post: Post | null = null;
  try {
    post = await getPostById(id);
  } catch {
    post = null;
  }
  if (!post) notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <div className="border-b border-border-subtle bg-warn-bg">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm text-warn-fg">
          <span className="font-medium">
            Preview — this is how the post will look. It is not published.
          </span>
          <Link
            href={`/seoteam/posts/${post.id}/edit`}
            className="inline-flex items-center gap-1.5 font-medium underline hover:no-underline"
          >
            <ArrowLeft size={15} aria-hidden="true" /> Back to editor
          </Link>
        </div>
      </div>

      <main className="flex-1">
        <PostArticle post={post} />
      </main>

      <SiteFooter />
    </div>
  );
}
