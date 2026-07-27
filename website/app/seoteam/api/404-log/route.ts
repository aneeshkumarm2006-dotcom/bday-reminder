import { NextResponse, type NextRequest } from "next/server";

import { dismissNotFound, listNotFoundHits } from "@/lib/content/redirects";
import { guardAdminRoute, serverError } from "@/lib/content/route-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;
  try {
    return NextResponse.json({ hits: await listNotFoundHits() });
  } catch (err) {
    return serverError("GET /seoteam/api/404-log", err);
  }
}

/** Dismiss one logged path (it re-appears if it's hit again). */
export async function DELETE(req: NextRequest) {
  const guard = await guardAdminRoute();
  if (guard) return guard;
  const path = req.nextUrl.searchParams.get("path") ?? "";
  try {
    await dismissNotFound(path);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverError("DELETE /seoteam/api/404-log", err);
  }
}
