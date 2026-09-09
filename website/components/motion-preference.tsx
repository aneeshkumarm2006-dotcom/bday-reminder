"use client";

import * as React from "react";

/**
 * Whether the public site's entrance animations run.
 *
 * `Reveal` is driven by framer-motion, i.e. by JavaScript, so a CSS rule can't
 * switch it off — the flag has to reach the component itself. A context set once
 * by the marketing shell does that without threading a prop through every
 * section, and it defaults to "on" so anything rendered outside the shell (the
 * admin previews, the authenticated app) behaves exactly as before.
 *
 * The viewer's own `prefers-reduced-motion` still wins independently; this is
 * the site owner's preference, not a replacement for theirs.
 */
const MotionEnabledContext = React.createContext(true);

export function MotionPreference({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <MotionEnabledContext.Provider value={enabled}>{children}</MotionEnabledContext.Provider>
  );
}

export function useMotionEnabled(): boolean {
  return React.useContext(MotionEnabledContext);
}
