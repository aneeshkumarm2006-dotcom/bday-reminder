import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PostsTable } from "@/components/seoteam/posts-table";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { isDbConfigured } from "@/lib/blog/db";
import { getAllPosts } from "@/lib/blog/posts";
import type { Post } from "@/lib/blog/types";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Posts" };

export default async function SeoDashboardPage() {
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

  return (
    <>
      <SeoTeamHeader />
      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold text-ink">Posts</h1>
          <p className="text-sm text-ink-muted">
            Create, manage, and publish SEO-optimized blog posts.
          </p>
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
          <PostsTable initialPosts={posts} />
        )}
      </main>
    </>
  );
}
