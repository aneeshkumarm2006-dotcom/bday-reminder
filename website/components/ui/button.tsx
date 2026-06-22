import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Button (DESIGN.md §8.14) — built the shadcn/ui way (cva + cn), themed to the
 * design tokens. Primary = biro; secondary = bordered surface; ghost = quiet.
 * 44px min height, visible focus, subtle active scale (§9). Use `buttonVariants`
 * to style a `<Link>`/`<a>` as a button.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-body text-sm font-medium transition-[color,background-color,border-color,transform] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-biro text-paper hover:bg-biro-hover",
        secondary:
          "border border-border-strong bg-surface text-ink hover:bg-surface-sunken",
        ghost: "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
        destructive: "text-danger-fg hover:bg-danger-bg",
      },
      size: {
        sm: "h-9 px-3.5",
        default: "h-11 px-5",
        lg: "h-12 px-6 text-[15px]",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
