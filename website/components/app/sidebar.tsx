"use client";

import { Bell, CalendarDays, LogOut, Menu, Plus, Settings, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

/**
 * The app shell's navigation (DESIGN.md §7 chrome). A persistent left sidebar on
 * desktop; a top bar + slide-in drawer on mobile. Mirrors the app's bottom-tab
 * set (Upcoming · Reminders · Lists · Settings) plus a People browse view and a
 * prominent "Add person" action.
 */

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Upcoming", icon: CalendarDays },
  { href: "/reminders", label: "Reminders", icon: Bell },
  { href: "/people", label: "People", icon: Users },
  { href: "/lists", label: "Lists", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href + item.label}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium transition-colors",
              active ? "bg-biro-tint text-biro" : "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
            )}
          >
            <Icon size={19} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserFooter() {
  const { user, signOut } = useAuth();
  if (!user) return null;
  return (
    <div className="border-t border-border-subtle pt-3">
      <div className="flex items-center gap-2.5 px-1">
        <Avatar name={user.name} size={34} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{user.name}</p>
          <p className="truncate text-xs text-ink-muted">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Log out"
          className="rounded-md p-2 text-ink-muted hover:bg-surface-sunken hover:text-ink"
        >
          <LogOut size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-4 border-r border-border-subtle bg-surface p-4 lg:flex">
        <Brand />
        <Link href="/people/new" className={cn(buttonVariants({ size: "default" }), "w-full")}>
          <Plus aria-hidden="true" />
          Add person
        </Link>
        <NavLinks />
        <div className="mt-auto flex flex-col gap-3">
          <div className="flex justify-end">
            <ThemeToggle />
          </div>
          <UserFooter />
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border-subtle bg-surface px-4 py-3 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-secondary hover:bg-surface-sunken"
        >
          <Menu size={22} aria-hidden="true" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-4 bg-surface p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <Link
              href="/people/new"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ size: "default" }), "w-full")}
            >
              <Plus aria-hidden="true" />
              Add person
            </Link>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="mt-auto flex flex-col gap-3">
              <div className="flex justify-end">
                <ThemeToggle />
              </div>
              <UserFooter />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
