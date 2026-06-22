"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/**
 * Dark-mode plumbing (DESIGN.md §11) — next-themes toggles `.dark` on <html>,
 * which drives the class-based `dark:` variant + token swap in globals.css.
 * System-aware by default; the warm paper stays warm in dark mode.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
