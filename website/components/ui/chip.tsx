import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Toggle chip (DESIGN.md §8) — a pill the user taps on/off. Used for relationship
 * tag filters, reminder lead-times, and channel toggles. Selected = filled biro
 * tint with a biro border; idle = quiet surface.
 */
export function Chip({
  selected = false,
  className,
  type = "button",
  ...props
}: { selected?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface",
        selected
          ? "border-biro bg-biro-tint text-biro"
          : "border-border-strong bg-surface text-ink-secondary hover:bg-surface-sunken",
        className,
      )}
      {...props}
    />
  );
}
