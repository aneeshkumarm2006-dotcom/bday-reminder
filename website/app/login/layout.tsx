import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * A sign-in form has nothing to rank for, and Semrush was scoring it as a thin
 * page. The page itself is a Client Component (it reads `?google=…`), so the
 * metadata has to hang off a server layout wrapped around it.
 *
 * The canonical is set explicitly to overwrite the root layout's `canonical:
 * "/"` — metadata merges shallowly, and inheriting it told Google /login was a
 * duplicate of the homepage. `follow` stays on: the header and footer link here
 * from every marketing page, and the form links back out to /signup and home.
 */
export const metadata: Metadata = {
  title: "Sign in",
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
