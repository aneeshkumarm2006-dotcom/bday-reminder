import { NextResponse, type NextRequest } from "next/server";

import { connectDb } from "@/lib/blog/db";
import { sanitizePostHtml } from "@/lib/blog/sanitize";
import { logAction } from "@/lib/content/audit";
import { DEFAULT_LEGAL } from "@/lib/content/defaults";
import { getEditorName } from "@/lib/content/editor-server";
import { getLegalDoc } from "@/lib/content/get";
import { deepMerge } from "@/lib/content/merge";
import { LegalDocModel } from "@/lib/content/models";
import { revalidateFor } from "@/lib/content/revalidate";
import { saveRevision } from "@/lib/content/revisions";
import {
  badRequest,
  firstError,
  guardAdminRoute,
  readJson,
  serverError,
} from "@/lib/content/route-utils";
import type { LegalDocKey } from "@/lib/content/types";
import { legalDocSchema } from "@/lib/content/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ key: string }> };

const KEYS: LegalDocKey[] = ["privacy", "terms", "contact"];

function parseKey(value: string): LegalDocKey | null {
  return (KEYS as string[]).includes(value) ? (value as LegalDocKey) : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;

  const key = parseKey((await params).key);
  if (!key) return badRequest("Unknown document.");
  try {
    return NextResponse.json({ doc: await getLegalDoc(key) });
  } catch (err) {
    return serverError("GET /seoteam/api/legal/[key]", err);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const key = parseKey((await params).key);
  if (!key) return badRequest("Unknown document.");

  const json = await readJson(req);
  if (json === null) return badRequest("Invalid request body.");

  const parsed = legalDocSchema.safeParse({ ...(json as object), key });
  if (!parsed.success) return badRequest(firstError(parsed.error));

  try {
    const editor = await getEditorName();
    await saveRevision("legal", key, await getLegalDoc(key), editor);

    await connectDb();
    await LegalDocModel.findOneAndUpdate(
      { key },
      {
        $set: {
          ...parsed.data,
          key,
          // Sanitize on write with the blog's policy — no scripts, no iframes.
          html: sanitizePostHtml(parsed.data.html),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    revalidateFor("legal", { legalKey: key });
    await logAction({
      action: "update",
      entityType: "legal",
      entityId: key,
      summary: `Updated the ${key} page`,
      editor,
    });

    const stored = await LegalDocModel.findOne({ key }).lean();
    const doc = stored
      ? deepMerge(DEFAULT_LEGAL[key], stored as unknown as Record<string, unknown>)
      : DEFAULT_LEGAL[key];
    return NextResponse.json({ doc });
  } catch (err) {
    return serverError("PUT /seoteam/api/legal/[key]", err);
  }
}
