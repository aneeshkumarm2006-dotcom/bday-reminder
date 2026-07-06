"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import type { Theme } from "@/lib/analyticshub/colors";

/** Resolve the active theme for picking chart colors (light until mounted). */
export function useChartTheme(): Theme {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Standard next-themes hydration guard (resolvedTheme is undefined on SSR).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted && resolvedTheme === "dark" ? "dark" : "light";
}
