import Link from "next/link";

import { Ring } from "@/components/ring";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/lib/site";

/**
 * The wordmark — a small ring on a date (the brand's literal idea, "circle the
 * date") + the name in the display face. The ring stays a date, never bare
 * decoration (DESIGN.md §13).
 */
export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2.5 rounded-md", className)}
      aria-label={`${siteConfig.name} — home`}
    >
      <Ring day={12} month="Jun" size="sm" />
      <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-ink">
        {siteConfig.name}
      </span>
    </Link>
  );
}
