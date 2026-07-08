import { cn } from "@/lib/utils";

/** Base shimmer block, themed to the sunken surface token. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-surface-sunken", className)} />;
}
