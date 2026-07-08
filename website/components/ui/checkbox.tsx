import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Token-themed checkbox for row / bulk selection. A styled native
 * `<input type="checkbox">` for full keyboard + screen-reader accessibility.
 * Set the DOM `indeterminate` flag via a ref for a "some selected" header state.
 */
export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Checkbox({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 cursor-pointer rounded border border-border-strong bg-surface accent-biro",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biro/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
