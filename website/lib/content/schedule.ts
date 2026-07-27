import type { AnnouncementConfig, PageStatus } from "./types";

/**
 * Pure scheduling helpers — no cron anywhere in this admin. Everything that
 * "goes live at a time" is read-gated at request time instead, the same
 * approach the blog uses for scheduled posts: the page is force-dynamic, so a
 * scheduled item appears the moment its timestamp passes, with zero lag and
 * nothing to keep running.
 *
 * Kept side-effect-free so both the server render and the admin UI can share it.
 */

function parse(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** True when the announcement bar should render right now. */
export function isAnnouncementLive(
  announcement: AnnouncementConfig,
  now: number = Date.now(),
): boolean {
  if (!announcement.enabled) return false;
  if (!announcement.text.trim()) return false;
  const start = parse(announcement.startAt);
  if (start !== null && start > now) return false;
  const end = parse(announcement.endAt);
  if (end !== null && end <= now) return false;
  return true;
}

export type PageVisibility = "draft" | "scheduled" | "published";

/** A published page whose `publishedAt` is still in the future is "scheduled". */
export function derivePageVisibility(
  status: PageStatus,
  publishedAt: string | null,
  now: number = Date.now(),
): PageVisibility {
  if (status !== "published") return "draft";
  const at = parse(publishedAt);
  return at !== null && at > now ? "scheduled" : "published";
}
