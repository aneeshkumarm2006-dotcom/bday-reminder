import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  EDITOR_COOKIE,
  EDITOR_COOKIE_MAX_AGE,
  normalizeEditorName,
} from "@/lib/content/editor";
import {
  checkRateLimit,
  recordFailure,
  recordSuccess,
} from "@/lib/seo-auth/rate-limit";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  isDashboardConfigured,
  verifyPassword,
} from "@/lib/seo-auth/session";

const bodySchema = z.object({
  password: z.string().min(1),
  /** Optional display name for edit attribution (see lib/content/editor.ts). */
  editorName: z.string().max(200).optional(),
});

function clientKey(req: NextRequest): string {
  // Prefer the platform-set x-real-ip (harder to spoof than X-Forwarded-For,
  // whose leftmost entry is client-controllable). The global backstop in the
  // rate limiter covers the residual IP-rotation case regardless.
  const real = req.headers.get("x-real-ip");
  if (real?.trim()) return real.trim();
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  if (!isDashboardConfigured()) {
    return NextResponse.json(
      {
        error:
          "The dashboard isn't configured. Set SEO_DASHBOARD_PASSWORD and a 32+ char SESSION_SECRET.",
      },
      { status: 500 },
    );
  }

  const key = clientKey(req);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    const mins = Math.ceil(limit.retryAfterSec / 60);
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${mins} minute(s).` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    recordFailure(key);
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  if (!verifyPassword(parsed.data.password)) {
    recordFailure(key);
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  recordSuccess(key);
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  // Attribution only: deliberately unsigned and readable by client code, so the
  // admin UI can show "editing as …". Nothing authorizes off this value.
  const editorName = normalizeEditorName(parsed.data.editorName);
  if (editorName) {
    store.set(EDITOR_COOKIE, editorName, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: EDITOR_COOKIE_MAX_AGE,
    });
  }

  return NextResponse.json({ ok: true });
}
