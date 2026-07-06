"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  computeDelta,
  formatDelta,
  formatMetricValue,
  isPositiveDelta,
} from "@/lib/analyticshub/format";
import type { MetricFormat } from "@/lib/analyticshub/metrics";

import { Sparkline } from "./chart/sparkline";

/**
 * KPI tile: big display number (tabular-nums), a sparkline, and a %-delta vs the
 * previous equal-length period. Delta color inverts for cost/position metrics
 * (a decrease is good).
 */
export function KpiCard({
  label,
  value,
  previous,
  format,
  lowerIsBetter = false,
  sparkValues,
  color,
  footnote,
}: {
  label: string;
  value: number;
  previous?: number;
  format: MetricFormat;
  lowerIsBetter?: boolean;
  sparkValues?: number[];
  color: string;
  footnote?: string;
}) {
  const delta = previous === undefined ? null : computeDelta(value, previous);
  const positive = delta ? isPositiveDelta(delta, lowerIsBetter) : null;
  const deltaClass =
    positive === null ? "text-ink-muted" : positive ? "text-ok-fg" : "text-danger-fg";
  const DeltaIcon = !delta || delta.direction === "flat" ? null : delta.direction === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="flex flex-col p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      <span className="mt-1.5 font-display text-3xl font-semibold tabular-nums text-ink">
        {formatMetricValue(value, format, true)}
      </span>
      <div className="mt-1 flex items-center gap-1 text-xs">
        {delta ? (
          <span className={cn("inline-flex items-center gap-0.5 font-medium tabular-nums", deltaClass)}>
            {DeltaIcon && <DeltaIcon size={13} aria-hidden />}
            {formatDelta(delta)}
          </span>
        ) : (
          <span className="text-ink-muted">—</span>
        )}
        <span className="text-ink-muted">{footnote ?? "vs. previous"}</span>
      </div>
      {sparkValues && sparkValues.length > 1 && (
        <div className="mt-3">
          <Sparkline values={sparkValues} color={color} width={200} height={34} className="w-full" />
        </div>
      )}
    </Card>
  );
}
