import { NextResponse, type NextRequest } from "next/server";

import { logAction } from "@/lib/content/audit";
import { getEditorName } from "@/lib/content/editor-server";
import {
  createRedirectRule,
  detectRedirectLoop,
  listRedirects,
} from "@/lib/content/redirects";
import { revalidateRedirects } from "@/lib/content/revalidate";
import {
  badRequest,
  firstError,
  guardAdminRoute,
  readJson,
  serverError,
} from "@/lib/content/route-utils";
import { redirectSchema } from "@/lib/content/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;
  try {
    return NextResponse.json({ redirects: await listRedirects() });
  } catch (err) {
    return serverError("GET /seoteam/api/redirects", err);
  }
}

export async function POST(req: NextRequest) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const json = await readJson(req);
  if (json === null) return badRequest("Invalid request body.");

  const parsed = redirectSchema.safeParse(json);
  if (!parsed.success) return badRequest(firstError(parsed.error));

  try {
    // Zod catches from === to; this catches the multi-hop version (A→B→A),
    // which is the one that actually reaches production.
    const loop = await detectRedirectLoop(parsed.data.from, parsed.data.to);
    if (loop) {
      return badRequest(`That would create a redirect loop through ${loop}.`);
    }

    const redirect = await createRedirectRule(parsed.data);
    revalidateRedirects();
    await logAction({
      action: "create",
      entityType: "redirect",
      entityId: redirect.id,
      summary: `Added ${redirect.type} ${redirect.from} → ${redirect.to}`,
      editor: await getEditorName(),
    });
    return NextResponse.json({ redirect }, { status: 201 });
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      return badRequest("A redirect from that path already exists.");
    }
    return serverError("POST /seoteam/api/redirects", err);
  }
}
