"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useState } from "react";

import { RING_PATH, type RingSize, type RingState } from "@/components/ring";
import { cn } from "@/lib/utils";

/**
 * The signature ring (DESIGN.md §7), made *alive* for the marketing site. Same
 * shape and states as {@link Ring}, but:
 *   - the outline draws on the first time it scrolls into view (§7.6),
 *   - state changes animate (fill fades, number recolors, the done-check pops),
 * so the on-page "screenshots" respond like the real app when tapped.
 *
 * Honors `prefers-reduced-motion`: no draw-on, no springs - it just snaps to the
 * finished state, exactly like the static {@link Ring}.
 */

const BOX: Record<RingSize, number> = { sm: 40, md: 56, lg: 72, xl: 132 };
const STROKE: Record<RingSize, number> = { sm: 2, md: 2.4, lg: 3, xl: 4.5 };
const NUM: Record<RingSize, number> = { sm: 16, md: 20, lg: 26, xl: 48 };
const CAP: Record<RingSize, number> = { sm: 10, md: 11, lg: 13, xl: 20 };

const STATE_WORD: Record<RingState, string> = {
  upcoming: "",
  today: ", today",
  done: ", done",
  past: ", past",
};

export function InteractiveRing({
  day,
  month,
  size = "md",
  state = "upcoming",
  animateIn = true,
  className,
}: {
  day: number;
  month: string;
  size?: RingSize;
  state?: RingState;
  /** Draw the outline on the first scroll into view. */
  animateIn?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const box = BOX[size];
  const filled = state === "today";
  const outline =
    state === "done"
      ? "var(--ink-muted)"
      : state === "past"
        ? "var(--border-strong)"
        : "var(--biro)";
  const numColor = filled
    ? "var(--paper)"
    : state === "upcoming"
      ? "var(--ink)"
      : "var(--ink-muted)";
  const monthColor = filled ? "rgba(252,251,248,0.78)" : "var(--ink-muted)";

  const spring = { type: "spring", stiffness: 520, damping: 30 } as const;
  const draws = animateIn && !reduced;

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: box, height: box }}
      role="img"
      aria-label={`${day} ${month}${STATE_WORD[state]}`}
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
          initial={false}
          animate={{ opacity: filled ? 1 : 0 }}
          transition={reduced ? { duration: 0 } : spring}
        />
        <motion.path
          d={RING_PATH}
          fill="none"
          strokeWidth={STROKE[size]}
          strokeLinecap="round"
          style={{ stroke: outline, transition: reduced ? undefined : "stroke 0.25s ease" }}
          initial={{ pathLength: draws ? 0 : 1 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={reduced ? { duration: 0 } : { duration: 0.7, ease: "easeOut" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="font-display leading-none tabular-nums"
          style={{ fontSize: NUM[size], fontWeight: 600 }}
          initial={false}
          animate={{ color: numColor }}
          transition={reduced ? { duration: 0 } : { duration: 0.25 }}
        >
          {day}
        </motion.span>
        <span
          style={{
            fontSize: CAP[size],
            letterSpacing: "0.04em",
            color: monthColor,
            lineHeight: 1.2,
            transition: reduced ? undefined : "color 0.25s ease",
          }}
        >
          {month}
        </span>
      </div>

      <AnimatePresence>
        {state === "done" ? (
          <motion.span
            key="check"
            className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-ok-bg"
            style={{ width: box * 0.32, height: box * 0.32 }}
            initial={reduced ? false : { scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { scale: 0, opacity: 0 }}
            transition={spring}
          >
            <Check
              size={box * 0.2}
              strokeWidth={3.5}
              style={{ color: "var(--ok-fg)" }}
              aria-hidden="true"
            />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * A ring you can tap to toggle its done-check on and off - used where the ring
 * stands on its own (the "How it works" steps) so even those respond to a click.
 */
export function TappableRing({
  day,
  month,
  size = "md",
  state = "upcoming",
  className,
}: {
  day: number;
  month: string;
  size?: RingSize;
  state?: RingState;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={() => setDone((d) => !d)}
      aria-pressed={done}
      aria-label={done ? `${day} ${month} - marked done. Tap to undo.` : `${day} ${month}. Tap to mark done.`}
      whileTap={reduced ? undefined : { scale: 0.93 }}
      className={cn("rounded-full", className)}
    >
      <InteractiveRing day={day} month={month} size={size} state={done ? "done" : state} />
    </motion.button>
  );
}
