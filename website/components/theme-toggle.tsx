"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * Light/dark toggle (DESIGN.md §11). The icon swaps purely via the `.dark`
 * class that next-themes sets before hydration, so there's no flash and no
 * hydration mismatch — no client state needed. The click direction reads the
 * resolved theme, which is settled by the time a user can interact.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink active:scale-[0.98]",
        className,
      )}
    >
      <Sun size={20} className="dark:hidden" aria-hidden="true" />
      <Moon size={20} className="hidden dark:block" aria-hidden="true" />
    </button>
  );
}
