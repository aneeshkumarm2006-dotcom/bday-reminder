import type { SeoAnalysis, SeoCheck, SeoCheckStatus } from "@/lib/blog/types";

import type { PageMeta } from "./types";

/**
 * On-page SEO health for a *route* (as opposed to a blog post, which has body
 * copy to analyse — see `lib/blog/seo-checks.ts`). Same `SeoCheck` shape and
 * the same 50–60 / 150–160 character bands, so one badge component renders both
 * and a "pass" means the same thing in the posts table and the meta table.
 *
 * Pure and isomorphic: the table renders it on the server, the row drawer
 * re-runs it live as the team types.
 */
export function analyzePageSeo(
  meta: PageMeta,
  context: { hasContent?: boolean } = {},
): SeoAnalysis {
  const checks: SeoCheck[] = [];

  const titleLen = meta.title.trim().length;
  checks.push({
    id: "title-length",
    label: "Title length",
    status:
      titleLen >= 50 && titleLen <= 60
        ? "pass"
        : titleLen >= 30 && titleLen <= 65
          ? "warn"
          : "fail",
    detail:
      titleLen === 0
        ? "No title — this page inherits the sitewide default."
        : `${titleLen} characters (aim for 50–60).`,
  });

  const descLen = meta.description.trim().length;
  checks.push({
    id: "description-length",
    label: "Meta description",
    status:
      descLen >= 150 && descLen <= 160
        ? "pass"
        : descLen >= 110 && descLen <= 175
          ? "warn"
          : "fail",
    detail:
      descLen === 0
        ? "No description — this page inherits the sitewide default."
        : `${descLen} characters (aim for 150–160).`,
  });

  checks.push({
    id: "canonical",
    label: "Canonical URL",
    status: meta.canonical.trim() ? "pass" : "warn",
    detail: meta.canonical.trim()
      ? `Canonical set to ${meta.canonical.trim()}.`
      : "No canonical set — the route's own path is used.",
  });

  // The contradiction that quietly wastes crawl budget: telling Google not to
  // index a page while still advertising it in the sitemap.
  const inSitemap = !meta.sitemap.exclude;
  checks.push({
    id: "index-sitemap-agreement",
    label: "Indexing & sitemap agree",
    status: meta.noindex && inSitemap ? "fail" : "pass",
    detail:
      meta.noindex && inSitemap
        ? "This page is noindex but still listed in the sitemap. Exclude it, or allow indexing."
        : meta.noindex
          ? "Noindex, and excluded from the sitemap."
          : "Indexable and listed in the sitemap.",
  });

  checks.push({
    id: "social-card",
    label: "Social card",
    status: meta.ogImage.trim() || meta.ogTitle.trim() ? "pass" : "warn",
    detail:
      meta.ogImage.trim() || meta.ogTitle.trim()
        ? "Open Graph overrides set."
        : "No Open Graph overrides — the sitewide card is used.",
  });

  if (context.hasContent === false) {
    checks.push({
      id: "has-content",
      label: "Page content",
      status: "fail",
      detail: "This page has no content blocks yet.",
    });
  }

  const counts = checks.reduce(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 } as Record<SeoCheckStatus, number>,
  );

  return { checks, counts, ready: counts.fail === 0 };
}

/** One-word verdict for a table badge. */
export function seoVerdict(analysis: SeoAnalysis): {
  label: string;
  tone: SeoCheckStatus;
} {
  if (analysis.counts.fail > 0) {
    return { label: `${analysis.counts.fail} issue${analysis.counts.fail > 1 ? "s" : ""}`, tone: "fail" };
  }
  if (analysis.counts.warn > 0) {
    return { label: `${analysis.counts.warn} warning${analysis.counts.warn > 1 ? "s" : ""}`, tone: "warn" };
  }
  return { label: "Healthy", tone: "pass" };
}
