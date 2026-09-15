import { NextResponse, type NextRequest } from "next/server";

import { connectDb } from "@/lib/blog/db";
import { logAction } from "@/lib/content/audit";
import { getEditorName } from "@/lib/content/editor-server";
import { getLandingContent } from "@/lib/content/get";
import { LandingContentModel, SINGLETON } from "@/lib/content/models";
import { revalidateFor } from "@/lib/content/revalidate";
import { sanitizeLandingSections } from "@/lib/content/sanitize-blocks";
import { saveRevision } from "@/lib/content/revisions";
import {
  badRequest,
  firstError,
  guardAdminRoute,
  readJson,
  serverError,
} from "@/lib/content/route-utils";
import { saveLandingSchema } from "@/lib/content/validation";
import { pingIndexNow } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;
  const variant = req.nextUrl.searchParams.get("variant") === "published" ? "published" : "draft";
  try {
    return NextResponse.json(await getLandingContent(variant));
  } catch (err) {
    return serverError("GET /seoteam/api/landing", err);
  }
}

/**
 * Save the landing page.
 *
 * `mode: "draft"` writes only the draft variant — the live homepage is
 * untouched, and `/seoteam/preview/landing` renders it. `mode: "publish"`
 * copies the same payload into `published` and revalidates `/`, which is what
 * makes an edit appear instantly despite the homepage's hourly ISR window.
 */
export async function PUT(req: NextRequest) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const json = await readJson(req);
  if (json === null) return badRequest("Invalid request body.");

  const parsed = saveLandingSchema.safeParse(json);
  if (!parsed.success) return badRequest(firstError(parsed.error));

  // A `blocks` section can carry rich text and hand-written HTML, so the whole
  // list goes through the same sanitizing pass the page builder uses before any
  // of it reaches Mongo.
  const sections = sanitizeLandingSections(parsed.data.sections);
  const publishing = parsed.data.mode === "publish";

  try {
    const editor = await getEditorName();
    await saveRevision(
      "landing",
      SINGLETON,
      await getLandingContent(publishing ? "published" : "draft"),
      editor,
    );

    await connectDb();
    await LandingContentModel.findOneAndUpdate(
      { key: SINGLETON },
      {
        $set: {
          key: SINGLETON,
          draft: { sections },
          ...(publishing ? { published: { sections }, publishedAt: new Date() } : {}),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    if (publishing) {
      revalidateFor("landing");
      // Publishing rewrites the homepage; a draft save leaves it untouched.
      pingIndexNow("/");
    }

    const visible = sections.filter((s) => s.visible).length;
    await logAction({
      action: publishing ? "publish" : "save-draft",
      entityType: "landing",
      entityId: SINGLETON,
      summary: `${publishing ? "Published" : "Saved a draft of"} the landing page (${visible}/${sections.length} sections visible)`,
      editor,
    });

    return NextResponse.json({ sections, published: publishing });
  } catch (err) {
    return serverError("PUT /seoteam/api/landing", err);
  }
}
