import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "./session";

/**
 * Read + verify the dashboard session inside a Server Component or Route Handler.
 * Defense in depth: proxy.ts already gates /seoteam, but every mutating handler
 * re-checks here too (Next docs explicitly recommend verifying auth in the
 * handler, not relying on the proxy alone).
 */
export async function getSeoSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function isSeoAuthenticated(): Promise<boolean> {
  return (await getSeoSession()) !== null;
}
