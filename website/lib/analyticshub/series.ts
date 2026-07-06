/**
 * Reshape a tidy `SeriesPoint[]` into aligned per-metric arrays for the charts.
 * Pure — used by the source pages, the Overview comparison chart, and tests.
 */
import type { SeriesPoint } from "./types";

export interface PivotedSeries {
  days: string[];
  byMetric: Record<string, number[]>;
}

export function pivotSeries(series: SeriesPoint[]): PivotedSeries {
  const days = Array.from(new Set(series.map((p) => p.date))).sort();
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  const byMetric: Record<string, number[]> = {};
  for (const p of series) {
    if (!byMetric[p.metric]) byMetric[p.metric] = new Array(days.length).fill(0);
    const i = dayIndex.get(p.date);
    if (i !== undefined) byMetric[p.metric][i] = p.value;
  }
  return { days, byMetric };
}
