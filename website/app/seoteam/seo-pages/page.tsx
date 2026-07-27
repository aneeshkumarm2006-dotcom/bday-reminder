import { ExternalLink, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminPage, DbMissingNotice } from "@/components/seoteam/admin/layout";
import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { Badge } from "@/components/ui/badge";
import { isDbConfigured } from "@/lib/blog/db";
import { getAllSeoPageContent, getSeoPageOverrides } from "@/lib/content/get";
import { isSeoAuthenticated } from "@/lib/seo-auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Keyword pages" };

/**
 * The keyword landing-page cluster, one row per page.
 *
 * There's no "new page" button and there never will be: a page here is a data
 * file plus a route in the repo, written against an SEO brief. This screen edits
 * the copy of the six that exist.
 */
export default async function SeoPagesListPage() {
  if (!(await isSeoAuthenticated())) redirect("/seoteam/login");

  // Both variants, because "has an unpublished draft" is a difference between
  // them — the override map only knows that *something* is stored.
  const [drafts, published, overrides] = await Promise.all([
    getAllSeoPageContent("draft"),
    getAllSeoPageContent("published"),
    getSeoPageOverrides(),
  ]);

  return (
    <>
      <SeoTeamHeader />
      <AdminPage
        wide
        title="Keyword pages"
        description="The six landing pages that target the search terms the homepage can't. Rewrite any of them; the layout stays the site's."
      >
        {!isDbConfigured() && (
          <div className="mb-6">
            <DbMissingNotice what="these pages" />
          </div>
        )}

        <ul className="flex flex-col gap-2">
          {drafts.map((page) => {
            const live = published.find((p) => p.slug === page.slug);
            const status = statusFor(
              overrides[page.slug],
              JSON.stringify(page) !== JSON.stringify(live),
            );

            return (
              <li
                key={page.slug}
                className="rounded-lg border border-border-subtle bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/seoteam/seo-pages/${page.slug}`}
                        className="font-display text-base font-semibold text-ink hover:text-biro"
                      >
                        {page.label}
                      </Link>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-ink-muted">
                      /{page.slug}
                    </p>
                    <p className="mt-2 max-w-2xl text-sm text-ink-secondary">
                      {page.title}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      href={`/${page.slug}`}
                      target="_blank"
                      aria-label={`Open /${page.slug} in a new tab`}
                      title="View the live page"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
                    >
                      <ExternalLink size={17} aria-hidden="true" />
                    </Link>
                    <Link
                      href={`/seoteam/seo-pages/${page.slug}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
                    >
                      <Pencil size={15} aria-hidden="true" />
                      Edit
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-xs text-ink-muted">
          Titles and descriptions set here are each route&apos;s defaults — the Page SEO
          screen overrides them.
        </p>
      </AdminPage>
    </>
  );
}

/**
 * `draftDiffers` alone can't tell the three states apart: a page that's only
 * ever been drafted has no published variant, and the getter falls the published
 * read back onto the draft — so the two would compare equal. The override
 * record's `hasPublished` is what breaks that tie.
 */
function statusFor(
  override: { hasDraft: boolean; hasPublished: boolean } | undefined,
  draftDiffers: boolean,
): { label: string; tone: string } {
  if (!override) return { label: "Built-in copy", tone: "neutral" };
  if (!override.hasPublished || draftDiffers) {
    return { label: "Unpublished draft", tone: "warn" };
  }
  return { label: "Published edits", tone: "ok" };
}
