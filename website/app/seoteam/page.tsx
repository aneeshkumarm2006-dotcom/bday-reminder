import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PostsTable } from "@/components/seoteam/posts-table";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { isDbConfigured } from "@/lib/blog/db";
import { getAllPosts } from "@/lib/blog/posts";
import type { Post } from "@/lib/blog/types";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";
import { getAutoSmsStats, type AutoSmsStats } from "@/lib/sms/stats";

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

  // Auto-send SMS spend snapshot (Stage 15) - best-effort; never breaks the page.
  let smsStats: AutoSmsStats | null = null;
  if (dbReady) {
    try {
      smsStats = await getAutoSmsStats();
    } catch {
      smsStats = null;
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

        {smsStats && <TwilioCapCard stats={smsStats} />}

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

/** Account-wide auto-send SMS usage vs. the configured monthly Twilio cap (Stage 15). */
function TwilioCapCard({ stats }: { stats: AutoSmsStats }) {
  const hasCap = stats.cap > 0;
  const pct = hasCap ? Math.min(100, Math.round((stats.used / stats.cap) * 100)) : 0;
  const atCap = hasCap && stats.used >= stats.cap;

  return (
    <div className="mb-6 rounded-lg border border-border-subtle bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium text-ink">Auto-send SMS this month</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            Birthday texts sent from the shared Twilio number · {stats.period}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-ink">
            {stats.used}
            {hasCap && <span className="text-ink-muted">{` / ${stats.cap}`}</span>}
          </p>
          <p className="text-xs text-ink-muted">{hasCap ? "texts / cap" : "texts · no cap set"}</p>
        </div>
      </div>
      {hasCap && (
        <>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className={`h-full rounded-full ${atCap ? "bg-warn-fg" : "bg-biro"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {atCap && (
            <p className="mt-2 text-xs text-warn-fg">
              Cap reached — further auto-texts are paused until next month. Raise{" "}
              <code>TWILIO_MONTHLY_CAP</code> to send more.
            </p>
          )}
        </>
      )}
    </div>
  );
}
