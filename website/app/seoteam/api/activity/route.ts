import { NextResponse, type NextRequest } from "next/server";

import { listAudit } from "@/lib/content/audit";
import { guardAdminRoute, serverError } from "@/lib/content/route-utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;

  const entityType = req.nextUrl.searchParams.get("entityType") ?? undefined;
  const editor = req.nextUrl.searchParams.get("editor") ?? undefined;
  const days = Number.parseInt(req.nextUrl.searchParams.get("days") ?? "", 10);

  try {
    return NextResponse.json({
      entries: await listAudit({
        entityType,
        editor,
        since: Number.isFinite(days)
          ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
          : undefined,
        limit: 300,
      }),
    });
  } catch (err) {
    return serverError("GET /seoteam/api/activity", err);
  }
}
