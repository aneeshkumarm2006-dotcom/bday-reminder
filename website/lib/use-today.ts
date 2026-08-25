"use client";

import { useSyncExternalStore } from "react";

/**
 * The viewer's local "today" as a `Date`. Read once at render, re-read on mount
 * (so a statically-built/cached page still lands on the real current day), and
 * refreshed at the next local midnight so a long-open tab rolls over on time.
 *
 * Used by anything that renders the current date - the brand ring, the demo
 * previews - so "today" is never a frozen calendar day.
 *
 * Built on `useSyncExternalStore` rather than state seeded from an effect. The
 * server and the client legitimately disagree about the day, which is exactly
 * the split this hook exists for: `getServerSnapshot` keeps hydration matching
 * the prerendered HTML, then React re-reads the client snapshot. Re-seeding via
 * `setState` in an effect commits a render on the stale day first, and trips
 * react-hooks/set-state-in-effect.
 */

/** Stable per-day identity, so the snapshot only changes when the day does. */
function dayStamp(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function midnightAfter(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime() + 1000;
}

function subscribe(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const arm = () => {
    timer = setTimeout(() => {
      onChange();
      arm();
    }, midnightAfter(new Date()));
  };
  arm();
  return () => clearTimeout(timer);
}

/**
 * Snapshots must be referentially stable between days or React re-renders
 * forever, so cache the `Date` and only rebuild it when the stamp changes.
 */
let cached = new Date();
let cachedStamp = dayStamp(cached);

function getSnapshot(): Date {
  const now = new Date();
  const stamp = dayStamp(now);
  if (stamp !== cachedStamp) {
    cached = now;
    cachedStamp = stamp;
  }
  return cached;
}

/** Frozen at build/render time; replaced by the client snapshot after hydration. */
const serverToday = new Date();
function getServerSnapshot(): Date {
  return serverToday;
}

export function useToday(): Date {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Day number + month abbreviation for `days` from `base` (negative = past). */
export function dayCaption(
  base: Date,
  days = 0,
): { day: number; month: string } {
  const MONTH_ABBR = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  return { day: d.getDate(), month: MONTH_ABBR[d.getMonth()] };
}
