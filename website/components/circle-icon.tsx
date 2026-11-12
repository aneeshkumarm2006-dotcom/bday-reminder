import type { ReactNode } from "react";

/**
 * An icon set inside a circle, the same mark the app draws around a date.
 *
 * `ring` is the default, like an upcoming date: a biro outline. `filled` is
 * reserved for the thing that matters most in a group, like today's date: a
 * solid biro disc with the icon knocked out in white. Use one shape language
 * everywhere rather than mixing in rounded squares.
 */
const SIZES = {
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-14 w-14",
} as const;

export function CircleIcon({
  children,
  size = "md",
  variant = "ring",
  className = "",
}: {
  children: ReactNode;
  size?: keyof typeof SIZES;
  variant?: "ring" | "filled";
  className?: string;
}) {
  const look =
    variant === "filled"
      ? "bg-biro text-paper"
      : "border-2 border-biro bg-surface text-biro";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${SIZES[size]} ${look} ${className}`}
    >
      {children}
    </span>
  );
}
