import { NextResponse, type NextRequest } from "next/server";

import { logAction } from "@/lib/content/audit";
import { getEditorName } from "@/lib/content/editor-server";
import { getAllSitePages } from "@/lib/content/get";
import { createSitePage, isSlugAvailable } from "@/lib/content/pages";
import { revalidateFor } from "@/lib/content/revalidate";
import {
  badRequest,
  firstError,
  guardAdminRoute,
  readJson,
  serverError,
} from "@/lib/content/route-utils";
import { createSitePageSchema } from "@/lib/content/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;

  // ?slug=… doubles as the builder's live availability check.
  const slug = req.nextUrl.searchParams.get("slug");
  if (slug !== null) {
    const excludeId = req.nextUrl.searchParams.get("excludeId") ?? undefined;
    try {
      return NextResponse.json({ available: await isSlugAvailable(slug, excludeId) });
    } catch (err) {
      return serverError("GET /seoteam/api/pages?slug", err);
    }
  }

  try {
    return NextResponse.json({ pages: await getAllSitePages() });
  } catch (err) {
    return serverError("GET /seoteam/api/pages", err);
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const json = await readJson(req);
  if (json === null) return badRequest("Invalid request body.");

  const parsed = createSitePageSchema.safeParse(json);
  if (!parsed.success) return badRequest(firstError(parsed.error));

  try {
    const editor = await getEditorName();
    const page = await createSitePage({ ...parsed.data, author: parsed.data.author || editor });

    revalidateFor("page", { slug: page.slug });
    await logAction({
      action: "create",
      entityType: "page",
      entityId: page.id,
      summary: `Created page /${page.slug}`,
      editor,
    });

    return NextResponse.json({ page }, { status: 201 });
  } catch (err) {
    return serverError("POST /seoteam/api/pages", err);
  }
}
