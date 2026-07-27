import { NextResponse, type NextRequest } from "next/server";

import { logAction } from "@/lib/content/audit";
import { getEditorName } from "@/lib/content/editor-server";
import {
  deleteRedirectRule,
  detectRedirectLoop,
  updateRedirectRule,
} from "@/lib/content/redirects";
import { revalidateRedirects } from "@/lib/content/revalidate";
import {
  badRequest,
  firstError,
  guardAdminRoute,
  notFound,
  readJson,
  serverError,
} from "@/lib/content/route-utils";
import { updateRedirectSchema } from "@/lib/content/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const { id } = await params;
  const json = await readJson(req);
  if (json === null) return badRequest("Invalid request body.");

  const parsed = updateRedirectSchema.safeParse(json);
  if (!parsed.success) return badRequest(firstError(parsed.error));

  try {
    if (parsed.data.from && parsed.data.to) {
      const loop = await detectRedirectLoop(parsed.data.from, parsed.data.to, id);
      if (loop) return badRequest(`That would create a redirect loop through ${loop}.`);
    }

    const redirect = await updateRedirectRule(id, parsed.data);
    if (!redirect) return notFound("Redirect not found.");

    revalidateRedirects();
    await logAction({
      action: "update",
      entityType: "redirect",
      entityId: redirect.id,
      summary: `Updated ${redirect.from} → ${redirect.to}`,
      editor: await getEditorName(),
    });
    return NextResponse.json({ redirect });
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      return badRequest("A redirect from that path already exists.");
    }
    return serverError("PATCH /seoteam/api/redirects/[id]", err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRoute();
  if (guard) return guard;

  const { id } = await params;
  try {
    const removed = await deleteRedirectRule(id);
    if (!removed) return notFound("Redirect not found.");
    revalidateRedirects();
    await logAction({
      action: "delete",
      entityType: "redirect",
      entityId: id,
      summary: "Deleted a redirect",
      editor: await getEditorName(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("DELETE /seoteam/api/redirects/[id]", err);
  }
}
