import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "./app-shell";

/**
 * Every screen in this group sits behind the sign-in guard, so a crawler only
 * ever sees the spinner — an empty shell with no h1 and no copy. Marking the
 * subtree noindex keeps those husks out of the index (Semrush was flagging
 * /calendar for a missing h1 and thin content) while `follow: true` lets the
 * links out of them still carry weight.
 *
 * `canonical: null` is the load-bearing half: metadata merges shallowly, so
 * without this the whole group inherits the root layout's `canonical: "/"` and
 * tells Google these pages *are* the homepage. One layout covers a dozen paths,
 * so there's no honest self-referential URL to put here — none is correct.
 *
 * `nocache` because these render a signed-in person's own birthdays.
 */
export const metadata: Metadata = {
  title: "Your reminders",
  robots: {
    index: false,
    follow: true,
    nocache: true,
    googleBot: { index: false, follow: true },
  },
  alternates: { canonical: null },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
