import { NextResponse, type NextRequest } from "next/server";

import { connectDb } from "@/lib/blog/db";
import { logAction } from "@/lib/content/audit";
import { getEditorName } from "@/lib/content/editor-server";
import { getSeoPageContent } from "@/lib/content/get";
import { deepMerge } from "@/lib/content/merge";
import { SeoPageContentModel } from "@/lib/content/models";
import { revalidateFor } from "@/lib/content/revalidate";
import { saveRevision } from "@/lib/content/revisions";
import {
  badRequest,
  firstError,
  guardAdminRoute,
  notFound,
  readJson,
  serverError,
} from "@/lib/content/route-utils";
import { getSeoLandingPage } from "@/lib/content/seo-pages";
import { saveSeoPageSchema } from "@/lib/content/validation";

export const dynamic = "force-dynamic";

/**
 * One keyword landing page's copy.
 *
 * The slug is the route key, never a payload field: `lib/content/seo-pages/`
 * plus a route file decide which of these pages exist, and this endpoint only
 * ever overrides copy on a page that already renders. Every handler below
 * therefore resolves the slug against the registry first and 404s on a miss —
 * an editor must not be able to create (or move) a URL that has no route.
 */

type Params = { params: Promise<{ slug: string }> };

const UNKNOWN_PAGE = "That landing page doesn't exist.";

export async function GET(req: NextRequest, { params }: Params) {
  // `requireDb: false` so the editor still opens (on the built-in copy) with no
  // database configured — same as every other read in this admin.
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;

  const { slug } = await params;
  const variant = req.nextUrl.searchParams.get("variant") === "published" ? "published" : "draft";
  try {
    const page = await getSeoPageContent(slug, variant);
    if (!page) return notFound(UNKNOWN_PAGE);
    return NextResponse.json({ page });
  } catch (err) {
    return serverError("GET /seoteam/api/seo-pages/[slug]", err);
  }
}

/**
 * Save one landing page.
 *
 * `mode: "draft"` writes only the draft variant — the live URL is untouched and
 * `/seoteam/preview/seo-page/[slug]` renders it. `mode: "publish"` copies the
 * same payload into `published` and revalidates the whole cluster, which is what
 * makes an edit appear instantly despite these pages' ISR window.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const json = await readJson(req);
  if (json === null) return badRequest("Invalid request body.");

  const parsed = saveSeoPageSchema.safeParse(json);
  if (!parsed.success) return badRequest(firstError(parsed.error));

  const { slug } = await params;
  const builtIn = getSeoLandingPage(slug);
  if (!builtIn) return notFound(UNKNOWN_PAGE);

  const { content, mode } = parsed.data;
  const publishing = mode === "publish";

  try {
    const editor = await getEditorName();
    await saveRevision(
      "seo-page",
      slug,
      await getSeoPageContent(slug, publishing ? "published" : "draft"),
      editor,
    );

    await connectDb();
    await SeoPageContentModel.findOneAndUpdate(
      { slug },
      {
        $set: {
          slug,
          draft: content,
          ...(publishing ? { published: content, publishedAt: new Date() } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    if (publishing) revalidateFor("seo-page");

    await logAction({
      action: publishing ? "publish" : "save-draft",
      entityType: "seo-page",
      entityId: slug,
      summary: `${publishing ? "Published" : "Saved a draft of"} the ${
        content.label || builtIn.label
      } landing page (/${slug})`,
      editor,
    });

    // Merge by hand instead of re-reading. `getSeoPageContent` is React-`cache()`d
    // and already ran a few lines up for the revision snapshot, so a second call
    // would replay the *pre-save* value and the editor would show the save as a
    // no-op. `lib/content/get.ts` splits `readSiteSettings` (uncached) out of
    // `getSiteSettings` for exactly this; here the merge over the built-in copy
    // *is* the whole read, so doing it locally is the same answer without the
    // round trip.
    return NextResponse.json({ page: deepMerge(builtIn, content), published: publishing });
  } catch (err) {
    return serverError("PUT /seoteam/api/seo-pages/[slug]", err);
  }
}

/** Drop the override — the page goes back to the copy that ships in the repo. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const { slug } = await params;
  if (!getSeoLandingPage(slug)) return notFound(UNKNOWN_PAGE);

  try {
    const editor = await getEditorName();
    // Snapshot the published variant: it's what the public is about to lose, and
    // on a page that was only ever drafted the getter falls through to the draft
    // anyway — so this captures whichever work exists.
    await saveRevision("seo-page", slug, await getSeoPageContent(slug, "published"), editor);

    await connectDb();
    await SeoPageContentModel.deleteOne({ slug });

    revalidateFor("seo-page");
    await logAction({
      action: "reset",
      entityType: "seo-page",
      entityId: slug,
      summary: `Reset the /${slug} landing page to its built-in copy`,
      editor,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("DELETE /seoteam/api/seo-pages/[slug]", err);
  }
}
