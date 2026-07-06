/**
 * The ONE serverless function for the entire analytics hub API. The sub-path is
 * parsed from `req.url` (NOT the catch-all params) — this is the robust pattern
 * and forces the handler dynamic. Node runtime because the data layer uses
 * node:crypto (HKDF / AES-GCM / RS256) and per-request cookies.
 */
import type { NextRequest } from "next/server";

import { dispatch, parseSubpath } from "@/lib/analyticshub/dispatch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: NextRequest): Promise<Response> {
  return dispatch("GET", parseSubpath(req.url), req);
}

export function POST(req: NextRequest): Promise<Response> {
  return dispatch("POST", parseSubpath(req.url), req);
}
