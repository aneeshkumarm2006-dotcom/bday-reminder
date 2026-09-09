"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/**
 * Dark-mode plumbing (DESIGN.md §11) - next-themes toggles `.dark` on <html>,
 * which drives the class-based `dark:` variant + token swap in globals.css.
 * System-aware by default; the warm paper stays warm in dark mode.
 *
 * `defaultTheme` is what a first-time visitor gets, set in Site settings →
 * Appearance. It only decides the starting point: a returning visitor's own
 * choice is in localStorage and still wins.
 */
export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: React.ReactNode;
  defaultTheme?: "system" | "light" | "dark";
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
