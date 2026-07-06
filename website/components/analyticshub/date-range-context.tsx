"use client";

/**
 * Shared date-range + refresh state, read by every hub page. The preset persists
 * to localStorage (default: Last 7 days). A manual refresh bumps `refreshTick`
 * (re-runs the active query) and arms a one-shot flag the api-client consumes to
 * send `refresh=1` — busting the 6h server cache exactly once, so ordinary range
 * changes still hit the cache.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_PRESET,
  resolveRange,
  type DateRange,
  type RangePreset,
} from "@/lib/analyticshub/dates";

interface DateRangeContextValue {
  preset: RangePreset;
  range: DateRange;
  setPreset: (preset: RangePreset) => void;
  refresh: () => void;
  refreshTick: number;
  /** Returns true once after a manual refresh, then resets (one-shot). */
  consumeRefresh: () => boolean;
}

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

const STORAGE_KEY = "analyticshub:preset";

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [preset, setPresetState] = useState<RangePreset>(DEFAULT_PRESET);
  const [refreshTick, setRefreshTick] = useState(0);
  const refreshFlag = useRef(false);

  // Restore the persisted preset after mount (avoids SSR/localStorage mismatch).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setPresetState(stored as RangePreset);
  }, []);

  const setPreset = useCallback((next: RangePreset) => {
    setPresetState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const refresh = useCallback(() => {
    refreshFlag.current = true;
    setRefreshTick((t) => t + 1);
  }, []);

  const consumeRefresh = useCallback(() => {
    if (refreshFlag.current) {
      refreshFlag.current = false;
      return true;
    }
    return false;
  }, []);

  const range = useMemo<DateRange>(() => resolveRange(preset), [preset]);

  const value = useMemo<DateRangeContextValue>(
    () => ({ preset, range, setPreset, refresh, refreshTick, consumeRefresh }),
    [preset, range, setPreset, refresh, refreshTick, consumeRefresh],
  );

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>;
}

export function useDateRange(): DateRangeContextValue {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange must be used within a DateRangeProvider");
  return ctx;
}
