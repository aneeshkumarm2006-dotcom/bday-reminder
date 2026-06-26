"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Sidebar } from "@/components/app/sidebar";
import { LoadingBlock } from "@/components/ui/spinner";
import { useAuth } from "@/providers/auth-provider";

/**
 * The authenticated app shell. Client-side auth guard (tokens live in
 * localStorage, so there's no server session to gate on): while loading, show a
 * spinner; if signed out, bounce to /login; if signed in but not yet onboarded,
 * route through /onboarding first (FR-2/3). Renders the persistent Sidebar.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const needsOnboarding = status === "authenticated" && user && user.hasOnboarded === false;
  const onOnboarding = pathname === "/onboarding";

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (needsOnboarding && !onOnboarding) {
      router.replace("/onboarding");
    }
  }, [status, needsOnboarding, onOnboarding, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }

  // Onboarding renders full-bleed (no sidebar) until it's complete.
  if (needsOnboarding && onOnboarding) {
    return <>{children}</>;
  }
  if (needsOnboarding) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingBlock />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col lg:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-10">{children}</main>
    </div>
  );
}
