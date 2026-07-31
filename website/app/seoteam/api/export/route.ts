import { NextResponse } from "next/server";

import {
  getAllPageMeta,
  getAllSeoPageContent,
  getAllSitePages,
  getLandingContent,
  getLegalDoc,
  getNavigation,
  getSiteSettings,
} from "@/lib/content/get";
import { listRedirects } from "@/lib/content/redirects";
import { guardAdminRoute, serverError } from "@/lib/content/route-utils";

export const dynamic = "force-dynamic";

/**
 * A full JSON backup of every content collection — the thing to take before a
 * big edit. Deliberately the *effective* content (defaults already merged in),
 * so the file is a complete, self-describing snapshot rather than a set of
 * sparse overrides that only mean something next to a particular build.
 *
 * Re-importable through `POST /seoteam/api/import`.
 */
export async function GET() {
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;

  try {
    const [
      settings,
      landing,
      navigation,
      meta,
      pages,
      seoPages,
      redirects,
      privacy,
      terms,
      contact,
    ] = await Promise.all([
      getSiteSettings(),
      getLandingContent("published"),
      getNavigation(),
      getAllPageMeta(),
      getAllSitePages(),
      getAllSeoPageContent("published"),
      listRedirects(),
      getLegalDoc("privacy"),
      getLegalDoc("terms"),
      getLegalDoc("contact"),
    ]);

    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      landing,
      navigation,
      meta: Object.values(meta),
      pages: pages.map((page) => ({
        title: page.title,
        slug: page.slug,
        status: page.status,
        publishedAt: page.publishedAt,
        blocks: page.blocks,
        showInSitemap: page.showInSitemap,
        author: page.author,
      })),
      // Keyed by slug, and all of them rather than only the edited ones:
      // like every other section here this is the effective copy, so a page
      // nobody has touched still exports what it currently renders.
      seoPages: seoPages.map((page) => ({ slug: page.slug, content: page })),
      redirects: redirects.map((r) => ({
        from: r.from,
        to: r.to,
        type: r.type,
        enabled: r.enabled,
        note: r.note,
      })),
      legal: [privacy, terms, contact],
    };

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="site-content-${stamp}.json"`,
      },
    });
  } catch (err) {
    return serverError("GET /seoteam/api/export", err);
  }
}
