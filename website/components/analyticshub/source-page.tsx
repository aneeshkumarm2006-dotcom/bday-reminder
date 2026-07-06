"use client";

/**
 * Shared frame for every source page: KPI tiles (with sparklines + deltas), a
 * fixed multi-line daily chart of the source's key metrics, and its detail
 * tables. Fetches ONLY its own source. Renders the friendly not-connected card,
 * the verbatim error/reconnect state, or skeletons while loading.
 */
import { Card } from "@/components/ui/card";
import { metricColor, metricDash, sourceColor } from "@/lib/analyticshub/colors";
import { getSource, type MetricDef } from "@/lib/analyticshub/metrics";
import { pivotSeries } from "@/lib/analyticshub/series";
import type { SourceKey } from "@/lib/analyticshub/types";

import { useSourceData } from "./api-client";
import { LineChart, type ChartSeries } from "./chart/line-chart";
import { needsIndexing } from "./chart/scale";
import { DetailTable } from "./detail-table";
import { KpiCard } from "./kpi-card";
import { ChartSkeleton, KpiSkeleton, TableSkeleton } from "./skeleton";
import { ConnectPrompt, ErrorState } from "./states";
import { useChartTheme } from "./use-chart-theme";

export function SourcePage({ source }: { source: SourceKey }) {
  const def = getSource(source);
  const theme = useChartTheme();
  const { data, isLoading, error } = useSourceData(source);

  const metricDefs = (ids: string[]): MetricDef[] =>
    ids.map((id) => def.metrics.find((m) => m.id === id)).filter((m): m is MetricDef => Boolean(m));

  let body: React.ReactNode;

  if (isLoading) {
    body = (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {def.kpis.map((id) => (
            <KpiSkeleton key={id} />
          ))}
        </div>
        <ChartSkeleton />
        <TableSkeleton />
      </>
    );
  } else if (error) {
    body = <ErrorState message={error instanceof Error ? error.message : undefined} />;
  } else if (data) {
    const result = data.source;
    if (result.status === "not_connected") {
      body = <ConnectPrompt title={`${def.label} isn’t connected`} />;
    } else if (result.status === "reconnect_needed") {
      body = <ErrorState message={result.error} reconnect />;
    } else if (result.status === "error") {
      body = <ErrorState message={result.error} />;
    } else {
      const { days, byMetric } = pivotSeries(result.series);
      const chartSeries: ChartSeries[] = metricDefs(def.chartMetrics).map((m) => ({
        key: m.id,
        label: m.label,
        color: metricColor(source, m.id, theme),
        dash: metricDash(source, m.id),
        values: byMetric[m.id] ?? [],
        format: m.format,
      }));
      const indexed = needsIndexing(chartSeries.map((s) => Math.max(0, ...s.values)));
      const detail = result.detail ?? [];

      body = (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metricDefs(def.kpis).map((m) => (
              <KpiCard
                key={m.id}
                label={m.label}
                value={result.totals[m.id] ?? 0}
                previous={result.previous[m.id]}
                format={m.format}
                lowerIsBetter={m.lowerIsBetter}
                sparkValues={byMetric[m.id]}
                color={sourceColor(source, theme)}
              />
            ))}
            {source === "users" && (
              <KpiCard
                label="Total users"
                value={result.totals.totalUsers ?? 0}
                format="number"
                color={sourceColor(source, theme)}
                footnote="all time"
              />
            )}
          </div>

          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-ink">Daily {def.label.toLowerCase()}</h2>
            <LineChart days={days} series={chartSeries} indexed={indexed} />
          </Card>

          {detail.length > 0 && (
            <div className={detail.length > 1 ? "grid gap-4 lg:grid-cols-2" : ""}>
              {detail.map((table) => (
                <DetailTable key={table.key} table={table} />
              ))}
            </div>
          )}
        </>
      );
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold text-ink">{def.label}</h1>
      </header>
      {body}
    </div>
  );
}
