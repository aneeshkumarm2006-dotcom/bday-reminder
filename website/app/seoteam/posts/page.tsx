import { ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PostsTable, type PostRow } from "@/components/seoteam/posts-table";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { buttonVariants } from "@/components/ui/button";
import { isDbConfigured } from "@/lib/blog/db";
import { getAllPosts } from "@/lib/blog/posts";
import type { Post } from "@/lib/blog/types";
import { isScheduled } from "@/lib/blog/visibility";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Posts" };

export default async function SeoPostsPage() {
  // Defense in depth: enforce auth in the data layer, not just the proxy matcher.
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  let posts: Post[] = [];
  let dbReady = isDbConfigured();
  if (dbReady) {
    try {
      posts = await getAllPosts();
    } catch {
      dbReady = false;
    }
  }

  // Compute "scheduled" with the server clock (a published post with a future
  // publishedAt) so the client never needs new Date() at first render. isScheduled
  // reads its own `now` default, keeping this render free of impure calls.
  const rows: PostRow[] = posts.map((p) => ({
    ...p,
    scheduled: isScheduled(p.status, p.publishedAt),
  }));
  const liveCount = rows.filter((r) => r.status === "published" && !r.scheduled).length;
  const scheduledCount = rows.filter((r) => r.scheduled).length;
  const draftCount = rows.filter((r) => r.status === "draft").length;


  return (
    <>
      <SeoTeamHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Posts</h1>
            <p className="text-sm text-ink-muted">
              Create, manage, and publish SEO-optimized blog posts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/blog"
              target="_blank"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <ExternalLink size={18} aria-hidden="true" />
              View blog
            </Link>
            <Link href="/seoteam/new" className={buttonVariants({ size: "sm" })}>
              <Plus size={18} aria-hidden="true" />
              New post
            </Link>
          </div>
        </div>

        {!dbReady ? (
          <div className="rounded-lg border border-border-subtle bg-warn-bg p-5 text-sm text-warn-fg">
            <p className="font-medium">The database isn&apos;t connected.</p>
            <p className="mt-1">
              Set <code>MONGODB_URI</code> in <code>website/.env.local</code> to
              start publishing posts.
            </p>
          </div>
        ) : (
          <>
            {rows.length > 0 && (
              <div className="mb-6 grid grid-cols-3 gap-3">
                <StatCard label="Published" value={liveCount} hint="Live now" />
                <StatCard label="Scheduled" value={scheduledCount} hint="Future auto-publish" />
                <StatCard label="Drafts" value={draftCount} hint="Not published" />
              </div>
            )}
            <PostsTable initialPosts={rows} />
          </>
        )}
      </main>
    </>
  );
}

/** Small headline metric card for the posts overview. */
function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-4">
      <p className="text-2xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="text-xs text-ink-muted">{hint}</p>
    </div>
  );
}
