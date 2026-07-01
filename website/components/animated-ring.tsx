"use client";

import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { useCallback, useEffect } from "react";

import { RING_PATH, type RingSize } from "@/components/ring";

/**
 * The day-of ring draw-on (DESIGN.md §7.6, §9) - the app's one signature
 * motion, reused once on the web hero. The stroke draws on (~600ms ease-out),
 * the fill comes in (~250ms), and the number cross-fades to paper. It replays
 * on tap, so the hero's centerpiece is something you can poke at. With
 * `prefers-reduced-motion`, it renders the completed filled state instantly and
 * stays put.
 */

const BOX: Record<RingSize, number> = { sm: 40, md: 56, lg: 72, xl: 132 };
const STROKE: Record<RingSize, number> = { sm: 2, md: 2.4, lg: 3, xl: 4.5 };
const NUM: Record<RingSize, number> = { sm: 16, md: 20, lg: 26, xl: 48 };
const CAP: Record<RingSize, number> = { sm: 10, md: 11, lg: 13, xl: 20 };

export function AnimatedRing({
  day,
  month,
  size = "xl",
}: {
  day: number;
  month: string;
  size?: RingSize;
}) {
  const reduced = useReducedMotion();
  const box = BOX[size];

  const stroke = useAnimationControls();
  const fill = useAnimationControls();
  const num = useAnimationControls();

  const play = useCallback(async () => {
    if (reduced) {
      stroke.set({ pathLength: 1 });
      fill.set({ opacity: 1 });
      num.set({ color: "var(--paper)" });
      return;
    }
    stroke.set({ pathLength: 0 });
    fill.set({ opacity: 0 });
    num.set({ color: "var(--ink)" });
    await stroke.start({ pathLength: 1, transition: { duration: 0.6, ease: "easeOut" } });
    fill.start({ opacity: 1, transition: { duration: 0.25 } });
    num.start({ color: "var(--paper)", transition: { duration: 0.25 } });
  }, [reduced, stroke, fill, num]);

  useEffect(() => {
    play();
  }, [play]);

  return (
    <motion.button
      type="button"
      onClick={play}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      className="relative block shrink-0 rounded-full"
      style={{ width: box, height: box }}
      aria-label={`${day} ${month}, today. Replay the animation.`}
    >
      <svg
        viewBox="0 0 64 64"
        width={box}
        height={box}
        className="absolute inset-0"
        style={{ transform: "rotate(-4deg)" }}
        aria-hidden="true"
      >
        <motion.path
          d={RING_PATH}
          fill="var(--biro)"
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={fill}
        />
        <motion.path
          d={RING_PATH}
          fill="none"
          stroke="var(--biro)"
          strokeWidth={STROKE[size]}
          strokeLinecap="round"
          initial={{ pathLength: reduced ? 1 : 0 }}
          animate={stroke}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-display leading-none tabular-nums"
          style={{ fontSize: NUM[size], fontWeight: 600 }}
          initial={{ color: reduced ? "var(--paper)" : "var(--ink)" }}
          animate={num}
        >
          {day}
        </motion.span>
        <span
          style={{
            fontSize: CAP[size],
            letterSpacing: "0.04em",
            color: "rgba(252,251,248,0.78)",
            lineHeight: 1.2,
          }}
        >
          {month}
        </span>
      </div>
    </motion.button>
  );
}
