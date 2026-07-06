"use client";

/**
 * Typed same-origin client for the hub's catch-all API + React Query hooks. The
 * httpOnly session cookie rides automatically (no Authorization header). Data
 * queries are keyed by range + refreshTick and never auto-refetch — the daily
 * check stays instant and only the explicit Refresh busts the server cache.
 */
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type { DateRange } from "@/lib/analyticshub/dates";
import type { AllData, SourceKey, SourceResult, StatusPayload } from "@/lib/analyticshub/types";

import { useDateRange } from "./date-range-context";

const BASE = "/analyticshub/api";

async function parse<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !json) {
    throw new Error(json?.error ?? `Request failed (${res.status}).`);
  }
  return json;
}

export async function apiGet<T>(path: string): Promise<T> {
  return parse<T>(await fetch(`${BASE}/${path}`));
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return parse<T>(
    await fetch(`${BASE}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    }),
  );
}

export function useStatus(): UseQueryResult<StatusPayload> {
  return useQuery({
    queryKey: ["ahub", "status"],
    queryFn: () => apiGet<StatusPayload>("status"),
    staleTime: 30_000,
  });
}

interface AllDataResponse {
  range: DateRange;
  sources: AllData;
}
interface SourceResponse {
  range: DateRange;
  source: SourceResult;
}

function dataPath(path: string, range: DateRange, bust: boolean): string {
  return `${path}?from=${range.from}&to=${range.to}${bust ? "&refresh=1" : ""}`;
}

export function useAllData(): UseQueryResult<AllDataResponse> {
  const { range, refreshTick, consumeRefresh } = useDateRange();
  return useQuery({
    queryKey: ["ahub", "all", range.from, range.to, refreshTick],
    queryFn: () => apiGet<AllDataResponse>(dataPath("data/all", range, consumeRefresh())),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useSourceData(source: SourceKey): UseQueryResult<SourceResponse> {
  const { range, refreshTick, consumeRefresh } = useDateRange();
  return useQuery({
    queryKey: ["ahub", source, range.from, range.to, refreshTick],
    queryFn: () => apiGet<SourceResponse>(dataPath(`data/${source}`, range, consumeRefresh())),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/** Sign out of the shared dashboard session, then bounce to the login screen. */
export async function signOut(): Promise<void> {
  await fetch("/seoteam/api/logout", { method: "POST" }).catch(() => undefined);
  window.location.href = "/seoteam/login?next=/analyticshub";
}
