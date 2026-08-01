import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The Google sign-in landing strip. It only ever holds a one-time `?handoff=…`
 * token for the half-second before it redirects, so it must never be indexed —
 * and it must not inherit the root layout's homepage canonical either.
 */
export const metadata: Metadata = {
  title: "Signing you in",
  robots: {
    index: false,
    follow: true,
    nocache: true,
    googleBot: { index: false, follow: true },
  },
  alternates: { canonical: "/auth/google" },
};

export default function GoogleAuthLayout({ children }: { children: ReactNode }) {
  return children;
}
