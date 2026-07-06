/**
 * Metric + source catalog. Drives KPI tiles, chart series, number formatting, and
 * delta color inversion (cost/position metrics are "lower is better"). Pure data —
 * safe to import from client components.
 */
import type { SourceKey } from "./types";

export type MetricFormat =
  | "number"
  | "percent"
  | "currency"
  | "duration"
  | "position"
  | "ratio";

export interface MetricDef {
  id: string;
  label: string;
  /** Compact label for chart legends / tight tiles. */
  short?: string;
  format: MetricFormat;
  /** Cost / position metrics: a decrease is good, so the delta color inverts. */
  lowerIsBetter?: boolean;
}

export interface SourceDef {
  key: SourceKey;
  /** Sidebar + page label. */
  label: string;
  /** URL slug under /analyticshub. */
  slug: string;
  /** Whether this source needs credentials (Users never does). */
  requiresConnection: boolean;
  metrics: MetricDef[];
  /** Metric ids shown as KPI tiles on the source page, in order. */
  kpis: string[];
  /** Metric ids drawn on the source page's fixed multi-line chart. */
  chartMetrics: string[];
}

export const SOURCES: readonly SourceDef[] = [
  {
    key: "ga4",
    label: "Analytics",
    slug: "analytics",
    requiresConnection: true,
    metrics: [
      { id: "sessions", label: "Sessions", format: "number" },
      { id: "totalUsers", label: "Total users", short: "Users", format: "number" },
      { id: "newUsers", label: "New users", format: "number" },
      { id: "engagedSessions", label: "Engaged sessions", short: "Engaged", format: "number" },
      { id: "keyEvents", label: "Conversions", format: "number" },
      { id: "avgEngagementTime", label: "Avg. engagement", short: "Engagement", format: "duration" },
    ],
    kpis: ["sessions", "totalUsers", "keyEvents", "avgEngagementTime"],
    chartMetrics: ["sessions", "totalUsers", "newUsers", "engagedSessions"],
  },
  {
    key: "gsc",
    label: "Search Console",
    slug: "search-console",
    requiresConnection: true,
    metrics: [
      { id: "clicks", label: "Clicks", format: "number" },
      { id: "impressions", label: "Impressions", format: "number" },
      { id: "ctr", label: "CTR", format: "percent" },
      { id: "position", label: "Avg. position", short: "Position", format: "position", lowerIsBetter: true },
    ],
    kpis: ["clicks", "impressions", "ctr", "position"],
    chartMetrics: ["clicks", "impressions"],
  },
  {
    key: "meta",
    label: "Meta Ads",
    slug: "meta-ads",
    requiresConnection: true,
    metrics: [
      { id: "spend", label: "Spend", format: "currency", lowerIsBetter: true },
      { id: "impressions", label: "Impressions", format: "number" },
      { id: "clicks", label: "Clicks", format: "number" },
      { id: "cpc", label: "CPC", format: "currency", lowerIsBetter: true },
      { id: "cpm", label: "CPM", format: "currency", lowerIsBetter: true },
      { id: "results", label: "Results", format: "number" },
      { id: "roas", label: "ROAS", format: "ratio" },
    ],
    kpis: ["spend", "results", "roas", "clicks"],
    chartMetrics: ["spend", "clicks", "impressions"],
  },
  {
    key: "gads",
    label: "Google Ads",
    slug: "google-ads",
    requiresConnection: true,
    metrics: [
      { id: "cost", label: "Cost", format: "currency", lowerIsBetter: true },
      { id: "impressions", label: "Impressions", format: "number" },
      { id: "clicks", label: "Clicks", format: "number" },
      { id: "conversions", label: "Conversions", format: "number" },
      { id: "costPerConversion", label: "Cost / conv.", short: "CPA", format: "currency", lowerIsBetter: true },
    ],
    kpis: ["cost", "clicks", "conversions", "costPerConversion"],
    chartMetrics: ["cost", "clicks", "conversions"],
  },
  {
    key: "users",
    label: "Users",
    slug: "users",
    requiresConnection: false,
    metrics: [{ id: "signups", label: "Signups", format: "number" }],
    kpis: ["signups"],
    chartMetrics: ["signups"],
  },
] as const;

/** Sidebar / navigation order of the source keys. */
export const SOURCE_ORDER: readonly SourceKey[] = SOURCES.map((s) => s.key);

const SOURCE_BY_KEY = new Map<SourceKey, SourceDef>(SOURCES.map((s) => [s.key, s]));

export function getSource(key: SourceKey): SourceDef {
  const def = SOURCE_BY_KEY.get(key);
  if (!def) throw new Error(`Unknown analytics source: ${key}`);
  return def;
}

export function getSourceBySlug(slug: string): SourceDef | undefined {
  return SOURCES.find((s) => s.slug === slug);
}

export function getMetric(source: SourceKey, metricId: string): MetricDef | undefined {
  return getSource(source).metrics.find((m) => m.id === metricId);
}

/** Which metrics should treat cost/position as "lower is better" for delta color. */
export function isLowerBetter(source: SourceKey, metricId: string): boolean {
  return Boolean(getMetric(source, metricId)?.lowerIsBetter);
}
