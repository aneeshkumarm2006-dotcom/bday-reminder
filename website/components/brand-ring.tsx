"use client";

import { Ring, type RingSize, type RingState } from "@/components/ring";
import { monthAbbr } from "@/lib/dates";
import { useToday } from "@/lib/use-today";

/**
 * The brand ring, always circling *today* in the viewer's local timezone -
 * "circle the date" taken literally. Used as the logo/wordmark mark across the
 * site so the date is never a frozen "12 Jun".
 *
 * It's a client component on purpose: the date must reflect the viewer's own
 * "today" regardless of when the page was built/cached, and it re-rolls at the
 * next local midnight so a long-open tab stays correct.
 */
export function BrandRing({
  size = "md",
  state = "upcoming",
}: {
  size?: RingSize;
  state?: RingState;
}) {
  const today = useToday();

  return (
    <Ring
      day={today.getDate()}
      month={monthAbbr(today.getMonth() + 1)}
      size={size}
      state={state}
    />
  );
}
