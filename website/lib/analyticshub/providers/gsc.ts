/**
 * Google Search Console via the Search Analytics API. Raw fetch, no SDK. Emits a
 * daily series (clicks/impressions/ctr/position), GSC's own range totals, and the
 * top-20 queries. Shares the Google access token (google-token.ts).
 */
import { addDays, isoDay, previousRange, zeroFillSeries, type DateRange } from "../dates";
import type { DetailTable, SeriesPoint, SourceResult } from "../types";
import { ProviderError } from "./errors";

const API = "https://www.googleapis.com/webmasters/v3";

interface GscRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}
interface GscResponse {
  rows?: GscRow[];
  error?: { message?: string };
}
interface GscSites {
  siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }>;
  error?: { message?: string };
}

async function query(
  token: string,
  siteUrl: string,
  body: Record<string, unknown>,
): Promise<GscResponse> {
  const res = await fetch(
    `${API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  const json = (await res.json().catch(() => null)) as GscResponse | null;
  if (!res.ok || !json) {
    throw new ProviderError(json?.error?.message ?? `Search Console request failed (${res.status}).`, {
      reconnect: res.status === 401,
    });
  }
  return json;
}

/** Verified sites for the settings dropdown. */
export async function listGscSites(token: string): Promise<string[]> {
  const res = await fetch(`${API}/sites`, { headers: { Authorization: `Bearer ${token}` } });
  const json = (await res.json().catch(() => null)) as GscSites | null;
  if (!res.ok || !json) {
    throw new ProviderError(json?.error?.message ?? `Search Console site list failed (${res.status}).`, {
      reconnect: res.status === 401,
    });
  }
  return (json.siteEntry ?? [])
    .map((s) => s.siteUrl)
    .filter((u): u is string => Boolean(u));
}

export async function probeGsc(token: string, siteUrl: string): Promise<void> {
  const today = isoDay(new Date());
  await query(token, siteUrl, {
    startDate: addDays(today, -10),
    endDate: addDays(today, -3),
    rowLimit: 1,
  });
}

function totalsFrom(resp: GscResponse): Record<string, number> {
  const row = resp.rows?.[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0,
  };
}

export async function fetchGsc(
  token: string,
  siteUrl: string,
  range: DateRange,
): Promise<SourceResult> {
  const prev = previousRange(range);

  const [daily, totalsResp, prevResp, queriesResp] = await Promise.all([
    query(token, siteUrl, {
      startDate: range.from,
      endDate: range.to,
      dimensions: ["date"],
      rowLimit: 25000,
    }),
    query(token, siteUrl, { startDate: range.from, endDate: range.to, rowLimit: 1 }),
    query(token, siteUrl, { startDate: prev.from, endDate: prev.to, rowLimit: 1 }),
    query(token, siteUrl, {
      startDate: range.from,
      endDate: range.to,
      dimensions: ["query"],
      rowLimit: 20,
    }),
  ]);

  const maps = {
    clicks: new Map<string, number>(),
    impressions: new Map<string, number>(),
    ctr: new Map<string, number>(),
    position: new Map<string, number>(),
  };
  for (const row of daily.rows ?? []) {
    const day = row.keys?.[0] ?? "";
    maps.clicks.set(day, row.clicks ?? 0);
    maps.impressions.set(day, row.impressions ?? 0);
    maps.ctr.set(day, row.ctr ?? 0);
    maps.position.set(day, row.position ?? 0);
  }
  const series: SeriesPoint[] = (
    ["clicks", "impressions", "ctr", "position"] as const
  ).flatMap((metric) => zeroFillSeries("gsc", metric, range, maps[metric]));

  const queries: DetailTable = {
    key: "topQueries",
    title: "Top queries",
    columns: [
      { key: "query", label: "Query" },
      { key: "clicks", label: "Clicks", format: "number", numeric: true },
      { key: "impressions", label: "Impressions", format: "number", numeric: true },
      { key: "ctr", label: "CTR", format: "percent", numeric: true },
      { key: "position", label: "Position", format: "position", numeric: true },
    ],
    rows: (queriesResp.rows ?? []).map((r) => ({
      query: r.keys?.[0] ?? "(unknown)",
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      ctr: r.ctr ?? 0,
      position: r.position ?? 0,
    })),
  };

  return {
    source: "gsc",
    status: "ok",
    series,
    totals: totalsFrom(totalsResp),
    previous: totalsFrom(prevResp),
    detail: [queries],
  };
}
