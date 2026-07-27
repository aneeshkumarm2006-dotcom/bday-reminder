import { NextResponse, type NextRequest } from "next/server";

import { connectDb } from "@/lib/blog/db";
import { logAction } from "@/lib/content/audit";
import { DEFAULT_NAV } from "@/lib/content/defaults";
import { getEditorName } from "@/lib/content/editor-server";
import { getNavigation } from "@/lib/content/get";
import { deepMerge } from "@/lib/content/merge";
import { NavigationConfigModel, SINGLETON } from "@/lib/content/models";
import { revalidateFor } from "@/lib/content/revalidate";
import { saveRevision } from "@/lib/content/revisions";
import {
  badRequest,
  firstError,
  guardAdminRoute,
  readJson,
  serverError,
} from "@/lib/content/route-utils";
import { navigationSchema } from "@/lib/content/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;
  try {
    return NextResponse.json({ navigation: await getNavigation() });
  } catch (err) {
    return serverError("GET /seoteam/api/navigation", err);
  }
}

export async function PUT(req: NextRequest) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const json = await readJson(req);
  if (json === null) return badRequest("Invalid request body.");

  const parsed = navigationSchema.safeParse(json);
  if (!parsed.success) return badRequest(firstError(parsed.error));

  try {
    const editor = await getEditorName();
    await saveRevision("navigation", SINGLETON, await getNavigation(), editor);

    await connectDb();
    await NavigationConfigModel.findOneAndUpdate(
      { key: SINGLETON },
      { $set: { ...parsed.data, key: SINGLETON } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Header and footer render in the marketing layout, so every route beneath
    // it has to be invalidated — not just the homepage.
    revalidateFor("navigation");
    await logAction({
      action: "update",
      entityType: "navigation",
      entityId: SINGLETON,
      summary: `Updated navigation (${parsed.data.header.links.length} header links, ${parsed.data.footer.groups.length} footer group(s))`,
      editor,
    });

    const doc = await NavigationConfigModel.findOne({ key: SINGLETON }).lean();
    const navigation = doc
      ? deepMerge(DEFAULT_NAV, doc as unknown as Record<string, unknown>)
      : DEFAULT_NAV;
    return NextResponse.json({ navigation });
  } catch (err) {
    return serverError("PUT /seoteam/api/navigation", err);
  }
}
