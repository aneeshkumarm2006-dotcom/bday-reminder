import { NextResponse, type NextRequest } from "next/server";

import { connectDb } from "@/lib/blog/db";
import { logAction } from "@/lib/content/audit";
import { getEditorName } from "@/lib/content/editor-server";
import { getBuiltInPages, readBuiltInPages } from "@/lib/content/get";
import { BuiltInPagesModel, SINGLETON } from "@/lib/content/models";
import { revalidateFor } from "@/lib/content/revalidate";
import { saveRevision } from "@/lib/content/revisions";
import {
  badRequest,
  firstError,
  guardAdminRoute,
  readJson,
  serverError,
} from "@/lib/content/route-utils";
import { sanitizeBlocks } from "@/lib/content/sanitize-blocks";
import { builtInPagesSchema } from "@/lib/content/validation";

export const dynamic = "force-dynamic";

/**
 * The four routes whose body is generated in code — the blog index, a post
 * page's furniture, the 404, and the contact page's extras.
 *
 * One singleton document, saved whole, with no draft/published split: these are
 * short strings and small block lists on pages that are read-gated or dynamic
 * anyway, so a staging variant would be ceremony without a payoff. Revisions
 * still snapshot every save, which is what "undo" actually needs.
 */
export async function GET() {
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;
  try {
    return NextResponse.json({ pages: await getBuiltInPages() });
  } catch (err) {
    return serverError("GET /seoteam/api/built-in", err);
  }
}

export async function PUT(req: NextRequest) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const json = await readJson(req);
  if (json === null) return badRequest("Invalid request body.");

  const parsed = builtInPagesSchema.safeParse(json);
  if (!parsed.success) return badRequest(firstError(parsed.error));

  // Every block list here can hold rich text or hand-written HTML, so all five
  // go through the shared sanitizing pass before anything reaches Mongo.
  const pages = {
    blogIndex: {
      ...parsed.data.blogIndex,
      blocksBefore: sanitizeBlocks(parsed.data.blogIndex.blocksBefore),
      blocksAfter: sanitizeBlocks(parsed.data.blogIndex.blocksAfter),
    },
    blogPost: {
      ...parsed.data.blogPost,
      blocksAfter: sanitizeBlocks(parsed.data.blogPost.blocksAfter),
    },
    notFound: {
      ...parsed.data.notFound,
      blocksAfter: sanitizeBlocks(parsed.data.notFound.blocksAfter),
    },
    contact: {
      ...parsed.data.contact,
      blocksAfter: sanitizeBlocks(parsed.data.contact.blocksAfter),
    },
  };

  try {
    const editor = await getEditorName();
    await saveRevision("built-in", SINGLETON, await getBuiltInPages(), editor);

    await connectDb();
    await BuiltInPagesModel.findOneAndUpdate(
      { key: SINGLETON },
      { $set: { key: SINGLETON, ...pages } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    revalidateFor("built-in");
    await logAction({
      action: "save",
      entityType: "built-in",
      entityId: SINGLETON,
      summary: "Updated the built-in pages (blog, post, 404, contact)",
      editor,
    });

    // Uncached read, for the same reason Site settings has one: `getBuiltInPages`
    // is memoized per request and already ran above for the revision snapshot,
    // so it would hand back the pre-save value.
    return NextResponse.json({ pages: await readBuiltInPages() });
  } catch (err) {
    return serverError("PUT /seoteam/api/built-in", err);
  }
}
