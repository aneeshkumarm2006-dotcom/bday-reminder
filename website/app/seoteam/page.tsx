import {
  Activity,
  AlertTriangle,
  FileText,
  Files,
  Images,
  LayoutTemplate,
  Navigation,
  Scale,
  Settings2,
  Shuffle,
  Tags,
  Target,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { isDbConfigured } from "@/lib/blog/db";
import { getAllPosts } from "@/lib/blog/posts";
import type { Post } from "@/lib/blog/types";
import { isScheduled } from "@/lib/blog/visibility";
import { listAudit } from "@/lib/content/audit";
import {
  getAllSeoPageContent,
  getAllSitePages,
  getLandingContent,
} from "@/lib/content/get";
import { analyzePageSeo } from "@/lib/content/page-seo";
import { listNotFoundHits, listRedirects } from "@/lib/content/redirects";
import { getRouteRows } from "@/lib/content/routes";
import { derivePageVisibility } from "@/lib/content/schedule";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";
import { getAutoSmsStats, type AutoSmsStats } from "@/lib/sms/stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Overview" };

/**
 * The admin's front door: what exists, what's unpublished, what's broken.
 *
 * Every number here is a link — the panel's job is to surface the one thing
 * that needs attention (an SEO warning, a spike in 404s, a landing draft nobody
 * published) rather than to be a dashboard for its own sake.
 */
export default async function SeoDashboardPage() {
  // Defense in depth: enforce auth in the data layer, not just the proxy matcher.
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  const dbReady = isDbConfigured();
  if (!dbReady) {
    return (
      <>
        <SeoTeamHeader />
        <AdminPage wide title="Overview" description="Everything public, in one place.">
          <DbMissingNotice what="site content" />
        </AdminPage>
      </>
    );
  }

  let posts: Post[] = [];
  try {
    posts = await getAllPosts();
  } catch {
    posts = [];
  }

  const [
    pages,
    routes,
    audit,
    redirects,
    hits,
    publishedLanding,
    draftLanding,
    publishedSeoPages,
    draftSeoPages,
  ] = await Promise.all([
    getAllSitePages(),
    getRouteRows(),
    listAudit({ limit: 8 }),
    listRedirects(),
    listNotFoundHits(),
    getLandingContent("published"),
    getLandingContent("draft"),
    getAllSeoPageContent("published"),
    getAllSeoPageContent("draft"),
  ]);

  const livePosts = posts.filter(
    (p) => p.status === "published" && !isScheduled(p.status, p.publishedAt),
  ).length;
  const draftPosts = posts.filter((p) => p.status === "draft").length;
  const livePages = pages.filter(
    (p) => derivePageVisibility(p.status, p.publishedAt) === "published",
  ).length;
  const draftPages = pages.length - livePages;

  // A landing draft that differs from what's live is the most common "someone
  // edited and forgot to publish" case, so it gets its own warning.
  const landingUnpublished =
    JSON.stringify(draftLanding.sections) !== JSON.stringify(publishedLanding.sections);

  // Same check per keyword landing page. Publishing writes both variants, so a
  // difference here always means someone saved a draft and stopped.
  const publishedSeoBySlug = new Map(
    publishedSeoPages.map((page) => [page.slug, JSON.stringify(page)]),
  );
  const seoPagesUnpublished = draftSeoPages.filter(
    (page) => publishedSeoBySlug.get(page.slug) !== JSON.stringify(page),
  );

  const seoWarnings = routes
    .map((route) => ({ route, analysis: analyzePageSeo(route.meta) }))
    .filter(({ analysis }) => analysis.counts.fail > 0)
    .slice(0, 6);

  const topHits = hits.slice(0, 5);

  let smsStats: AutoSmsStats | null = null;
  try {
    smsStats = await getAutoSmsStats();
  } catch {
    smsStats = null;
  }

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        wide
        title="Overview"
        description="Everything public on the site — content, SEO, navigation, and redirects."
      >
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <HubCard
            href="/seoteam/posts"
            icon={FileText}
            title="Posts"
            value={`${livePosts} live`}
            hint={`${draftPosts} draft${draftPosts === 1 ? "" : "s"}`}
          />
          <HubCard
            href="/seoteam/pages"
            icon={Files}
            title="Pages"
            value={`${livePages} live`}
            hint={`${draftPages} draft or scheduled`}
          />
          <HubCard
            href="/seoteam/landing"
            icon={LayoutTemplate}
            title="Landing page"
            value={`${publishedLanding.sections.filter((s) => s.visible).length} sections`}
            hint={landingUnpublished ? "Unpublished draft changes" : "Draft matches live"}
            warn={landingUnpublished}
          />
          <HubCard
            href="/seoteam/seo-pages"
            icon={Target}
            title="SEO pages"
            value={`${publishedSeoPages.length} pages`}
            hint={
              seoPagesUnpublished.length > 0
                ? `${seoPagesUnpublished.length} with unpublished drafts`
                : "Keyword landing pages"
            }
            warn={seoPagesUnpublished.length > 0}
          />
          <HubCard
            href="/seoteam/meta"
            icon={Tags}
            title="Page SEO"
            value={`${routes.length} routes`}
            hint={
              seoWarnings.length > 0
                ? `${seoWarnings.length} needing attention`
                : "No blocking issues"
            }
            warn={seoWarnings.length > 0}
          />
          <HubCard
            href="/seoteam/redirects"
            icon={Shuffle}
            title="Redirects"
            value={`${redirects.filter((r) => r.enabled).length} active`}
            hint={topHits.length > 0 ? `${hits.length} logged 404s` : "No 404s logged"}
            warn={topHits.length > 0}
          />
          <HubCard
            href="/seoteam/media"
            icon={Images}
            title="Media"
            value="Library"
            hint="Images used across posts and pages"
          />
          <HubCard
            href="/seoteam/site"
            icon={Settings2}
            title="Site settings"
            value="Identity & SEO"
            hint="Analytics, socials, announcement"
          />
          <HubCard
            href="/seoteam/navigation"
            icon={Navigation}
            title="Navigation"
            value="Header & footer"
            hint="Links shown on every page"
          />
          <HubCard
            href="/seoteam/legal"
            icon={Scale}
            title="Legal & contact"
            value="3 pages"
            hint="Privacy, terms, contact"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-border-subtle bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-ink">
              <AlertTriangle size={16} className="text-warn-fg" aria-hidden="true" />
              Needs attention
            </h2>
            {seoWarnings.length === 0 &&
            !landingUnpublished &&
            seoPagesUnpublished.length === 0 &&
            topHits.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Nothing flagged — every route passes its SEO checks.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {landingUnpublished && (
                  <li>
                    <Link
                      href="/seoteam/landing"
                      className="text-ink hover:text-biro"
                    >
                      The landing page has draft changes that aren&apos;t published.
                    </Link>
                  </li>
                )}
                {seoPagesUnpublished.map((page) => (
                  <li key={page.slug}>
                    <Link
                      href={`/seoteam/seo-pages/${page.slug}`}
                      className="text-ink hover:text-biro"
                    >
                      <span className="font-medium">{page.label}</span>{" "}
                      <span className="text-ink-muted">
                        — draft changes that aren&apos;t published.
                      </span>
                    </Link>
                  </li>
                ))}
                {seoWarnings.map(({ route, analysis }) => (
                  <li key={route.path}>
                    <Link href="/seoteam/meta" className="text-ink hover:text-biro">
                      <span className="font-medium">{route.path}</span>{" "}
                      <span className="text-ink-muted">
                        — {analysis.checks.find((c) => c.status === "fail")?.detail}
                      </span>
                    </Link>
                  </li>
                ))}
                {topHits.map((hit) => (
                  <li key={hit.id}>
                    <Link href="/seoteam/redirects" className="text-ink hover:text-biro">
                      <span className="font-mono text-xs">{hit.path}</span>{" "}
                      <span className="text-ink-muted">
                        — {hit.count} 404{hit.count === 1 ? "" : "s"}, no redirect
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-border-subtle bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-ink">
              <Activity size={16} className="text-ink-muted" aria-hidden="true" />
              Recent activity
            </h2>
            {audit.length === 0 ? (
              <p className="text-sm text-ink-muted">No changes recorded yet.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap gap-x-2">
                    <span className="text-ink">{entry.summary}</span>
                    <span className="text-xs text-ink-muted">
                      {entry.editor || "Unknown"} ·{" "}
                      <time dateTime={entry.createdAt}>
                        {entry.createdAt.slice(0, 10)}
                      </time>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/seoteam/activity"
              className="mt-3 inline-block text-sm text-biro underline underline-offset-2"
            >
              View all activity
            </Link>
          </section>
        </div>

        {smsStats && <TwilioCapCard stats={smsStats} />}
      </AdminPage>
    </>
  );
}

function HubCard({
  href,
  icon: Icon,
  title,
  value,
  hint,
  warn,
}: {
  href: string;
  icon: typeof FileText;
  title: string;
  value: string;
  hint: string;
  warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-border-subtle bg-surface p-4 transition-[border-color,transform] hover:-translate-y-0.5 hover:border-biro/40"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-biro-tint text-biro">
        <Icon size={18} aria-hidden="true" />
      </span>
      <p className="mt-3 text-sm font-medium text-ink group-hover:text-biro">{title}</p>
      <p className="text-lg font-semibold text-ink">{value}</p>
      <p className={warn ? "text-xs text-warn-fg" : "text-xs text-ink-muted"}>{hint}</p>
    </Link>
  );
}

/** Account-wide auto-send SMS usage vs. the configured monthly Twilio cap (Stage 15). */
function TwilioCapCard({ stats }: { stats: AutoSmsStats }) {
  const hasCap = stats.cap > 0;
  const pct = hasCap ? Math.min(100, Math.round((stats.used / stats.cap) * 100)) : 0;
  const atCap = hasCap && stats.used >= stats.cap;

  return (
    <div className="mt-6 rounded-lg border border-border-subtle bg-surface p-5">
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
          <p className="text-xs text-ink-muted">
            {hasCap ? "texts / cap" : "texts · no cap set"}
          </p>
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
