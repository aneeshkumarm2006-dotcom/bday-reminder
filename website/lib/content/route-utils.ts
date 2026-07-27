import { NextResponse } from "next/server";
import type { ZodError } from "zod";

import { isDbConfigured } from "@/lib/blog/db";
import { getSeoSession } from "@/lib/seo-auth/server";

/**
 * Boilerplate shared by every admin route handler, so the security checks are
 * one call rather than nine copies that can drift:
 *
 *   const guard = await guardAdminRoute();
 *   if (guard) return guard;          // 401 or 503, already shaped
 *
 * `proxy.ts` already gates `/seoteam/**`, but Next's own docs are explicit that
 * auth belongs in the handler too — the proxy is a convenience, not the fence.
 */

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function dbUnavailable(): NextResponse {
  return NextResponse.json(
    {
      error:
        "The database isn't connected. Set MONGODB_URI in website/.env.local to save content.",
    },
    { status: 503 },
  );
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found."): NextResponse {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function serverError(scope: string, err: unknown): NextResponse {
  console.error(`${scope} failed:`, err);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 },
  );
}

/** 401 when signed out, 503 when there's no database. Null means "carry on". */
export async function guardAdminRoute(
  options: { requireDb?: boolean } = { requireDb: true },
): Promise<NextResponse | null> {
  if (!(await getSeoSession())) return unauthorized();
  if (options.requireDb !== false && !isDbConfigured()) return dbUnavailable();
  return null;
}

/** Parse a JSON body, returning null (not throwing) on malformed input. */
export async function readJson(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/** First human-readable message from a ZodError. */
export function firstError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input.";
  const where = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${where}${issue.message}`;
}
