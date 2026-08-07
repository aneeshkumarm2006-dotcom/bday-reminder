"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Sidebar } from "@/components/app/sidebar";
import { LoadingBlock } from "@/components/ui/spinner";
import { withNext } from "@/lib/next-path";
import { useAuth } from "@/providers/auth-provider";

/**
 * The authenticated app shell. Client-side auth guard (tokens live in
 * localStorage, so there's no server session to gate on): while loading, show a
 * spinner; if signed out, bounce to /login. Renders the persistent Sidebar.
 *
 * This lives apart from `layout.tsx` so the layout can stay a Server Component
 * and export `metadata` — a Client Component can't, and without it every app
 * screen inherited the marketing homepage's title and canonical.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "unauthenticated") {
      // Carry the path through the detour. An invite link is the case that
      // matters: it's opened by someone who usually has no account yet, and
      // without this they finish signing up on the calendar with the invite
      // gone. Query strings aren't carried — no authed route needs one to
      // resolve, and round-tripping them re-triggers ?gmail=/?resume= effects.
      router.replace(withNext("/login", pathname));
    }
  }, [status, router, pathname]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh w-full flex-col lg:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
