import { NextResponse, type NextRequest } from "next/server";

import { listRevisions } from "@/lib/content/revisions";
import { guardAdminRoute, serverError } from "@/lib/content/route-utils";
import type { EntityType } from "@/lib/content/types";

export const dynamic = "force-dynamic";

const ENTITY_TYPES: EntityType[] = [
  "site",
  "landing",
  "page",
  "navigation",
  "meta",
  "structured-data",
  "legal",
];

export async function GET(req: NextRequest) {
  const guard = await guardAdminRoute({ requireDb: false });
  if (guard) return guard;

  const rawType = req.nextUrl.searchParams.get("entityType");
  const entityType = ENTITY_TYPES.includes(rawType as EntityType)
    ? (rawType as EntityType)
    : undefined;
  const entityId = req.nextUrl.searchParams.get("entityId") ?? undefined;

  try {
    return NextResponse.json({
      revisions: await listRevisions({ entityType, entityId, limit: 100 }),
    });
  } catch (err) {
    return serverError("GET /seoteam/api/revisions", err);
  }
}
