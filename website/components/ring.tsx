import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * ⭐ The ring — the one signature element (DESIGN.md §7), ported to the web for
 * brand consistency with the app. A hand-drawn wobbly circle (one SVG path,
 * tilted -4°, number upright) around an event's day number with a month caption.
 *
 * Used for **dates only**, never as decoration or behind avatars (DESIGN.md §1,
 * §13). States: upcoming · today (filled) · done (+ check) · past.
 */

export const RING_PATH =
  "M33 8 C49 7 58 19 57 32 C56 47 41 57 26 55 C12 53 6 39 9 25 C12 13 22 8 36 9";

export type RingState = "upcoming" | "today" | "done" | "past";
export type RingSize = "sm" | "md" | "lg" | "xl";

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

export function Ring({
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
        {filled ? <path d={RING_PATH} fill="var(--biro)" /> : null}
        <path
          d={RING_PATH}
          fill="none"
          stroke={outline}
          strokeWidth={STROKE[size]}
          strokeLinecap="round"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display leading-none tabular-nums"
          style={{ fontSize: NUM[size], fontWeight: 600, color: numColor }}
        >
          {day}
        </span>
        <span
          style={{
            fontSize: CAP[size],
            letterSpacing: "0.04em",
            color: monthColor,
            lineHeight: 1.2,
          }}
        >
          {month}
        </span>
      </div>

      {state === "done" ? (
        <span
          className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full bg-ok-bg"
          style={{ width: box * 0.32, height: box * 0.32 }}
        >
          <Check
            size={box * 0.2}
            strokeWidth={3.5}
            style={{ color: "var(--ok-fg)" }}
            aria-hidden="true"
          />
        </span>
      ) : null}
    </div>
  );
}
