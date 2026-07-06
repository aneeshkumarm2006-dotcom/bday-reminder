"use client";

/**
 * Overview comparison chart: pick 1–5 metrics across connected sources and
 * overlay them. Auto-switches to indexed mode when the selected maxima differ by
 * >30× (never a dual y-axis). Selection persists to localStorage.
 */
import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { metricColor, metricDash } from "@/lib/analyticshub/colors";
import { SOURCES } from "@/lib/analyticshub/metrics";
import { pivotSeries } from "@/lib/analyticshub/series";
import type { AllData, SourceKey } from "@/lib/analyticshub/types";
import { cn } from "@/lib/utils";

import { LineChart, type ChartSeries } from "./chart/line-chart";
import { needsIndexing } from "./chart/scale";
import { useChartTheme } from "./use-chart-theme";

const STORAGE_KEY = "analyticshub:comparison";
const MAX_SELECTED = 5;

interface Option {
  key: string;
  source: SourceKey;
  metricId: string;
  label: string;
}

export function ComparisonChart({ data }: { data: AllData }) {
  const theme = useChartTheme();

  const options = useMemo<Option[]>(
    () =>
      SOURCES.flatMap((s) => {
        const r = data[s.key];
        if (!r || r.status !== "ok" || r.series.length === 0) return [];
        return s.metrics.map((m) => ({
          key: `${s.key}:${m.id}`,
          source: s.key,
          metricId: m.id,
          label: `${s.label} · ${m.label}`,
        }));
      }),
    [data],
  );

  const [selected, setSelected] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Restore selection (or pick sensible defaults) once options are known.
  useEffect(() => {
    if (ready || options.length === 0) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const valid = new Set(options.map((o) => o.key));
    let initial = stored ? (JSON.parse(stored) as string[]).filter((k) => valid.has(k)) : [];
    if (initial.length === 0) {
      const prefer = ["users:signups", "ga4:sessions", "gsc:clicks"];
      initial = prefer.filter((k) => valid.has(k)).slice(0, MAX_SELECTED);
      if (initial.length === 0) initial = options.slice(0, 2).map((o) => o.key);
    }
    // Client-only seed from localStorage once options are known.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(initial);
    setReady(true);
  }, [options, ready]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length >= MAX_SELECTED
          ? prev
          : [...prev, key];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const series: ChartSeries[] = [];
  let days: string[] = [];
  for (const key of selected) {
    const opt = options.find((o) => o.key === key);
    const result = opt && data[opt.source];
    if (!opt || !result) continue;
    const pivot = pivotSeries(result.series);
    if (pivot.days.length > days.length) days = pivot.days;
    const metric = SOURCES.find((s) => s.key === opt.source)?.metrics.find(
      (m) => m.id === opt.metricId,
    );
    if (!metric) continue;
    series.push({
      key,
      label: opt.label,
      color: metricColor(opt.source, opt.metricId, theme),
      dash: metricDash(opt.source, opt.metricId),
      values: pivot.byMetric[opt.metricId] ?? [],
      format: metric.format,
    });
  }
  const indexed = needsIndexing(series.map((s) => Math.max(0, ...s.values)));

  if (options.length === 0) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-ink">Compare metrics</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Connect a source to overlay and compare metrics here.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">Compare metrics</h2>
        <span className="text-xs text-ink-muted">
          {selected.length}/{MAX_SELECTED} selected
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = selected.includes(opt.key);
          const disabled = !on && selected.length >= MAX_SELECTED;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => toggle(opt.key)}
              disabled={disabled}
              aria-pressed={on}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                on
                  ? "border-transparent text-paper"
                  : "border-border-strong text-ink-secondary hover:bg-surface-sunken",
                disabled && "cursor-not-allowed opacity-40",
              )}
              style={on ? { backgroundColor: metricColor(opt.source, opt.metricId, theme) } : undefined}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {series.length > 0 ? (
        <LineChart days={days} series={series} height={300} indexed={indexed} />
      ) : (
        <p className="py-8 text-center text-sm text-ink-muted">Select a metric to compare.</p>
      )}
    </Card>
  );
}
