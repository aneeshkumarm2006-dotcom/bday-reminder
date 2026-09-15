import { NextResponse, type NextRequest } from "next/server";

import { connectDb } from "@/lib/blog/db";
import { logAction } from "@/lib/content/audit";
import { getEditorName } from "@/lib/content/editor-server";
import { isSitePageLive } from "@/lib/content/get";
import { PageMetaModel } from "@/lib/content/models";
import {
  deleteSitePage,
  duplicateSitePage,
  getSitePageById,
  updateSitePage,
} from "@/lib/content/pages";
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
import { updateSitePageSchema } from "@/lib/content/validation";
import { pingIndexNow } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;
  const { id } = await params;
  try {
    const page = await getSitePageById(id);
    return page ? NextResponse.json({ page }) : notFound("Page not found.");
  } catch (err) {
    return serverError("GET /seoteam/api/pages/[id]", err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const { id } = await params;
  const json = await readJson(req);
  if (json === null) return badRequest("Invalid request body.");

  const parsed = updateSitePageSchema.safeParse(json);
  if (!parsed.success) return badRequest(firstError(parsed.error));

  try {
    const before = await getSitePageById(id);
    if (!before) return notFound("Page not found.");

    const editor = await getEditorName();
    await saveRevision("page", id, before, editor);

    const page = await updateSitePage(id, parsed.data);
    if (!page) return notFound("Page not found.");

    // A renamed slug orphans the old URL's cache entry and its SEO override, so
    // clear both. (The old → new redirect is offered in the builder UI.)
    if (before.slug !== page.slug) {
      revalidateFor("page", { slug: before.slug });
      await connectDb();
      await PageMetaModel.updateOne(
        { path: `/${before.slug}` },
        { $set: { path: `/${page.slug}` } },
      ).catch(() => undefined);
    }
    revalidateFor("page", { slug: page.slug });

    // Old and new on a rename, so the old URL's 404 (or redirect) is read as
    // promptly as the new page is. `force` because unpublishing and flipping to
    // noindex are precisely the edits an engine has to come back and see — but
    // an edit that leaves a draft a draft never had a public URL to announce.
    if (isSitePageLive(page) || isSitePageLive(before)) {
      pingIndexNow(
        before.slug !== page.slug ? [`/${page.slug}`, `/${before.slug}`] : `/${page.slug}`,
        { force: true },
      );
    }

    await logAction({
      action: "update",
      entityType: "page",
      entityId: page.id,
      summary: `Updated page /${page.slug}`,
      editor,
    });

    return NextResponse.json({ page });
  } catch (err) {
    return serverError("PATCH /seoteam/api/pages/[id]", err);
  }
}

/** POST to an existing page duplicates it as a fresh draft. */
export async function POST(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const { id } = await params;
  try {
    const page = await duplicateSitePage(id);
    if (!page) return notFound("Page not found.");

    await logAction({
      action: "duplicate",
      entityType: "page",
      entityId: page.id,
      summary: `Duplicated a page as /${page.slug}`,
      editor: await getEditorName(),
    });

    return NextResponse.json({ page }, { status: 201 });
  } catch (err) {
    return serverError("POST /seoteam/api/pages/[id]", err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const { id } = await params;
  try {
    const editor = await getEditorName();
    const before = await getSitePageById(id);
    if (!before) return notFound("Page not found.");

    // Snapshot first — deletion is the one action a revision can't undo through
    // the normal restore path, so the snapshot is the only copy left.
    await saveRevision("page", id, before, editor);
    await deleteSitePage(id);

    revalidateFor("page", { slug: before.slug });
    if (isSitePageLive(before)) pingIndexNow(`/${before.slug}`, { force: true });

    await connectDb();
    await PageMetaModel.deleteOne({ path: `/${before.slug}` }).catch(() => undefined);

    await logAction({
      action: "delete",
      entityType: "page",
      entityId: id,
      summary: `Deleted page /${before.slug}`,
      editor,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("DELETE /seoteam/api/pages/[id]", err);
  }
}
