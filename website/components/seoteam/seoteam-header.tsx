"use client";

import {
  Activity,
  ExternalLink,
  FileText,
  Files,
  Images,
  LayoutGrid,
  LayoutTemplate,
  LogOut,
  Navigation,
  Scale,
  Search,
  Settings2,
  Shuffle,
  Tags,
  Target,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { OPEN_EVENT } from "@/components/seoteam/admin/command-palette";
import { Button, buttonVariants } from "@/components/ui/button";
import { logoutRequest } from "@/lib/blog/dashboard-api";
import { cn } from "@/lib/utils";

/**
 * Top bar for the dashboard (the login page renders its own chrome). Two rows:
 * identity + global actions, then the section nav. The nav scrolls horizontally
 * on narrow screens rather than wrapping, so the bar height stays fixed.
 */
const SECTIONS = [
  { href: "/seoteam", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/seoteam/posts", label: "Posts", icon: FileText },
  { href: "/seoteam/media", label: "Media", icon: Images },
  { href: "/seoteam/landing", label: "Landing", icon: LayoutTemplate },
  { href: "/seoteam/seo-pages", label: "SEO pages", icon: Target },
  { href: "/seoteam/pages", label: "Pages", icon: Files },
  { href: "/seoteam/legal", label: "Legal", icon: Scale },
  { href: "/seoteam/site", label: "Site", icon: Settings2 },
  { href: "/seoteam/meta", label: "Meta", icon: Tags },
  { href: "/seoteam/navigation", label: "Nav", icon: Navigation },
  { href: "/seoteam/redirects", label: "Redirects", icon: Shuffle },
  { href: "/seoteam/activity", label: "Activity", icon: Activity },
] as const;

export function SeoTeamHeader() {
  const router = useRouter();
  const pathname = usePathname();
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

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="border-b border-border-subtle bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 pt-3">
        <Link href="/seoteam" className="font-display text-lg font-semibold text-ink">
          Site admin
        </Link>
        <div className="flex items-center gap-1.5">
          {/* The palette itself lives in the /seoteam layout and listens for
              this event, so the shortcut works from every screen. */}
          <Button
            variant="ghost"
            size="sm"
            aria-keyshortcuts="Control+K"
            onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
          >
            <Search size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
          </Button>
          <Link
            href="/"
            target="_blank"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ExternalLink size={18} aria-hidden="true" />
            <span className="hidden sm:inline">View site</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut} disabled={busy}>
            <LogOut size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </div>

      <nav
        aria-label="Admin sections"
        className="mx-auto w-full max-w-6xl overflow-x-auto px-5 pb-1 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex items-center gap-1">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = isActive(section.href, "exact" in section && section.exact);
            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-biro text-ink"
                      : "border-transparent text-ink-secondary hover:bg-surface-sunken hover:text-ink",
                  )}
                >
                  <Icon size={16} aria-hidden="true" />
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
