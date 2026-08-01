import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Same reasoning as /login: a form, not a landing page. See `app/login/layout.tsx`. */
export const metadata: Metadata = {
  title: "Create your account",
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
  alternates: { canonical: "/signup" },
};

export default function SignupLayout({ children }: { children: ReactNode }) {
  return children;
}
