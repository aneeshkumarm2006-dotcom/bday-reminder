"use client";

import { useEffect, useState } from "react";

/**
 * The viewer's local "today" as a `Date`. Read once at render, re-read on mount
 * (so a statically-built/cached page still lands on the real current day), and
 * refreshed at the next local midnight so a long-open tab rolls over on time.
 *
 * Used by anything that renders the current date - the brand ring, the demo
 * previews - so "today" is never a frozen calendar day.
 */
export function useToday(): Date {
  const [today, setToday] = useState(() => new Date());

  useEffect(() => {
    setToday(new Date());
    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const timer = setTimeout(
      () => setToday(new Date()),
      nextMidnight.getTime() - now.getTime() + 1000,
    );
    return () => clearTimeout(timer);
  }, []);

  return today;
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
