/**
 * Auth for the hub reuses the existing /seoteam shared-password session (one
 * login covers both dashboards). The proxy gates /analyticshub, and every
 * protected handler re-checks here for defense in depth. `getSeoSession()` reads
 * the ambient request cookies via next/headers, so this works inside the
 * catch-all route handler with no extra plumbing.
 */
import { getSeoSession } from "@/lib/seo-auth/server";

export async function isAuthed(): Promise<boolean> {
  return (await getSeoSession()) !== null;
}
