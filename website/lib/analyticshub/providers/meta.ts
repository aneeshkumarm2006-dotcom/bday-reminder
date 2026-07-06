/**
 * Meta (Facebook) Ads via the Graph API insights edge. Raw fetch, no SDK. A long-
 * lived token + a chosen ad account produce the normalized daily series (spend,
 * impressions, clicks, cpc, cpm, results, roas) and range totals. An expired /
 * revoked token (OAuthException, code 190) flips the source to reconnect.
 */
import { previousRange, zeroFillSeries, type DateRange } from "../dates";
import type { SeriesPoint, SourceResult } from "../types";
import { ProviderError } from "./errors";

const GRAPH = "https://graph.facebook.com/v21.0";

interface MetaAction {
  action_type?: string;
  value?: string;
}
interface MetaInsightRow {
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  cpc?: string;
  cpm?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
}
interface MetaResponse<T> {
  data?: T[];
  error?: { message?: string; code?: number; type?: string };
}

function num(v?: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const isResult = (t: string): boolean =>
  /purchase|lead|complete_registration|onsite_conversion\.lead/i.test(t);
const isRevenue = (t: string): boolean => /purchase/i.test(t);

function sumActions(actions: MetaAction[] | undefined, match: (t: string) => boolean): number {
  if (!actions) return 0;
  return actions.reduce((s, a) => (match(a.action_type ?? "") ? s + num(a.value) : s), 0);
}

async function metaGet<T>(path: string, params: Record<string, string>, token: string): Promise<MetaResponse<T>> {
  const qs = new URLSearchParams({ ...params, access_token: token }).toString();
  const res = await fetch(`${GRAPH}/${path}?${qs}`);
  const json = (await res.json().catch(() => null)) as MetaResponse<T> | null;
  if (!res.ok || !json || json.error) {
    const code = json?.error?.code;
    throw new ProviderError(json?.error?.message ?? `Meta request failed (${res.status}).`, {
      reconnect: code === 190 || json?.error?.type === "OAuthException",
    });
  }
  return json;
}

/** Validate a token and return the display name it belongs to. */
export async function validateMetaToken(token: string): Promise<string> {
  const json = await metaGet<never>("me", { fields: "id,name" }, token);
  const me = json as unknown as { name?: string };
  return me.name ?? "Meta account";
}

export async function listMetaAccounts(
  token: string,
): Promise<Array<{ id: string; name: string; currency: string }>> {
  const json = await metaGet<{ id?: string; name?: string; currency?: string }>(
    "me/adaccounts",
    { fields: "name,currency", limit: "200" },
    token,
  );
  return (json.data ?? [])
    .filter((a) => Boolean(a.id))
    .map((a) => ({ id: a.id as string, name: a.name ?? a.id ?? "", currency: a.currency ?? "" }));
}

function rowMetrics(row: MetaInsightRow) {
  const spend = num(row.spend);
  const impressions = num(row.impressions);
  const clicks = num(row.clicks);
  const results = sumActions(row.actions, isResult);
  const revenue = sumActions(row.action_values, isRevenue);
  return {
    spend,
    impressions,
    clicks,
    cpc: clicks ? spend / clicks : num(row.cpc),
    cpm: impressions ? (spend / impressions) * 1000 : num(row.cpm),
    results,
    roas: spend ? revenue / spend : 0,
    revenue,
  };
}

function totalsFrom(rows: MetaInsightRow[]): Record<string, number> {
  const agg = rows.reduce(
    (acc, row) => {
      const m = rowMetrics(row);
      acc.spend += m.spend;
      acc.impressions += m.impressions;
      acc.clicks += m.clicks;
      acc.results += m.results;
      acc.revenue += m.revenue;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, results: 0, revenue: 0 },
  );
  return {
    spend: agg.spend,
    impressions: agg.impressions,
    clicks: agg.clicks,
    results: agg.results,
    cpc: agg.clicks ? agg.spend / agg.clicks : 0,
    cpm: agg.impressions ? (agg.spend / agg.impressions) * 1000 : 0,
    roas: agg.spend ? agg.revenue / agg.spend : 0,
  };
}

export async function fetchMeta(
  token: string,
  accountId: string,
  range: DateRange,
): Promise<SourceResult> {
  const prev = previousRange(range);
  const fields = "spend,impressions,clicks,cpc,cpm,actions,action_values";

  const [daily, prevAgg] = await Promise.all([
    metaGet<MetaInsightRow>(
      `${accountId}/insights`,
      { fields, time_range: JSON.stringify({ since: range.from, until: range.to }), time_increment: "1", limit: "500" },
      token,
    ),
    metaGet<MetaInsightRow>(
      `${accountId}/insights`,
      { fields, time_range: JSON.stringify({ since: prev.from, until: prev.to }), limit: "1" },
      token,
    ),
  ]);

  const rows = daily.data ?? [];
  const metricIds = ["spend", "impressions", "clicks", "cpc", "cpm", "results", "roas"] as const;
  const maps: Record<string, Map<string, number>> = Object.fromEntries(
    metricIds.map((m) => [m, new Map<string, number>()]),
  );
  for (const row of rows) {
    const day = row.date_start ?? "";
    const m = rowMetrics(row);
    maps.spend.set(day, m.spend);
    maps.impressions.set(day, m.impressions);
    maps.clicks.set(day, m.clicks);
    maps.cpc.set(day, m.cpc);
    maps.cpm.set(day, m.cpm);
    maps.results.set(day, m.results);
    maps.roas.set(day, m.roas);
  }
  const series: SeriesPoint[] = metricIds.flatMap((m) =>
    zeroFillSeries("meta", m, range, maps[m]),
  );

  return {
    source: "meta",
    status: "ok",
    series,
    totals: totalsFrom(rows),
    previous: totalsFrom(prevAgg.data ?? []),
  };
}
