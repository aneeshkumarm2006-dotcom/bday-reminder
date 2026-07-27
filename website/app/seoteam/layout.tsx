import type { Metadata } from "next";

import { CommandPalette } from "@/components/seoteam/admin/command-palette";

/**
 * The /seoteam area is private. This metadata makes the entire subtree
 * noindex/nofollow (the real exclusion signal); robots.txt also Disallows it.
 * Access is enforced by proxy.ts before any of these pages render.
 *
 * The command palette is mounted here (not per page) so Ctrl/Cmd+K works from
 * every screen, including the long-form editors.
 */
export const metadata: Metadata = {
  title: { default: "Site admin", template: "%s · Site admin" },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function SeoTeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-paper">
      {children}
      <CommandPalette />
    </div>
  );
}
