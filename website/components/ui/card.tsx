import * as React from "react";

import { cn } from "@/lib/utils";

/** Surface card — bordered container (DESIGN.md §8). Pass `href`/`onClick` semantics via the parent. */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border-subtle bg-surface", className)}
      {...props}
    />
  );
}
