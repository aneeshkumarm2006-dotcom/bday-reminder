import Image from "next/image";

import { cn } from "@/lib/utils";

/** Initials from a name, e.g. "Ada Lovelace" → "AL". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Round avatar — a photo when present, otherwise the person's initials on a
 * biro tint. Never put a ring behind an avatar (DESIGN.md §13).
 */
export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-biro-tint text-biro",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt="" fill sizes={`${size}px`} className="object-cover" unoptimized />
      ) : (
        <span style={{ fontSize: size * 0.4 }} className="font-display font-semibold">
          {initials(name)}
        </span>
      )}
    </span>
  );
}
