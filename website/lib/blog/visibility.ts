/**
 * Pure, isomorphic helpers for a post's publishing state. "Scheduled" is not a
 * stored enum — it's a *derived* state: a published post whose `publishedAt` is
 * still in the future (the public read-gate in posts.ts hides it until then).
 * Kept side-effect-free so it's safe in server components and the client editor.
 */
import type { PostStatus } from "./types";

export type Visibility = "draft" | "visible" | "scheduled";

/** True when a published post's publish time hasn't arrived yet. */
export function isScheduled(
  status: PostStatus,
  publishedAt: string | null,
  now: number = Date.now(),
): boolean {
  return (
    status === "published" &&
    !!publishedAt &&
    new Date(publishedAt).getTime() > now
  );
}

/** Map (status, publishedAt) → the editor's three-way visibility choice. */
export function deriveVisibility(
  status: PostStatus,
  publishedAt: string | null,
  now: number = Date.now(),
): Visibility {
  if (status !== "published") return "draft";
  return isScheduled(status, publishedAt, now) ? "scheduled" : "visible";
}
