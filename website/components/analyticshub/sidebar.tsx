"use client";

import {
  BarChart3,
  LayoutDashboard,
  Megaphone,
  Search,
  Settings,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { SourceKey, SourceStatus } from "@/lib/analyticshub/types";

import { useStatus } from "./api-client";

interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
  source: SourceKey | null;
}

export const HUB_NAV: NavEntry[] = [
  { href: "/analyticshub", label: "Overview", icon: LayoutDashboard, source: null },
  { href: "/analyticshub/analytics", label: "Analytics", icon: BarChart3, source: "ga4" },
  { href: "/analyticshub/search-console", label: "Search Console", icon: Search, source: "gsc" },
  { href: "/analyticshub/meta-ads", label: "Meta Ads", icon: Megaphone, source: "meta" },
  { href: "/analyticshub/google-ads", label: "Google Ads", icon: Target, source: "gads" },
  { href: "/analyticshub/users", label: "Users", icon: Users, source: "users" },
  { href: "/analyticshub/settings", label: "Settings", icon: Settings, source: null },
];

const DOT_CLASS: Record<SourceStatus, string> = {
  ok: "bg-ok-fg",
  not_connected: "bg-border-strong",
  reconnect_needed: "bg-warn-fg",
  error: "bg-danger-fg",
};

const DOT_TITLE: Record<SourceStatus, string> = {
  ok: "Connected",
  not_connected: "Not connected",
  reconnect_needed: "Reconnect needed",
  error: "Error",
};

function StatusDot({ status }: { status: SourceStatus }) {
  return (
    <span
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASS[status])}
      title={DOT_TITLE[status]}
      aria-label={DOT_TITLE[status]}
    />
  );
}

export function HubNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  const { data: status } = useStatus();
  const statusBySource = new Map<SourceKey, SourceStatus>(
    (status?.sources ?? []).map((s) => [s.key, s.status]),
  );

  return (
    <nav
      className={cn(
        orientation === "vertical" ? "flex flex-col gap-1" : "flex gap-1",
      )}
      aria-label="Analytics sections"
    >
      {HUB_NAV.map((entry) => {
        const active = pathname === entry.href;
        const Icon = entry.icon;
        const dot = entry.source ? statusBySource.get(entry.source) : undefined;
        return (
          <Link
            key={entry.href}
            href={entry.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors",
              orientation === "vertical" ? "px-3 py-2" : "shrink-0 whitespace-nowrap px-3 py-1.5",
              active
                ? "bg-biro-tint text-biro"
                : "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
            )}
          >
            <Icon size={17} aria-hidden />
            <span>{entry.label}</span>
            {dot && (
              <span className={cn(orientation === "vertical" && "ml-auto")}>
                <StatusDot status={dot} />
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
