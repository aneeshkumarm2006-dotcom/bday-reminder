"use client";

/**
 * Overview — the five-second "how did we do?" view: KPI cards (new signups, GA4
 * sessions, GA4 conversions, GSC clicks, combined ad spend when an ads source is
 * connected), the comparison chart, and top-5 strips. Fetches every source in a
 * single `data/all` request.
 */
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { sourceColor } from "@/lib/analyticshub/colors";
import { formatDay } from "@/lib/analyticshub/format";
import type { MetricFormat } from "@/lib/analyticshub/metrics";
import { pivotSeries } from "@/lib/analyticshub/series";
import type { AllData, DetailTable, SourceKey } from "@/lib/analyticshub/types";

import { useAllData } from "./api-client";
import { ComparisonChart } from "./comparison-chart";
import { KpiCard } from "./kpi-card";
import { ChartSkeleton, KpiSkeleton, TableSkeleton } from "./skeleton";
import { ErrorState } from "./states";
import { TopStrip, type StripItem } from "./top-strip";
import { useChartTheme } from "./use-chart-theme";

interface KpiSpec {
  key: string;
  label: string;
  source: SourceKey;
  metric: string;
  format: MetricFormat;
}

const KPIS: KpiSpec[] = [
  { key: "signups", label: "New signups", source: "users", metric: "signups", format: "number" },
  { key: "sessions", label: "Sessions", source: "ga4", metric: "sessions", format: "number" },
  { key: "conversions", label: "Conversions", source: "ga4", metric: "keyEvents", format: "number" },
  { key: "clicks", label: "Search clicks", source: "gsc", metric: "clicks", format: "number" },
];

function MutedKpi({ label, connect }: { label: string; connect: string }) {
  return (
    <Card className="flex flex-col justify-between p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      <Link href="/analyticshub/settings" className="mt-2 text-sm font-medium text-biro hover:underline">
        Connect {connect} →
      </Link>
    </Card>
  );
}

function sumArrays(a: number[], b: number[]): number[] {
  const len = Math.max(a.length, b.length);
  return Array.from({ length: len }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0));
}

function stripFromDetail(detail: DetailTable[] | undefined, key: string, valueKey: string): StripItem[] {
  const table = detail?.find((t) => t.key === key);
  if (!table) return [];
  return table.rows.slice(0, 5).map((r) => ({
    label: String(r[table.columns[0].key] ?? ""),
    value: Number(r[valueKey] ?? 0).toLocaleString("en-US"),
  }));
}

export function Overview() {
  const theme = useChartTheme();
  const { data, isLoading, error } = useAllData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {KPIS.map((k) => (
            <KpiSkeleton key={k.key} />
          ))}
          <KpiSkeleton />
        </div>
        <ChartSkeleton height={300} />
        <div className="grid gap-4 lg:grid-cols-3">
          <TableSkeleton rows={5} />
          <TableSkeleton rows={5} />
          <TableSkeleton rows={5} />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <ErrorState message={error instanceof Error ? error.message : undefined} />;
  }

  const sources: AllData = data.sources;

  // Combined ad spend (Meta spend + Google Ads cost), shown only if connected.
  const meta = sources.meta;
  const gads = sources.gads;
  const adConnected = meta?.status === "ok" || gads?.status === "ok";
  const adSpendNow = (meta?.totals.spend ?? 0) + (gads?.totals.cost ?? 0);
  const adSpendPrev = (meta?.previous.spend ?? 0) + (gads?.previous.cost ?? 0);
  const adSpark = sumArrays(
    meta?.status === "ok" ? pivotSeries(meta.series).byMetric.spend ?? [] : [],
    gads?.status === "ok" ? pivotSeries(gads.series).byMetric.cost ?? [] : [],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-ink">Overview</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {KPIS.map((spec) => {
          const result = sources[spec.source];
          if (!result || result.status !== "ok") {
            return <MutedKpi key={spec.key} label={spec.label} connect={spec.source.toUpperCase()} />;
          }
          const byMetric = pivotSeries(result.series).byMetric;
          return (
            <KpiCard
              key={spec.key}
              label={spec.label}
              value={result.totals[spec.metric] ?? 0}
              previous={result.previous[spec.metric]}
              format={spec.format}
              sparkValues={byMetric[spec.metric]}
              color={sourceColor(spec.source, theme)}
            />
          );
        })}
        {adConnected && (
          <KpiCard
            label="Ad spend"
            value={adSpendNow}
            previous={adSpendPrev}
            format="currency"
            lowerIsBetter
            sparkValues={adSpark}
            color={sourceColor("meta", theme)}
          />
        )}
      </div>

      <ComparisonChart data={sources} />

      <div className="grid gap-4 lg:grid-cols-3">
        <TopStrip
          title="Top search queries"
          items={stripFromDetail(sources.gsc?.detail, "topQueries", "clicks")}
          href="/analyticshub/search-console"
          empty="Connect Search Console to see queries."
        />
        <TopStrip
          title="Top pages"
          items={stripFromDetail(sources.ga4?.detail, "topPages", "value")}
          href="/analyticshub/analytics"
          empty="Connect Analytics to see pages."
        />
        <TopStrip
          title="Recent signups"
          items={
            sources.users?.detail
              ?.find((t) => t.key === "recentSignups")
              ?.rows.slice(0, 5)
              .map((r) => ({
                label: String(r.name || r.email || "—"),
                value: r.createdAt ? formatDay(String(r.createdAt).slice(0, 10)) : "",
              })) ?? []
          }
          href="/analyticshub/users"
          empty="No signups in this range."
        />
      </div>
    </div>
  );
}
