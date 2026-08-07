"use client";

import { useEffect, useState } from "react";

/**
 * How many pixels of the window the on-screen keyboard is currently covering.
 *
 * A `position: fixed` element is positioned against the *layout* viewport, and
 * that doesn't shrink when a phone keyboard slides up — so a bottom-anchored
 * dialog ends up underneath the keyboard, and the browser can't scroll it into
 * view either (it's fixed). `visualViewport` is the part actually on screen;
 * the difference between the two is the overlap to keep clear.
 *
 * Chromium also respects `interactiveWidget: "resizes-content"` (set in the
 * root layout's viewport), which makes this measure 0 there. Safari ignores
 * that, which is the case this hook exists for.
 *
 * Returns 0 on the server, in browsers without `visualViewport`, and whenever
 * the keyboard is closed.
 */
export function useKeyboardInset(active = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active) return;
    const vv = typeof window === "undefined" ? null : window.visualViewport;
    if (!vv) return;

    const measure = () => {
      // Round down and clamp: sub-pixel jitter during the keyboard animation
      // otherwise re-renders on every frame, and a bounce-scrolled page can
      // report a small negative overlap.
      const overlap = window.innerHeight - (vv.height + vv.offsetTop);
      setInset(Math.max(0, Math.floor(overlap)));
    };

    // First measurement on the next frame, not inline: it covers opening while
    // the keyboard is already up (tapping "Edit message" from a focused field)
    // without reading a viewport that's still mid-animation.
    const frame = requestAnimationFrame(measure);
    vv.addEventListener("resize", measure);
    vv.addEventListener("scroll", measure);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", measure);
      vv.removeEventListener("scroll", measure);
    };
  }, [active]);

  // Closed dialogs report 0 without needing a state write to get there.
  return active ? inset : 0;
}
