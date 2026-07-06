/**
 * Google Ads via the REST searchStream endpoint (GAQL). Raw fetch, no SDK. Uses
 * the operator-supplied developer token + a dedicated OAuth client/refresh token
 * (separate from the hub's shared Google app). Emits the normalized daily series
 * (cost/impressions/clicks/conversions/costPerConversion) + range totals.
 */
import { previousRange, zeroFillSeries, type DateRange } from "../dates";
import type { GadsCreds } from "../config";
import type { SeriesPoint, SourceResult } from "../types";
import { ProviderError } from "./errors";

const ADS_API = "https://googleads.googleapis.com/v18";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

function digits(id: string): string {
  return id.replace(/[^0-9]/g, "");
}

function num(v?: string | number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

interface GadsRow {
  segments?: { date?: string };
  metrics?: {
    costMicros?: string;
    impressions?: string;
    clicks?: string;
    conversions?: number | string;
  };
}
interface GadsBatch {
  results?: GadsRow[];
}
interface GadsErrorBody {
  error?: { message?: string; status?: string };
}

async function gadsAccessToken(creds: GadsCreds): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const json = (await res.json().catch(() => null)) as
    | { access_token?: string; error?: string; error_description?: string }
    | null;
  if (!res.ok || !json?.access_token) {
    throw new ProviderError(
      json?.error_description ?? json?.error ?? `Google Ads token refresh failed (${res.status}).`,
      { reconnect: json?.error === "invalid_grant" },
    );
  }
  return json.access_token;
}

async function searchStream(
  creds: GadsCreds,
  accessToken: string,
  query: string,
): Promise<GadsRow[]> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": creds.developerToken,
    "Content-Type": "application/json",
  };
  if (creds.loginCustomerId) headers["login-customer-id"] = digits(creds.loginCustomerId);

  const res = await fetch(
    `${ADS_API}/customers/${digits(creds.customerId)}/googleAds:searchStream`,
    { method: "POST", headers, body: JSON.stringify({ query }) },
  );
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const first = Array.isArray(parsed) ? (parsed[0] as GadsErrorBody) : (parsed as GadsErrorBody);
    throw new ProviderError(
      first?.error?.message ?? `Google Ads request failed (${res.status}).`,
      { reconnect: res.status === 401 },
    );
  }
  const batches = (Array.isArray(parsed) ? parsed : [parsed]) as GadsBatch[];
  return batches.flatMap((b) => b?.results ?? []);
}

const METRIC_QUERY =
  "SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, " +
  "metrics.conversions FROM customer WHERE segments.date BETWEEN";

/** 1-row probe to validate developer token + customer access. */
export async function probeGads(creds: GadsCreds): Promise<void> {
  const token = await gadsAccessToken(creds);
  await searchStream(creds, token, "SELECT customer.id FROM customer LIMIT 1");
}

function totalsFrom(rows: GadsRow[]): Record<string, number> {
  const agg = rows.reduce(
    (acc, r) => {
      acc.cost += num(r.metrics?.costMicros) / 1e6;
      acc.impressions += num(r.metrics?.impressions);
      acc.clicks += num(r.metrics?.clicks);
      acc.conversions += num(r.metrics?.conversions);
      return acc;
    },
    { cost: 0, impressions: 0, clicks: 0, conversions: 0 },
  );
  return {
    cost: agg.cost,
    impressions: agg.impressions,
    clicks: agg.clicks,
    conversions: agg.conversions,
    costPerConversion: agg.conversions ? agg.cost / agg.conversions : 0,
  };
}

export async function fetchGads(creds: GadsCreds, range: DateRange): Promise<SourceResult> {
  const prev = previousRange(range);
  const token = await gadsAccessToken(creds);

  const [rows, prevRows] = await Promise.all([
    searchStream(creds, token, `${METRIC_QUERY} '${range.from}' AND '${range.to}'`),
    searchStream(creds, token, `${METRIC_QUERY} '${prev.from}' AND '${prev.to}'`),
  ]);

  const maps = {
    cost: new Map<string, number>(),
    impressions: new Map<string, number>(),
    clicks: new Map<string, number>(),
    conversions: new Map<string, number>(),
    costPerConversion: new Map<string, number>(),
  };
  for (const r of rows) {
    const day = r.segments?.date ?? "";
    const cost = num(r.metrics?.costMicros) / 1e6;
    const conversions = num(r.metrics?.conversions);
    maps.cost.set(day, cost);
    maps.impressions.set(day, num(r.metrics?.impressions));
    maps.clicks.set(day, num(r.metrics?.clicks));
    maps.conversions.set(day, conversions);
    maps.costPerConversion.set(day, conversions ? cost / conversions : 0);
  }
  const series: SeriesPoint[] = (
    ["cost", "impressions", "clicks", "conversions", "costPerConversion"] as const
  ).flatMap((metric) => zeroFillSeries("gads", metric, range, maps[metric]));

  return {
    source: "gads",
    status: "ok",
    series,
    totals: totalsFrom(rows),
    previous: totalsFrom(prevRows),
  };
}
