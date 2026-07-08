import * as React from "react";

import { filenameFromPublicId } from "@/lib/blog/image-url";
import type { MediaRow } from "@/lib/blog/types";

/** Sort/filter/view state shared by the grid and table views. */
export type SortKey = "filename" | "size" | "dimensions" | "uploaded" | "usage";
export type SortDir = "asc" | "desc";
export type MediaFilter = "all" | "used" | "unused" | "missing-alt";
export type ViewMode = "grid" | "table";

export const VIEW_STORAGE_KEY = "seoteam:media:view";

/** Representative alt for display: the first non-empty usage alt, else "". */
export function displayAlt(row: MediaRow): string {
  for (const u of row.usedInPosts) if (u.alt) return u.alt;
  return "";
}

/** Distinct posts an image appears in (collapses multiple usages per post). */
export function distinctPosts(
  row: MediaRow,
): { postId: string; slug: string; title: string }[] {
  const seen = new Set<string>();
  const out: { postId: string; slug: string; title: string }[] = [];
  for (const u of row.usedInPosts) {
    if (seen.has(u.postId)) continue;
    seen.add(u.postId);
    out.push({ postId: u.postId, slug: u.slug, title: u.title });
  }
  return out;
}

/** Apply the search box + All/Used/Unused/Missing-alt filter (used by both views). */
export function filterRows(
  rows: MediaRow[],
  search: string,
  filter: MediaFilter,
): MediaRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter === "used" && row.unused) return false;
    if (filter === "unused" && !row.unused) return false;
    if (filter === "missing-alt" && !row.missingAlt) return false;
    if (q) {
      const hay = [
        row.image.publicId,
        filenameFromPublicId(row.image.publicId),
        row.image.format,
        row.image.tags.join(" "),
        row.usedInPosts.map((u) => u.title).join(" "),
        displayAlt(row),
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function uploadedTime(row: MediaRow): number {
  const t = Date.parse(row.image.cloudinaryCreatedAt ?? row.image.createdAt);
  return Number.isNaN(t) ? 0 : t;
}

const viewListeners = new Set<() => void>();

function subscribeView(callback: () => void): () => void {
  viewListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    viewListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * Grid/table preference backed by localStorage. `useSyncExternalStore` is the
 * idiomatic way to read external mutable state — it renders the server snapshot
 * ("grid") during SSR/hydration then swaps in the saved value with no hydration
 * mismatch and no set-state-in-effect.
 */
export function useStoredView(): [ViewMode, (next: ViewMode) => void] {
  const view = React.useSyncExternalStore<ViewMode>(
    subscribeView,
    () => (window.localStorage.getItem(VIEW_STORAGE_KEY) === "table" ? "table" : "grid"),
    () => "grid",
  );
  const setView = React.useCallback((next: ViewMode) => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    for (const cb of viewListeners) cb();
  }, []);
  return [view, setView];
}

/** Return a new array sorted by the chosen key/direction. */
export function sortRows(rows: MediaRow[], key: SortKey, dir: SortDir): MediaRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "filename":
        cmp = filenameFromPublicId(a.image.publicId).localeCompare(
          filenameFromPublicId(b.image.publicId),
        );
        break;
      case "size":
        cmp = a.image.bytes - b.image.bytes;
        break;
      case "dimensions":
        cmp = a.image.width * a.image.height - b.image.width * b.image.height;
        break;
      case "uploaded":
        cmp = uploadedTime(a) - uploadedTime(b);
        break;
      case "usage":
        cmp = a.usedInPosts.length - b.usedInPosts.length;
        break;
    }
    return cmp * sign;
  });
}
