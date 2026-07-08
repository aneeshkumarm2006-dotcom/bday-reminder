"use client";

import { ExternalLink, Images, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { logoutRequest } from "@/lib/blog/dashboard-api";
import { cn } from "@/lib/utils";

/** Top bar for the dashboard pages (the login page renders its own chrome). */
export function SeoTeamHeader({ showNewButton = true }: { showNewButton?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await logoutRequest();
    } finally {
      router.replace("/seoteam/login");
      router.refresh();
    }
  };

  return (
    <header className="border-b border-border-subtle bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link
          href="/seoteam"
          className="font-display text-lg font-semibold text-ink"
        >
          SEO dashboard
        </Link>
        <div className="flex items-center gap-1.5">
          <Link
            href="/seoteam/media"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <Images size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Media</span>
          </Link>
          <Link
            href="/blog"
            target="_blank"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ExternalLink size={18} aria-hidden="true" />
            <span className="hidden sm:inline">View blog</span>
          </Link>
          {showNewButton && (
            <Link
              href="/seoteam/new"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <Plus size={18} aria-hidden="true" />
              New post
            </Link>
          )}
          <Button variant="ghost" size="sm" onClick={signOut} disabled={busy}>
            <LogOut size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
