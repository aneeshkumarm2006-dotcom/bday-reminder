/**
 * GA4 via the Data API (runReport) + Admin API (accountSummaries). Raw fetch, no
 * SDK. Emits the normalized daily series + totals + top-10 pages/sources. Token
 * comes from google-token.ts (OAuth or service account).
 */
import { previousRange, zeroFillSeries, type DateRange } from "../dates";
import type { DetailTable, SeriesPoint, SourceResult } from "../types";
import { ProviderError } from "./errors";

const DATA_API = "https://analyticsdata.googleapis.com/v1beta";
const ADMIN_API = "https://analyticsadmin.googleapis.com/v1beta";

// Order matters — GA4 returns metricValues aligned to the requested metrics.
const RAW_METRICS = [
  "sessions",
  "totalUsers",
  "newUsers",
  "engagedSessions",
  "keyEvents",
  "userEngagementDuration",
] as const;

interface Ga4Row {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
}
interface Ga4Report {
  rows?: Ga4Row[];
  totals?: Array<{ metricValues?: Array<{ value?: string }> }>;
  error?: { message?: string; status?: string };
}
interface AccountSummaries {
  accountSummaries?: Array<{
    displayName?: string;
    propertySummaries?: Array<{ property?: string; displayName?: string }>;
  }>;
  error?: { message?: string };
}

function num(v?: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** GA4 date dimension "20260706" → "2026-07-06". */
function ymd(v?: string): string {
  if (!v || v.length !== 8) return v ?? "";
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}

async function runReport(
  token: string,
  propertyId: string,
  body: Record<string, unknown>,
): Promise<Ga4Report> {
  const res = await fetch(`${DATA_API}/${propertyId}:runReport`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as Ga4Report | null;
  if (!res.ok || !json) {
    throw new ProviderError(json?.error?.message ?? `GA4 request failed (${res.status}).`, {
      reconnect: res.status === 401,
    });
  }
  return json;
}

/** GA4 properties the connected account can see, for the settings dropdown. */
export async function listGa4Properties(
  token: string,
): Promise<Array<{ property: string; label: string }>> {
  const res = await fetch(`${ADMIN_API}/accountSummaries?pageSize=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json().catch(() => null)) as AccountSummaries | null;
  if (!res.ok || !json) {
    throw new ProviderError(json?.error?.message ?? `GA4 property list failed (${res.status}).`, {
      reconnect: res.status === 401,
    });
  }
  const out: Array<{ property: string; label: string }> = [];
  for (const acct of json.accountSummaries ?? []) {
    for (const p of acct.propertySummaries ?? []) {
      if (p.property) {
        out.push({
          property: p.property,
          label: `${p.displayName ?? p.property}${acct.displayName ? ` · ${acct.displayName}` : ""}`,
        });
      }
    }
  }
  return out;
}

/** 1-row probe to confirm the token can read the chosen property. */
export async function probeGa4(token: string, propertyId: string): Promise<void> {
  await runReport(token, propertyId, {
    dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
    metrics: [{ name: "sessions" }],
    limit: 1,
  });
}

function detailFrom(
  report: Ga4Report,
  dimLabel: string,
  valueLabel: string,
  valueFormat: DetailTable["columns"][number]["format"],
  key: string,
  title: string,
): DetailTable {
  const rows = (report.rows ?? []).map((r) => ({
    label: r.dimensionValues?.[0]?.value ?? "(not set)",
    value: num(r.metricValues?.[0]?.value),
  }));
  return {
    key,
    title,
    columns: [
      { key: "label", label: dimLabel },
      { key: "value", label: valueLabel, format: valueFormat, numeric: true },
    ],
    rows,
  };
}

export async function fetchGa4(
  token: string,
  propertyId: string,
  range: DateRange,
): Promise<SourceResult> {
  const prev = previousRange(range);
  const metrics = RAW_METRICS.map((name) => ({ name }));

  const [current, previous, pages, sources] = await Promise.all([
    runReport(token, propertyId, {
      dateRanges: [{ startDate: range.from, endDate: range.to }],
      dimensions: [{ name: "date" }],
      metrics,
      orderBys: [{ dimension: { dimensionName: "date" } }],
      metricAggregations: ["TOTAL"],
      limit: 100000,
    }),
    runReport(token, propertyId, {
      dateRanges: [{ startDate: prev.from, endDate: prev.to }],
      metrics,
      limit: 1,
    }),
    runReport(token, propertyId, {
      dateRanges: [{ startDate: range.from, endDate: range.to }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 10,
    }),
    runReport(token, propertyId, {
      dateRanges: [{ startDate: range.from, endDate: range.to }],
      dimensions: [{ name: "sessionSource" }],
      metrics: [{ name: "sessions" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: 10,
    }),
  ]);

  // Daily series (per metric) + avg engagement time = engagement / sessions.
  const byDay: Record<string, Map<string, number>> = {
    sessions: new Map(),
    totalUsers: new Map(),
    newUsers: new Map(),
    engagedSessions: new Map(),
    keyEvents: new Map(),
    avgEngagementTime: new Map(),
  };
  for (const row of current.rows ?? []) {
    const day = ymd(row.dimensionValues?.[0]?.value);
    const vals = row.metricValues ?? [];
    const sessions = num(vals[0]?.value);
    byDay.sessions.set(day, sessions);
    byDay.totalUsers.set(day, num(vals[1]?.value));
    byDay.newUsers.set(day, num(vals[2]?.value));
    byDay.engagedSessions.set(day, num(vals[3]?.value));
    byDay.keyEvents.set(day, num(vals[4]?.value));
    byDay.avgEngagementTime.set(day, sessions ? num(vals[5]?.value) / sessions : 0);
  }
  const series: SeriesPoint[] = Object.entries(byDay).flatMap(([metric, map]) =>
    zeroFillSeries("ga4", metric, range, map),
  );

  const totalVals = current.totals?.[0]?.metricValues ?? [];
  const totalSessions = num(totalVals[0]?.value);
  const totals: Record<string, number> = {
    sessions: totalSessions,
    totalUsers: num(totalVals[1]?.value),
    newUsers: num(totalVals[2]?.value),
    engagedSessions: num(totalVals[3]?.value),
    keyEvents: num(totalVals[4]?.value),
    avgEngagementTime: totalSessions ? num(totalVals[5]?.value) / totalSessions : 0,
  };

  const prevVals = previous.rows?.[0]?.metricValues ?? [];
  const prevSessions = num(prevVals[0]?.value);
  const previousTotals: Record<string, number> = {
    sessions: prevSessions,
    totalUsers: num(prevVals[1]?.value),
    newUsers: num(prevVals[2]?.value),
    engagedSessions: num(prevVals[3]?.value),
    keyEvents: num(prevVals[4]?.value),
    avgEngagementTime: prevSessions ? num(prevVals[5]?.value) / prevSessions : 0,
  };

  return {
    source: "ga4",
    status: "ok",
    series,
    totals,
    previous: previousTotals,
    detail: [
      detailFrom(pages, "Page", "Views", "number", "topPages", "Top pages"),
      detailFrom(sources, "Source", "Sessions", "number", "topSources", "Top sources"),
    ],
  };
}
