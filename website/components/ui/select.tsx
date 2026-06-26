import * as React from "react";

import { cn } from "@/lib/utils";

/** Native select styled to match the design tokens (DESIGN.md §8). */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "h-11 w-full appearance-none rounded-md border border-border-strong bg-surface px-3.5 text-[15px] text-ink transition-colors focus:border-biro disabled:opacity-50",
        "bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9",
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236e675f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
});
