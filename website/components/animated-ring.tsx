"use client";

import { motion, useReducedMotion } from "framer-motion";

import { RING_PATH, type RingSize } from "@/components/ring";

/**
 * The day-of ring draw-on (DESIGN.md §7.6, §9) — the app's one signature
 * motion, reused once on the web hero. The stroke draws on (~600ms ease-out),
 * the fill comes in (~250ms), and the number cross-fades to paper. With
 * `prefers-reduced-motion`, it renders the completed filled state instantly.
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

  return (
    <div
      className="relative shrink-0"
      style={{ width: box, height: box }}
      role="img"
      aria-label={`${day} ${month}, today`}
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
          animate={{ opacity: 1 }}
          transition={reduced ? { duration: 0 } : { delay: 0.6, duration: 0.25 }}
        />
        <motion.path
          d={RING_PATH}
          fill="none"
          stroke="var(--biro)"
          strokeWidth={STROKE[size]}
          strokeLinecap="round"
          initial={{ pathLength: reduced ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={reduced ? { duration: 0 } : { duration: 0.6, ease: "easeOut" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-display leading-none tabular-nums"
          style={{ fontSize: NUM[size], fontWeight: 600 }}
          initial={{ color: reduced ? "var(--paper)" : "var(--ink)" }}
          animate={{ color: "var(--paper)" }}
          transition={reduced ? { duration: 0 } : { delay: 0.65, duration: 0.25 }}
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
    </div>
  );
}
