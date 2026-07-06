"use client";

import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { LogOut, Moon, RefreshCw, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";
import { RANGE_PRESETS } from "@/lib/analyticshub/dates";
import { formatUpdatedAt } from "@/lib/analyticshub/format";

import { signOut } from "./api-client";
import { useDateRange } from "./date-range-context";

function useLastUpdated(): number | null {
  const cache = useQueryClient().getQueryCache();
  // useSyncExternalStore subscribes to the query cache without a setState-in-
  // render warning (getSnapshot returns a primitive, compared by Object.is).
  return useSyncExternalStore(
    (onChange) => cache.subscribe(onChange),
    () => {
      const times = cache
        .findAll({ queryKey: ["ahub"] })
        .map((q) => q.state.dataUpdatedAt)
        .filter((t): t is number => Boolean(t));
      return times.length ? Math.max(...times) : null;
    },
    () => null,
  );
}

function RangePicker() {
  const { preset, setPreset } = useDateRange();
  return (
    <div className="flex gap-1 overflow-x-auto rounded-lg bg-surface-sunken p-1">
      {RANGE_PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => setPreset(p.key)}
          aria-pressed={preset === p.key}
          className={cn(
            "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            preset === p.key
              ? "bg-surface text-ink shadow-sm"
              : "text-ink-secondary hover:text-ink",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="rounded-md p-2 text-ink-secondary hover:bg-surface-sunken hover:text-ink"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun size={17} aria-hidden /> : <Moon size={17} aria-hidden />}
    </button>
  );
}

export function Topbar() {
  const { refresh } = useDateRange();
  const fetching = useIsFetching({ queryKey: ["ahub"] }) > 0;
  const lastUpdated = useLastUpdated();

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-subtle bg-paper/90 px-4 py-3 backdrop-blur md:px-6">
      <RangePicker />
      <div className="ml-auto flex items-center gap-1.5">
        {lastUpdated && (
          <span className="hidden text-xs text-ink-muted sm:inline">
            Updated {formatUpdatedAt(new Date(lastUpdated).toISOString())}
          </span>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={fetching}
          className="rounded-md p-2 text-ink-secondary hover:bg-surface-sunken hover:text-ink disabled:opacity-50"
          aria-label="Refresh data"
        >
          <RefreshCw size={17} aria-hidden className={cn(fetching && "animate-spin")} />
        </button>
        <ThemeToggle />
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-md p-2 text-ink-secondary hover:bg-surface-sunken hover:text-ink"
          aria-label="Sign out"
        >
          <LogOut size={17} aria-hidden />
        </button>
      </div>
    </header>
  );
}
