"use client";

import { useEffect } from "react";

/**
 * Enables smooth in-page scrolling (anchor jumps like #features, #how) while the
 * home page is mounted, then restores the default on unmount so every other route
 * keeps instant scrolling. Reduced-motion users are unaffected: globals.css forces
 * `scroll-behavior: auto !important` under prefers-reduced-motion, which beats this
 * non-important inline style.
 */
export function SmoothScroll() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "smooth";
    return () => {
      root.style.scrollBehavior = previous;
    };
  }, []);

  return null;
}
