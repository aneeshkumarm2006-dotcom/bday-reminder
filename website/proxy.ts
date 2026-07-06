import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifySessionToken } from "@/lib/seo-auth/session";

/**
 * In Next.js 16 the `middleware` file convention was renamed to `proxy` and now
 * defaults to the Node.js runtime — which is why we can verify the HMAC session
 * (node:crypto) right here. This gates the private dashboards (/seoteam and the
 * analytics hub /analyticshub), which share one shared-password login:
 *   - unauthenticated UI  → redirect to the login screen
 *   - unauthenticated API → 401 JSON
 * The login routes stay public so an unauthenticated user can sign in. Handlers
 * re-verify the session too (see lib/seo-auth/server.ts, lib/analyticshub/auth.ts)
 * for defense in depth.
 */
const PUBLIC_PATHS = new Set(["/seoteam/login", "/seoteam/api/login"]);

/** Tag every gated response noindex at the HTTP layer too (survives even when
 *  the HTML noindex isn't crawled), then return it. */
function noindex(res: NextResponse): NextResponse {
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const session = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const isApi =
    pathname.startsWith("/seoteam/api/") || pathname.startsWith("/analyticshub/api/");

  if (PUBLIC_PATHS.has(pathname)) {
    // Already signed in and hitting the login page → send to the dashboard.
    if (session && pathname === "/seoteam/login") {
      return noindex(NextResponse.redirect(new URL("/seoteam", req.url)));
    }
    return noindex(NextResponse.next());
  }

  if (!session) {
    if (isApi) {
      return noindex(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    const loginUrl = new URL("/seoteam/login", req.url);
    if (pathname !== "/seoteam") loginUrl.searchParams.set("next", pathname);
    return noindex(NextResponse.redirect(loginUrl));
  }

  return noindex(NextResponse.next());
}

export const config = {
  matcher: ["/seoteam/:path*", "/analyticshub/:path*"],
};
