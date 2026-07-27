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
import { siteSettingsSchema } from "@/lib/content/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;
  try {
    return NextResponse.json({ settings: await getSiteSettings() });
  } catch (err) {
    return serverError("GET /seoteam/api/site", err);
  }
}

export async function PUT(req: NextRequest) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const json = await readJson(req);
  if (json === null) return badRequest("Invalid request body.");

  const parsed = siteSettingsSchema.safeParse(json);
  if (!parsed.success) return badRequest(firstError(parsed.error));

  try {
    const editor = await getEditorName();
    // Snapshot the *effective* pre-save state so a restore reproduces exactly
    // what the site was rendering, not a half-empty stored doc.
    await saveRevision("site", SINGLETON, await getSiteSettings(), editor);

    await connectDb();
    await SiteSettingsModel.findOneAndUpdate(
      { key: SINGLETON },
      { $set: { ...parsed.data, key: SINGLETON } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    revalidateFor("site");
    await logAction({
      action: "update",
      entityType: "site",
      entityId: SINGLETON,
      summary: parsed.data.seo.indexingEnabled
        ? "Updated site settings"
        : "Updated site settings — site-wide indexing is OFF",
      editor,
    });

    // Uncached read so the response reflects the write, not the memoized
    // pre-save value the revision snapshot already pulled through cache().
    return NextResponse.json({ settings: await readSiteSettings() });
  } catch (err) {
    return serverError("PUT /seoteam/api/site", err);
  }
}
