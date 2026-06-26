import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Small status pill (DESIGN.md §8). `tone` maps to the status token pairs:
 * neutral, biro (info), ok, snooze, warn, danger.
 */
const TONES: Record<string, string> = {
  neutral: "bg-surface-sunken text-ink-secondary",
  biro: "bg-biro-tint text-biro",
  ok: "bg-ok-bg text-ok-fg",
  snooze: "bg-snz-bg text-snz-fg",
  warn: "bg-warn-bg text-warn-fg",
  danger: "bg-danger-bg text-danger-fg",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: { tone?: keyof typeof TONES | string } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone] ?? TONES.neutral,
        className,
      )}
      {...props}
    />
  );
}
