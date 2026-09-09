"use client";

import { motion, useReducedMotion } from "framer-motion";
import type * as React from "react";

import { useMotionEnabled } from "@/components/motion-preference";

/**
 * Subtle entrance: fade + 8px rise on mount (DESIGN.md §9 "feed mount: subtle
 * stagger fade+rise"). Mount-based, not scroll-triggered, so content is never
 * left hidden for crawlers or when JS/observers are slow - it just settles in.
 * Restrained on purpose; nothing competes with the ring. Honors
 * `prefers-reduced-motion` (opacity only, no rise, no delay), and the site
 * owner's "animations" switch in Site settings, which renders the content in
 * place with no transition at all.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const enabled = useMotionEnabled();

  // Rendered plainly rather than as a motion.div at rest: an animation that
  // starts at opacity 0 must not be switched off halfway, or the content never
  // appears.
  if (!enabled) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: reduced ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}
