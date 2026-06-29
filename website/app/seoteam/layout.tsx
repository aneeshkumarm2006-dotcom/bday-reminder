import type { Metadata } from "next";

/**
 * The /seoteam area is private. This metadata makes the entire subtree
 * noindex/nofollow (the real exclusion signal); robots.txt also Disallows it.
 * Access is enforced by proxy.ts before any of these pages render.
 */
export const metadata: Metadata = {
  title: { default: "SEO dashboard", template: "%s · SEO dashboard" },
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
  return <div className="min-h-dvh bg-paper">{children}</div>;
}
