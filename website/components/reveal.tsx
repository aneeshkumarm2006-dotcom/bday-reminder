"use client";

import { motion, useReducedMotion } from "framer-motion";
import type * as React from "react";

/**
 * Subtle entrance: fade + 8px rise on mount (DESIGN.md §9 "feed mount: subtle
 * stagger fade+rise"). Mount-based, not scroll-triggered, so content is never
 * left hidden for crawlers or when JS/observers are slow - it just settles in.
 * Restrained on purpose; nothing competes with the ring. Honors
 * `prefers-reduced-motion` (opacity only, no rise, no delay).
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
