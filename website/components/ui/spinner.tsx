import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/** Quiet loading spinner. Respects reduced-motion via the global CSS override. */
export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cn("animate-spin text-ink-muted", className)} aria-hidden="true" />;
}

/** Full-area centered spinner for page/section loading. */
export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-ink-muted">
      <Spinner size={28} />
      <span className="text-sm">{label}</span>
    </div>
  );
}
