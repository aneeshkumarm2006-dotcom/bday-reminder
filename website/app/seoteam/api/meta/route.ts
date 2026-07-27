import { NextResponse, type NextRequest } from "next/server";

import { connectDb } from "@/lib/blog/db";
import { logAction } from "@/lib/content/audit";
import { defaultPageMeta, getPageMeta } from "@/lib/content/get";
import { getEditorName } from "@/lib/content/editor-server";
import { deepMerge } from "@/lib/content/merge";
import { PageMetaModel } from "@/lib/content/models";
import { revalidateFor } from "@/lib/content/revalidate";
import { saveRevision } from "@/lib/content/revisions";
import {
  badRequest,
  firstError,
  guardAdminRoute,
  readJson,
  serverError,
} from "@/lib/content/route-utils";
import { normalizePath, pageMetaSchema } from "@/lib/content/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;
  const path = normalizePath(req.nextUrl.searchParams.get("path") ?? "/");
  try {
    return NextResponse.json({ meta: await getPageMeta(path) });
  } catch (err) {
    return serverError("GET /seoteam/api/meta", err);
  }
}

export async function PUT(req: NextRequest) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const json = await readJson(req);
  if (json === null) return badRequest("Invalid request body.");

  const parsed = pageMetaSchema.safeParse(json);
  if (!parsed.success) return badRequest(firstError(parsed.error));

  const { path, ...fields } = parsed.data;
  try {
    const editor = await getEditorName();
    await saveRevision("meta", path, await getPageMeta(path), editor);

    await connectDb();
    await PageMetaModel.findOneAndUpdate(
      { path },
      { $set: { ...fields, path } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    revalidateFor("meta", { path });
    await logAction({
      action: "update",
      entityType: "meta",
      entityId: path,
      summary: `Updated SEO for ${path}`,
      editor,
    });

    const doc = await PageMetaModel.findOne({ path }).lean();
    const meta = doc
      ? deepMerge(defaultPageMeta(path), doc as unknown as Record<string, unknown>)
      : defaultPageMeta(path);
    return NextResponse.json({ meta });
  } catch (err) {
    return serverError("PUT /seoteam/api/meta", err);
  }
}

/** Remove the override entirely — the route falls back to its hardcoded defaults. */
export async function DELETE(req: NextRequest) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const path = normalizePath(req.nextUrl.searchParams.get("path") ?? "");
  try {
    const editor = await getEditorName();
    await saveRevision("meta", path, await getPageMeta(path), editor);

    await connectDb();
    await PageMetaModel.deleteOne({ path });

    revalidateFor("meta", { path });
    await logAction({
      action: "reset",
      entityType: "meta",
      entityId: path,
      summary: `Reset SEO for ${path} to defaults`,
      editor,
    });

    return NextResponse.json({ meta: defaultPageMeta(path) });
  } catch (err) {
    return serverError("DELETE /seoteam/api/meta", err);
  }
}
