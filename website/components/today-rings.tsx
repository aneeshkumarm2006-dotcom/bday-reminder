"use client";

import { AnimatedRing } from "@/components/animated-ring";
import { TappableRing } from "@/components/interactive-ring";
import type { RingSize, RingState } from "@/components/ring";
import { dayCaption, useToday } from "@/lib/use-today";

/**
 * Marketing rings that circle the viewer's *today* instead of the build day.
 * They resolve the date on the client so a statically-built/cached page still
 * shows the real current date (the old server-computed date froze at build).
 */

/** Hero centerpiece: the draw-on ring, always on today. */
export function HeroTodayRing({ size = "xl" }: { size?: RingSize }) {
  const today = useToday();
  return <AnimatedRing {...dayCaption(today)} size={size} />;
}

/** A "how it works" step ring, dated `offset` days from today. */
export function StepRing({
  offset = 0,
  size = "lg",
  state = "upcoming",
}: {
  offset?: number;
  size?: RingSize;
  state?: RingState;
}) {
  const today = useToday();
  return <TappableRing {...dayCaption(today, offset)} size={size} state={state} />;
}
