import { NextResponse, type NextRequest } from "next/server";

import { connectDb } from "@/lib/blog/db";
import { logAction } from "@/lib/content/audit";
import { getEditorName } from "@/lib/content/editor-server";
import { getSiteSettings, readSiteSettings } from "@/lib/content/get";
import { SINGLETON, SiteSettingsModel } from "@/lib/content/models";
import { revalidateFor } from "@/lib/content/revalidate";
import { saveRevision } from "@/lib/content/revisions";
import {
  badRequest,
  firstError,
  guardAdminRoute,
  readJson,
  serverError,
} from "@/lib/content/route-utils";
import { structuredDataSchema } from "@/lib/content/validation";

export const dynamic = "force-dynamic";

/**
 * Structured data is stored inside the SiteSettings singleton (it *is* site
 * identity, expressed for machines), but it gets its own endpoint and screen so
 * saving JSON-LD can't accidentally overwrite unrelated settings written in
 * another tab.
 */
export async function PUT(req: NextRequest) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const json = await readJson(req);
  if (json === null) return badRequest("Invalid request body.");

  const parsed = structuredDataSchema.safeParse(json);
  if (!parsed.success) return badRequest(firstError(parsed.error));

  try {
    const editor = await getEditorName();
    await saveRevision(
      "structured-data",
      SINGLETON,
      (await getSiteSettings()).structuredData,
      editor,
    );

    await connectDb();
    await SiteSettingsModel.findOneAndUpdate(
      { key: SINGLETON },
      { $set: { structuredData: parsed.data, key: SINGLETON } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    revalidateFor("structured-data");
    await logAction({
      action: "update",
      entityType: "structured-data",
      entityId: SINGLETON,
      summary: "Updated Organization / WebSite / App structured data",
      editor,
    });

    return NextResponse.json({ settings: await readSiteSettings() });
  } catch (err) {
    return serverError("PUT /seoteam/api/structured-data", err);
  }
}
